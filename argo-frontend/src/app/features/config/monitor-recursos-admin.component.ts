import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ActividadService,
  MonitorRecursosResponse,
  UsuarioActivo,
} from '../../core/services/actividad.service';
import { formatBytes, formatUptime, pctBar } from '../../core/utils/monitor-recursos.util';

const REFRESH_MS = 4000;

@Component({
  selector: 'argo-monitor-recursos-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './monitor-recursos-admin.component.html',
  styleUrls: ['./monitor-recursos-admin.component.scss'],
})
export class MonitorRecursosAdminComponent implements OnInit, OnDestroy {
  private actividadSvc = inject(ActividadService);

  loading = signal(true);
  actualizando = signal(false);
  autoRefresh = signal(true);
  ventanaMinutos = signal(10);
  ultimaActualizacion = signal<Date | null>(null);
  data = signal<MonitorRecursosResponse | null>(null);
  error = signal<string | null>(null);

  usuarios = computed(() => this.data()?.usuarios || []);
  sistema = computed(() => this.data()?.sistema || null);
  trafico = computed(() => this.data()?.trafico || null);

  formatBytes = formatBytes;
  formatUptime = formatUptime;
  pctBar = pctBar;

  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.cargar();
    this.iniciarAutoRefresh();
  }

  ngOnDestroy(): void {
    this.detenerAutoRefresh();
  }

  cargar(silent = false): void {
    if (!silent || !this.data()) this.loading.set(true);
    else this.actualizando.set(true);
    this.error.set(null);

    this.actividadSvc.monitor(this.ventanaMinutos()).subscribe({
      next: (r) => {
        this.data.set(r);
        this.ultimaActualizacion.set(new Date());
        this.loading.set(false);
        this.actualizando.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.actualizando.set(false);
        this.error.set(e?.error?.message || 'No se pudo cargar el monitor de recursos.');
      },
    });
  }

  toggleAutoRefresh(): void {
    this.autoRefresh.update((v) => !v);
    this.iniciarAutoRefresh();
  }

  onVentanaChange(): void {
    this.cargar(true);
  }

  trackUsuario(u: UsuarioActivo): string {
    return u.idUsuario || u.usuario || '';
  }

  codigoClase(code?: number): string {
    if (code == null) return '';
    if (code >= 200 && code < 300) return 'ok';
    if (code >= 400) return 'err';
    return '';
  }

  private iniciarAutoRefresh(): void {
    this.detenerAutoRefresh();
    if (!this.autoRefresh()) return;
    this.refreshTimer = setInterval(() => this.cargar(true), REFRESH_MS);
  }

  private detenerAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
