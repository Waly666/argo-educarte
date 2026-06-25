import { Injectable, computed, signal } from '@angular/core';

import type { AlertasPendientesCea, FilaRastreoCea } from './programacion-cea.service';

@Injectable({ providedIn: 'root' })
export class ProgramacionCeaPendienteAlertService {
  private ocultaManual = signal(false);
  private _data = signal<AlertasPendientesCea | null>(null);

  readonly data = this._data.asReadonly();
  readonly total = computed(() => this._data()?.total ?? 0);
  readonly items = computed(() => this._data()?.items ?? []);
  readonly alertasPrograma = computed(() => this._data()?.alertasPrograma ?? []);
  readonly hayPendientes = computed(() => this.total() > 0);
  readonly visible = computed(() => this.hayPendientes() && !this.ocultaManual());

  actualizar(data: AlertasPendientesCea | null | undefined) {
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

  resumenItem(f: FilaRastreoCea): string {
    const partes = [
      f.alumnoNombre || `Doc ${f.numDoc}`,
      f.servicioLabel,
      `${f.pendientes} h pend.`,
    ].filter(Boolean);
    return partes.join(' · ');
  }
}
