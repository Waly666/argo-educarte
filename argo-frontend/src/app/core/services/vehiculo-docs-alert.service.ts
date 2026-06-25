import { Injectable, computed, signal } from '@angular/core';

import type { AlertasDocumentosVehiculosRes } from './vehiculo.service';

@Injectable({ providedIn: 'root' })
export class VehiculoDocsAlertService {
  private ocultaManual = signal(false);
  private firmaAnterior = '';
  private readonly _resumen = signal<AlertasDocumentosVehiculosRes | null>(null);

  readonly resumen = this._resumen.asReadonly();
  readonly hayAlertas = computed(() => (this._resumen()?.totalAlertas ?? 0) > 0);
  readonly visible = computed(() => this.hayAlertas() && !this.ocultaManual());

  actualizar(data: AlertasDocumentosVehiculosRes | null | undefined) {
    const next = data ?? null;
    const firma = next
      ? `${next.totalAlertas}|${next.docsVencidos}|${next.docsPorVencer}|${next.vehiculosAfectados}`
      : '';

    if (!next || next.totalAlertas <= 0) {
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
