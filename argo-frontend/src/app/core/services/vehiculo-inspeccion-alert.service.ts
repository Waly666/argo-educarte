import { Injectable, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';

import type { AlertasInspeccionPendienteRes } from './inspeccion-vehiculo.service';

@Injectable({ providedIn: 'root' })
export class VehiculoInspeccionAlertService {
  private ocultaManual = signal(false);
  private firmaAnterior = '';
  private readonly _resumen = signal<AlertasInspeccionPendienteRes | null>(null);
  private _refresh = new Subject<void>();

  /** El shell escucha esto para repreguntar alertas sin esperar al intervalo. */
  readonly refresh = this._refresh.asObservable();

  readonly resumen = this._resumen.asReadonly();
  readonly hayAlertas = computed(() => (this._resumen()?.totalPendientes ?? 0) > 0);
  readonly visible = computed(() => this.hayAlertas() && !this.ocultaManual());

  actualizar(data: AlertasInspeccionPendienteRes | null | undefined) {
    const next = data ?? null;
    const firma = next ? `${next.fecha}|${next.totalPendientes}|${next.vehiculosAfectados}` : '';

    if (!next || next.totalPendientes <= 0) {
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

  solicitarActualizacion() {
    this._refresh.next();
  }
}
