import { Injectable, computed, signal } from '@angular/core';

import type { AlertasDocsFaltantesVehiculosRes } from './vehiculo.service';

@Injectable({ providedIn: 'root' })
export class VehiculoDocsFaltantesAlertService {
  private ocultaManual = signal(false);
  private firmaAnterior = '';
  private readonly _resumen = signal<AlertasDocsFaltantesVehiculosRes | null>(null);

  readonly resumen = this._resumen.asReadonly();
  readonly hayAlertas = computed(() => (this._resumen()?.totalFaltantes ?? 0) > 0);
  readonly visible = computed(() => this.hayAlertas() && !this.ocultaManual());

  actualizar(data: AlertasDocsFaltantesVehiculosRes | null | undefined) {
    const next = data ?? null;
    const firma = next
      ? `${next.totalFaltantes}|${next.vehiculosAfectados}|${(next.alertas || []).length}`
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
