import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  AulaVirtualAdminService,
  ProgresoAlumnoVirtualItem,
} from '../../core/services/aula-virtual-admin.service';
import { formatNumDoc } from '../../core/utils/num-doc.helpers';

@Component({
  selector: 'argo-aula-virtual-progreso-alumnos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './aula-virtual-progreso-alumnos.component.html',
  styleUrls: ['./aula-virtual-progreso-alumnos.component.scss'],
})
export class AulaVirtualProgresoAlumnosComponent implements OnChanges {
  private svc = inject(AulaVirtualAdminService);

  @Input({ required: true }) idPrograma!: string;
  @Input() reloadTick = 0;

  loading = signal(false);
  error = signal<string | null>(null);
  items = signal<ProgresoAlumnoVirtualItem[]>([]);
  total = signal(0);
  skip = signal(0);
  readonly limit = 30;

  buscar = '';
  filtro = '';
  expandido = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['idPrograma'] || changes['reloadTick']) {
      this.skip.set(0);
      this.cargar();
    }
  }

  cargar(): void {
    if (!this.idPrograma) return;
    this.loading.set(true);
    this.error.set(null);
    this.svc
      .listarProgresoAlumnos(this.idPrograma, {
        q: this.buscar.trim() || undefined,
        filtro: this.filtro || undefined,
        skip: this.skip(),
        limit: this.limit,
      })
      .subscribe({
        next: (r) => {
          this.items.set(r.items || []);
          this.total.set(r.total || 0);
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(e?.error?.message || 'No se pudo cargar el progreso');
          this.loading.set(false);
        },
      });
  }

  buscarAlumnos(): void {
    this.skip.set(0);
    this.cargar();
  }

  cambiarFiltro(f: string): void {
    this.filtro = f;
    this.skip.set(0);
    this.cargar();
  }

  paginaAnterior(): void {
    const s = Math.max(0, this.skip() - this.limit);
    if (s === this.skip()) return;
    this.skip.set(s);
    this.cargar();
  }

  paginaSiguiente(): void {
    if (this.skip() + this.limit >= this.total()) return;
    this.skip.set(this.skip() + this.limit);
    this.cargar();
  }

  toggleExpand(row: ProgresoAlumnoVirtualItem): void {
    const key = String(row.numDoc);
    this.expandido.update((v) => (v === key ? null : key));
  }

  estaExpandido(row: ProgresoAlumnoVirtualItem): boolean {
    return this.expandido() === String(row.numDoc);
  }

  fmtDoc(n: number | string): string {
    return formatNumDoc(n);
  }

  fmtFecha(iso?: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  }

  claseConexion(codigo: string): string {
    if (codigo === 'en_linea') return 'av-prog-conn--live';
    if (codigo === 'reciente') return 'av-prog-conn--recent';
    if (codigo === 'desconectado') return 'av-prog-conn--off';
    return 'av-prog-conn--none';
  }

  fichaLink(row: ProgresoAlumnoVirtualItem): string[] | null {
    return row.alumnoId ? ['/app/alumnos', row.alumnoId] : null;
  }
}
