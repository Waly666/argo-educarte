import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  Input,
  OnChanges,
  SimpleChanges,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

export interface EnumBuscarOption {
  value: string | number;
  label: string;
  hint?: string;
}

@Component({
  selector: 'argo-catalogo-enum-buscar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalogo-enum-buscar.component.html',
  styleUrls: ['./catalogo-enum-buscar.component.scss'],
  host: {
    '[class.dropdown-open]': 'open()',
  },
})
export class CatalogoEnumBuscarComponent implements OnChanges {
  /** Cierra el dropdown de otra instancia al abrir esta. */
  private static instanciaAbierta: CatalogoEnumBuscarComponent | null = null;

  @Input() label = '';
  @Input() placeholder = 'Escriba para buscar…';
  @Input() textoInicial = '';
  @Input() disabled = false;
  @Input() minLength = 2;
  /** Si true, usa `buscarRemoto`; si false, filtra `opcionesLocales`. */
  @Input() remoto = true;
  /** Combobox: al abrir muestra la lista completa; al escribir filtra (sin exigir mínimo de caracteres). */
  @Input() modoCombo = false;
  @Input() opcionesLocales: EnumBuscarOption[] = [];
  @Input() buscarRemoto?: (q: string) => Observable<EnumBuscarOption[]>;

  seleccionado = output<EnumBuscarOption>();
  limpiado = output<void>();

  query = signal('');
  open = signal(false);
  loading = signal(false);
  resultados = signal<EnumBuscarOption[]>([]);
  /** true mientras el usuario edita el texto para filtrar (no al abrir la lista). */
  filtrandoActivo = signal(false);

  private q$ = new Subject<string>();

  constructor() {
    this.q$
      .pipe(
        debounceTime(220),
        distinctUntilChanged(),
        switchMap((q) => {
          this.loading.set(true);
          if (this.remoto) {
            if (!this.buscarRemoto) return of([]);
            return this.buscarRemoto(q);
          }
          return of(this.filtrarLocal(q));
        }),
      )
      .subscribe({
        next: (rows) => {
          this.loading.set(false);
          this.resultados.set(rows || []);
        },
        error: () => {
          this.loading.set(false);
          this.resultados.set([]);
        },
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['textoInicial']) {
      this.query.set(this.textoInicial || '');
      this.filtrandoActivo.set(false);
    }
    if (changes['opcionesLocales']) {
      const q = this.filtrandoActivo() ? this.query().trim() : '';
      if (this.open() || (this.modoCombo && (this.opcionesLocales?.length ?? 0) > 0 && !this.query().trim())) {
        this.refrescarOpciones(q);
      }
    }
  }

  onInput(v: string): void {
    if (this.disabled) return;
    this.filtrandoActivo.set(true);
    this.query.set(v);
    this.abrirDropdown();
    const q = (v || '').trim();
    if (!q) {
      this.filtrandoActivo.set(false);
      this.limpiado.emit();
      if (this.modoCombo) this.refrescarOpciones('');
      else this.resultados.set([]);
      return;
    }
    if (this.modoCombo || q.length >= this.minLength) this.refrescarOpciones(q);
    else this.resultados.set([]);
  }

  focus(): void {
    if (this.disabled) return;
    this.abrirDropdown();
    if (this.modoCombo) {
      this.filtrandoActivo.set(false);
      this.refrescarOpciones('');
      return;
    }
    const q = this.query().trim();
    if (q.length >= this.minLength) this.q$.next(q);
  }

  toggleOpen(): void {
    if (this.disabled) return;
    if (this.open()) {
      this.cerrarDropdown();
      return;
    }
    this.abrirDropdown();
    if (this.modoCombo) {
      this.filtrandoActivo.set(false);
      this.refrescarOpciones('');
    } else {
      this.refrescarOpciones(this.query().trim());
    }
  }

  pick(opt: EnumBuscarOption): void {
    this.query.set(opt.label);
    this.cerrarDropdown();
    this.filtrandoActivo.set(false);
    this.resultados.set([]);
    this.seleccionado.emit(opt);
  }

  private abrirDropdown(): void {
    if (CatalogoEnumBuscarComponent.instanciaAbierta &&
        CatalogoEnumBuscarComponent.instanciaAbierta !== this) {
      CatalogoEnumBuscarComponent.instanciaAbierta.cerrarDropdown();
    }
    CatalogoEnumBuscarComponent.instanciaAbierta = this;
    this.open.set(true);
  }

  private cerrarDropdown(): void {
    this.open.set(false);
    this.filtrandoActivo.set(false);
    if (CatalogoEnumBuscarComponent.instanciaAbierta === this) {
      CatalogoEnumBuscarComponent.instanciaAbierta = null;
    }
  }

  private refrescarOpciones(q: string): void {
    const filtro =
      this.modoCombo && !this.filtrandoActivo() ? '' : q;
    if (this.remoto) {
      this.loading.set(true);
      this.resultados.set([]);
      this.q$.next(filtro);
      return;
    }
    this.loading.set(false);
    this.resultados.set(this.filtrarLocal(filtro));
  }

  private filtrarLocal(q: string): EnumBuscarOption[] {
    const pool = this.opcionesLocales || [];
    const nq = this.normalizar(q.trim());
    if (!nq) return pool.slice(0, 80);
    return pool.filter((o) => this.coincideBusqueda(nq, o.label, o.hint)).slice(0, 40);
  }

  private normalizar(s: string): string {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private coincideBusqueda(nq: string, label: string, hint?: string): boolean {
    const nl = this.normalizar(label);
    if (nl.startsWith(nq)) return true;
    if (hint && this.normalizar(hint).startsWith(nq)) return true;
    return nl.split(/[\s(/\-]+/).some((w) => w.startsWith(nq));
  }

  @HostListener('document:click', ['$event'])
  outside(ev: MouseEvent): void {
    const t = ev.target as HTMLElement;
    if (!t.closest('.enum-buscar-host')) {
      this.cerrarDropdown();
    }
  }
}
