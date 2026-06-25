import { CommonModule, DatePipe } from '@angular/common';
import { ArgoDateInputComponent } from '../../shared/argo-date-input/argo-date-input.component';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ActividadService,
  FiltrosHistorialActividad,
  RegistroActividadHttp,
  UsuarioActivo,
} from '../../core/services/actividad.service';
import {
  AuditoriaService,
  FiltrosAuditoria,
  RegistroAuditoria,
} from '../../core/services/auditoria.service';
import { readVistaLista, saveVistaLista, VistaLista } from '../../core/utils/vista-lista.helpers';

type TabMonitoreo = 'enLinea' | 'historial' | 'cambios';

const REFRESH_MS = 3000;

@Component({
  selector: 'argo-auditoria-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe,
    ArgoDateInputComponent,
  ],
  templateUrl: './auditoria-admin.component.html',
  styleUrls: ['./auditoria-admin.component.scss'],
})
export class AuditoriaAdminComponent implements OnInit, OnDestroy {
  private auditoriaSvc = inject(AuditoriaService);
  private actividadSvc = inject(ActividadService);

  tab = signal<TabMonitoreo>('enLinea');
  autoRefresh = signal(true);
  ultimaActualizacion = signal<Date | null>(null);
  actualizando = signal(false);

  activos = signal<UsuarioActivo[]>([]);
  ventanaMinutos = signal(10);
  cargandoActivos = signal(false);

  historialItems = signal<RegistroActividadHttp[]>([]);
  historialTotal = signal(0);
  historialPage = signal(1);
  historialPages = signal(1);
  cargandoHistorial = signal(false);
  filtrosHistorial: FiltrosHistorialActividad = { limit: 80, page: 1 };

  items = signal<RegistroAuditoria[]>([]);
  total = signal(0);
  page = signal(1);
  pages = signal(1);
  cargando = signal(false);
  detalle = signal<RegistroAuditoria | null>(null);
  vista = signal<VistaLista>(readVistaLista('argo-auditoria-vista'));

  filtros: FiltrosAuditoria = { limit: 50, page: 1 };

  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.cargarTab();
    this.iniciarAutoRefresh();
  }

  ngOnDestroy(): void {
    this.detenerAutoRefresh();
  }

  setTab(t: TabMonitoreo): void {
    this.tab.set(t);
    this.cargarTab();
    this.iniciarAutoRefresh();
  }

  toggleAutoRefresh(): void {
    this.autoRefresh.update((v) => !v);
    this.iniciarAutoRefresh();
  }

  private iniciarAutoRefresh(): void {
    this.detenerAutoRefresh();
    if (!this.autoRefresh()) return;
    this.refreshTimer = setInterval(() => this.tickTiempoReal(), REFRESH_MS);
  }

  private tickTiempoReal(): void {
    const t = this.tab();
    if (t === 'enLinea') this.cargarActivos(true);
    else if (t === 'historial' && this.historialPage() === 1) this.cargarHistorial(true);
  }

  private detenerAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  cargarTab(): void {
    if (this.tab() === 'enLinea') this.cargarActivos();
    else if (this.tab() === 'historial') this.cargarHistorial();
    else this.cargar();
  }

  cargarActivos(silent = false): void {
    const primeraVez = !this.activos().length;
    if (!silent || primeraVez) this.cargandoActivos.set(true);
    else this.actualizando.set(true);

    this.actividadSvc.activos(this.ventanaMinutos()).subscribe({
      next: (r) => {
        this.activos.set(r.usuarios);
        this.ultimaActualizacion.set(new Date());
        this.cargandoActivos.set(false);
        this.actualizando.set(false);
      },
      error: () => {
        this.cargandoActivos.set(false);
        this.actualizando.set(false);
      },
    });
  }

  cargarHistorial(silent = false): void {
    const primeraVez = !this.historialItems().length;
    if (!silent || primeraVez) this.cargandoHistorial.set(true);
    else this.actualizando.set(true);

    this.filtrosHistorial.page = this.historialPage();
    this.actividadSvc.historial(this.filtrosHistorial).subscribe({
      next: (r) => {
        this.historialItems.set(r.items);
        this.historialTotal.set(r.total);
        this.historialPages.set(r.pages);
        this.ultimaActualizacion.set(new Date());
        this.cargandoHistorial.set(false);
        this.actualizando.set(false);
      },
      error: () => {
        this.cargandoHistorial.set(false);
        this.actualizando.set(false);
      },
    });
  }

  historialAnterior(): void {
    if (this.historialPage() <= 1) return;
    this.historialPage.update((p) => p - 1);
    this.cargarHistorial();
  }

  historialSiguiente(): void {
    if (this.historialPage() >= this.historialPages()) return;
    this.historialPage.update((p) => p + 1);
    this.cargarHistorial();
  }

  buscarHistorial(): void {
    this.historialPage.set(1);
    this.cargarHistorial();
  }

  cargar(): void {
    this.cargando.set(true);
    this.filtros.page = this.page();
    this.auditoriaSvc.listar(this.filtros).subscribe({
      next: (r) => {
        this.items.set(r.items);
        this.total.set(r.total);
        this.pages.set(r.pages);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  setVista(v: VistaLista): void {
    this.vista.set(v);
    saveVistaLista('argo-auditoria-vista', v);
  }

  verDetalle(row: RegistroAuditoria): void {
    this.detalle.set(row);
    this.auditoriaSvc.obtener(row.idAuditoria).subscribe({
      next: (d) => this.detalle.set(d),
    });
  }

  cerrarDetalle(): void {
    this.detalle.set(null);
  }

  paginaAnterior(): void {
    if (this.page() <= 1) return;
    this.page.update((p) => p - 1);
    this.cargar();
  }

  paginaSiguiente(): void {
    if (this.page() >= this.pages()) return;
    this.page.update((p) => p + 1);
    this.cargar();
  }

  codigoClase(code?: number): string {
    if (!code) return '';
    if (code >= 500) return 'http-5xx';
    if (code >= 400) return 'http-4xx';
    return 'http-ok';
  }

  json(v: unknown): string {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v);
    }
  }
}
