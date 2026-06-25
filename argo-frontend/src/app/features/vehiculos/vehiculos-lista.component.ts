import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, switchMap } from 'rxjs';

import { VehiculoListItem, VehiculoService } from '../../core/services/vehiculo.service';
import {
  capClaseVehi,
  capColorVehi,
  capEstadoVehiculo,
  capId,
  capLineaVehi,
  capMarcaVehi,
  capModeloVehi,
  capPlaca,
  capTipoServicioVehi,
} from '../../core/utils/capsule.util';
import { readVistaLista, saveVistaLista, VistaLista } from '../../core/utils/vista-lista.helpers';

type SortCol = 'placa' | 'marca' | 'linea' | 'modelo' | 'clase' | 'color' | 'estado';
type SortDir = 'asc' | 'desc';

const VISTA_STORAGE_KEY = 'argo-vehiculos-vista';
const SORT_STORAGE_KEY = 'argo-vehiculos-sort';

const SORT_COLUMNS: ReadonlyArray<{ key: SortCol; label: string }> = [
  { key: 'placa', label: 'Placa' },
  { key: 'marca', label: 'Marca' },
  { key: 'linea', label: 'Línea' },
  { key: 'modelo', label: 'Modelo' },
  { key: 'clase', label: 'Clase' },
  { key: 'color', label: 'Color' },
  { key: 'estado', label: 'Estado' },
];

function readSortPrefs(): { col: SortCol; dir: SortDir } {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY);
    if (!raw) return { col: 'placa', dir: 'asc' };
    const parsed = JSON.parse(raw) as { col?: string; dir?: string };
    const col = SORT_COLUMNS.some((c) => c.key === parsed.col) ? (parsed.col as SortCol) : 'placa';
    const dir: SortDir = parsed.dir === 'desc' ? 'desc' : 'asc';
    return { col, dir };
  } catch {
    return { col: 'placa', dir: 'asc' };
  }
}

function saveSortPrefs(col: SortCol, dir: SortDir): void {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ col, dir }));
  } catch {
    /* ignore */
  }
}

@Component({
  selector: 'argo-vehiculos-lista',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vehiculos-lista.component.html',
  styleUrls: ['./vehiculos-lista.component.scss'],
})
export class VehiculosListaComponent implements OnInit {
  private svc = inject(VehiculoService);
  private router = inject(Router);

  sortColumns = SORT_COLUMNS;

  query = signal('');
  page = signal(0);
  pageSize = 25;
  vista = signal<VistaLista>(readVistaLista(VISTA_STORAGE_KEY));
  sortCol = signal<SortCol>('placa');
  sortDir = signal<SortDir>('asc');

  loading = signal(false);
  items = signal<VehiculoListItem[]>([]);
  total = signal(0);

  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  pageLabel = computed(() => {
    const t = this.total();
    if (t === 0) return '0 vehículos';
    const from = this.page() * this.pageSize + 1;
    const to = Math.min((this.page() + 1) * this.pageSize, t);
    return `${from}–${to} de ${t}`;
  });

  private load$ = new Subject<{ q: string; page: number; sort: SortCol; dir: SortDir }>();

