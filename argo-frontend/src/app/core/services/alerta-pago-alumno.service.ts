import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

import { environment } from '../../../environments/environment';

export type AlertaPagoFrecuencia = 'quincenal' | 'mensual';

export interface AlertaPagoAlumnoItem {
  alumnoId: string;
  numDoc: number | string;
  nombreCompleto: string;
  celular?: string | null;
  alertaPagoFrecuencia: AlertaPagoFrecuencia;
  alertaPago: string;
}

@Injectable({ providedIn: 'root' })
export class AlertaPagoAlumnoService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/alumnos`;

  private readonly _items = signal<AlertaPagoAlumnoItem[]>([]);
  private ocultaManual = signal(false);
  private idsConocidos = new Set<string>();

  readonly items = this._items.asReadonly();
  readonly visibleBanner = computed(() => this._items().length > 0 && !this.ocultaManual());

  cargar() {
    return this.http.get<AlertaPagoAlumnoItem[]>(`${this.base}/alertas-pago-hoy`).pipe(
      tap((rows) => this.aplicarItems(rows || [])),
    );
  }

  limpiar() {
    this.ocultaManual.set(false);
    this.idsConocidos.clear();
    this._items.set([]);
  }

  cerrar() {
    this.ocultaManual.set(true);
  }

  etiquetaFrecuencia(f: AlertaPagoFrecuencia): string {
    return f === 'quincenal' ? 'Quincenal' : 'Mensual';
  }

  private aplicarItems(rows: AlertaPagoAlumnoItem[]) {
    const ids = new Set(rows.map((r) => r.alumnoId));

    if (rows.length === 0) {
      this.ocultaManual.set(false);
      this.idsConocidos.clear();
      this._items.set([]);
      return;
    }

    for (const id of ids) {
      if (!this.idsConocidos.has(id)) {
        this.ocultaManual.set(false);
        break;
      }
    }

    this.idsConocidos = ids;
    this._items.set(rows);
  }
}
