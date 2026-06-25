import { Injectable, computed, signal } from '@angular/core';

import type { AlertasDocsFaltantesEmpleadosRes } from './empleado.service';

@Injectable({ providedIn: 'root' })
export class EmpleadoDocsFaltantesAlertService {
  private ocultaManual = signal(false);
  private firmaAnterior = '';
  private readonly _resumen = signal<AlertasDocsFaltantesEmpleadosRes | null>(null);

  readonly resumen = this._resumen.asReadonly();
  readonly hayAlertas = computed(() => (this._resumen()?.totalFaltantes ?? 0) > 0);
  readonly visible = computed(() => this.hayAlertas() && !this.ocultaManual());

  actualizar(data: AlertasDocsFaltantesEmpleadosRes | null | undefined) {
    const next = data ?? null;
    const firma = next
      ? `${next.totalFaltantes}|${next.empleadosAfectados}|${(next.alertas || []).length}`
      : '';

    if (!next || next.totalFaltantes <= 0) {
      this.ocultaManual.set(false);
      this.firmaAnterior = '';
      this._resumen.set(next);
      return;
    }

    if (firma !== this.firmaAnterior) {
      this.ocultaManual.set(false);
    }

    this.firmaAnterior = firma;
    this._resumen.set(next);
  }

  cerrar() {
    this.ocultaManual.set(true);
  }
}