  ngOnInit(): void {
    const sortPrefs = readSortPrefs();
    this.sortCol.set(sortPrefs.col);
    this.sortDir.set(sortPrefs.dir);

    this.load$
      .pipe(
        debounceTime(280),
        switchMap(({ q, page, sort, dir }) => {
          this.loading.set(true);
          return this.svc.listar({
            q,
            page: page + 1,
            limit: this.pageSize,
            sort,
            dir,
          });
        }),
      )
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.items.set(res.items || []);
          this.total.set(res.total ?? 0);
        },
        error: () => {
          this.loading.set(false);
          this.items.set([]);
          this.total.set(0);
        },
      });

    this.cargar();
  }

  cargar(): void {
    this.load$.next({
      q: this.query().trim(),
      page: this.page(),
      sort: this.sortCol(),
      dir: this.sortDir(),
    });
  }

  onBuscar(v: string): void {
    this.query.set(v);
    this.page.set(0);
    this.cargar();
  }

  setVista(v: VistaLista): void {
    this.vista.set(v);
    saveVistaLista(VISTA_STORAGE_KEY, v);
  }

  toggleSort(col: SortCol): void {
    if (this.sortCol() === col) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortCol.set(col);
      this.sortDir.set('asc');
    }
    saveSortPrefs(this.sortCol(), this.sortDir());
    this.page.set(0);
    this.cargar();
  }

  sortIcon(col: SortCol): string {
    if (this.sortCol() !== col) return '↕';
    return this.sortDir() === 'asc' ? '▲' : '▼';
  }

  sortAria(col: SortCol): string | null {
    if (this.sortCol() !== col) return null;
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  paginaAnterior(): void {
    if (this.page() <= 0) return;
    this.page.update((p) => p - 1);
    this.cargar();
  }

  paginaSiguiente(): void {
    if (this.page() >= this.totalPages() - 1) return;
    this.page.update((p) => p + 1);
    this.cargar();
  }

  nuevo(): void {
    void this.router.navigate(['/app/vehiculos/nuevo']);
  }

  abrir(v: VehiculoListItem): void {
    if (!v?._id) return;
    void this.router.navigate(['/app/vehiculos', v._id]);
  }

  abrirTab(v: VehiculoListItem, tab: 'documentos' | 'inspeccion', ev: Event): void {
    ev.stopPropagation();
    if (!v?._id) return;
    void this.router.navigate(['/app/vehiculos', v._id], { queryParams: { tab } });
  }

  tieneAlarmas(v: VehiculoListItem): boolean {
    const i = v.indicadores;
    if (!i) return false;
    return !!(
      i.docsVencidos ||
      i.docsPorVencer ||
      i.docsFaltantes ||
      i.inspeccionPendiente ||
      i.ocupado
    );
  }

  tituloDocsVencidos(v: VehiculoListItem): string {
    const n = v.indicadores?.docsVencidos ?? 0;
    return n ? `${n} documento(s) vencido(s)` : '';
  }

  tieneAlarmaVencimientoDocs(v: VehiculoListItem): boolean {
    const i = v.indicadores;
    return !!((i?.docsVencidos ?? 0) + (i?.docsPorVencer ?? 0));
  }

  tituloVencimientoDocs(v: VehiculoListItem): string {
    const venc = v.indicadores?.docsVencidos ?? 0;
    const pronto = v.indicadores?.docsPorVencer ?? 0;
    const partes: string[] = [];
    if (venc) partes.push(`${venc} vencido(s)`);
    if (pronto) partes.push(`${pronto} por vencer o sin fecha`);
    return partes.length ? `Documentos del vehículo: ${partes.join(' · ')}. Pulse para revisar.` : '';
  }

  etiquetaVencimientoDocs(v: VehiculoListItem): string {
    return (v.indicadores?.docsVencidos ?? 0) > 0 ? 'Vencido' : 'Vence';
  }

  iconoVencimientoDocs(v: VehiculoListItem): string {
    return (v.indicadores?.docsVencidos ?? 0) > 0 ? '!' : '⏱';
  }

  tituloDocsPorVencer(v: VehiculoListItem): string {
    const n = v.indicadores?.docsPorVencer ?? 0;
    return n ? `${n} documento(s) por vencer (30 días)` : '';
  }

  tituloDocsFaltantes(v: VehiculoListItem): string {
    const n = v.indicadores?.docsFaltantes ?? 0;
    if (!n) return '';
    if (v.indicadores?.sinClase) {
      return `${n} documento(s) requeridos sin registrar (sin clase asignada)`;
    }
    return `${n} documento(s) requeridos sin registrar para la clase del vehículo`;
  }

  tituloOcupado(v: VehiculoListItem): string {
    return v.indicadores?.ocupado ? 'Vehículo ocupado en programación' : '';
  }

  tituloInspeccionPendiente(v: VehiculoListItem): string {
    if (!v.indicadores?.inspeccionPendiente) return '';
    const f = v.indicadores.inspeccionFecha;
    return f
      ? `Sin inspección preoperacional del ${f}. Pulse para diligenciar.`
      : 'Sin inspección preoperacional del día. Pulse para diligenciar.';
  }

  capPlaca = capPlaca;
  capId = capId;
  capMarcaVehi = capMarcaVehi;
  capLineaVehi = capLineaVehi;
  capModeloVehi = capModeloVehi;
  capClaseVehi = capClaseVehi;
  capColorVehi = capColorVehi;
  capEstadoVehiculo = capEstadoVehiculo;
  capTipoServicioVehi = capTipoServicioVehi;
}
