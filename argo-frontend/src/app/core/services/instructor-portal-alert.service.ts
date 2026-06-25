import { Injectable, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';

import type { AlertasInstructorPortal, ClaseInstructorPortalDto } from './instructor-portal.service';

const STORAGE_ASIGNADAS = 'argo_instructor_asignadas_vistas';

@Injectable({ providedIn: 'root' })
export class InstructorPortalAlertService {
  private ocultaProxima = signal(false);
  private ocultaAsignadas = signal(false);
  private ocultaInspeccion = signal(false);
  private _data = signal<AlertasInstructorPortal | null>(null);
  private _refresh = new Subject<void>();

  readonly refresh = this._refresh.asObservable();
  readonly data = this._data.asReadonly();

  readonly proximas = computed(() => this._data()?.proximas ?? []);
  readonly totalProximas = computed(() => this._data()?.totalProximas ?? 0);
  readonly minutosVentana = computed(() => this._data()?.minutosVentana ?? 20);

  readonly asignadasNuevas = computed(() => {
    const rows = this._data()?.asignadasRecientes ?? [];
    const vistos = this.idsAsignadasVistas();
    return rows.filter((c) => c._id && !vistos.has(`${c.origen}:${c._id}`));
  });

  readonly totalAsignadasNuevas = computed(() => this.asignadasNuevas().length);

  readonly inspeccion = computed(() => this._data()?.inspeccion ?? null);
  readonly inspeccionRequerida = computed(() => !!this.inspeccion()?.requerida);

  readonly hayProxima = computed(() => this.totalProximas() > 0);
  readonly bannerProximaVisible = computed(() => this.hayProxima() && !this.ocultaProxima());
  readonly bannerAsignadasVisible = computed(() => this.totalAsignadasNuevas() > 0 && !this.ocultaAsignadas());
  readonly bannerInspeccionVisible = computed(() => this.inspeccionRequerida() && !this.ocultaInspeccion());

  readonly hayAlertasActivas = computed(
    () => this.bannerProximaVisible() || this.bannerAsignadasVisible() || this.bannerInspeccionVisible(),
  );

  actualizar(data: AlertasInstructorPortal | null | undefined) {
    const prox = data?.proximas ?? [];
    if (prox.length) this.ocultaProxima.set(false);
    if (data?.inspeccion?.requerida) this.ocultaInspeccion.set(false);
    this._data.set(data ?? null);
  }

  cerrarProxima() {
    this.ocultaProxima.set(true);
  }

  cerrarAsignadas() {
    this.marcarAsignadasVistas(this.asignadasNuevas());
    this.ocultaAsignadas.set(true);
  }

  cerrarInspeccion() {
    this.ocultaInspeccion.set(false);
  }

  ocultarInspeccionTemporal() {
    this.ocultaInspeccion.set(true);
  }

  solicitarActualizacion() {
    this._refresh.next();
  }

  resumenClase(c: ClaseInstructorPortalDto & { minutosRestantes?: number }): string {
    const tipo = c.tipoClase === 'practica' ? 'Práctica' : c.tipoClase === 'taller' ? 'Taller' : c.tipoClase === 'teoria' ? 'Teoría' : 'Clase';
    const mins =
      c.minutosRestantes != null && c.minutosRestantes > 0 ? `en ${c.minutosRestantes} min` : c.horaDesde || '';
    return [c.horaDesde, tipo, mins, c.programaLabel || c.temaNombre].filter(Boolean).join(' · ');
  }

  private idsAsignadasVistas(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_ASIGNADAS);
      if (!raw) return new Set();
      const arr = JSON.parse(raw) as string[];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }

  marcarAsignadasVistas(clases: ClaseInstructorPortalDto[]) {
    const set = this.idsAsignadasVistas();
    for (const c of clases) {
      if (c._id) set.add(`${c.origen}:${c._id}`);
    }
    const arr = [...set].slice(-200);
    localStorage.setItem(STORAGE_ASIGNADAS, JSON.stringify(arr));
  }
}
