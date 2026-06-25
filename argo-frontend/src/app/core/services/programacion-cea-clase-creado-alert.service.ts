import { Injectable, computed, signal } from '@angular/core';

import type { AlertaClaseCeaCreadoItem, AlertasClasesCreadoCea } from './programacion-cea.service';

@Injectable({ providedIn: 'root' })
export class ProgramacionCeaClaseCreadoAlertService {
  private ocultaManual = signal(false);
  private _data = signal<AlertasClasesCreadoCea | null>(null);

  readonly data = this._data.asReadonly();
  readonly items = computed(() => this._data()?.items ?? []);
  readonly total = computed(() => this._data()?.total ?? 0);
  readonly totalClases = computed(() => this._data()?.totalClases ?? 0);
  readonly hayPendientes = computed(() => this.total() > 0);
  readonly visible = computed(() => this.hayPendientes() && !this.ocultaManual());

  actualizar(data: AlertasClasesCreadoCea | null | undefined) {
    if (!data || data.total <= 0) {
      this.ocultaManual.set(false);
      this._data.set(null);
      return;
    }
    this.ocultaManual.set(false);
    this._data.set(data);
  }

  cerrar() {
    this.ocultaManual.set(true);
  }

  tituloItem(item: AlertaClaseCeaCreadoItem): string {
    const progs = item.programasCeaCreado || [];
    if (!progs.length) {
      const n = item.clasesCeaCreado;
      return n
        ? `Pendiente programar clase licencia — ${item.alumnoNombre} (${n} clase${n > 1 ? 's' : ''})`
        : '';
    }
    const detalle = progs
      .map((p) => {
        const suf = p.cantidad > 1 ? ` (${p.cantidad} clases)` : '';
        return `${p.programaLabel}${suf}`;
      })
      .join(', ');
    return `Pendiente programar clase licencia ${detalle} — ${item.alumnoNombre}`;
  }
}
