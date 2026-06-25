import { Injectable, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';

import type { AlertasClasesProximasCea, ClaseProximaCeaDto } from './programacion-cea.service';

@Injectable({ providedIn: 'root' })
export class ProgramacionCeaClaseProximaAlertService {
  private ocultaManual = signal(false);
  private idsConocidos = new Set<string>();
  private _data = signal<AlertasClasesProximasCea | null>(null);
  private _refresh = new Subject<void>();

  /** El shell escucha esto para repreguntar alertas sin esperar al intervalo. */
  readonly refresh = this._refresh.asObservable();

  readonly data = this._data.asReadonly();
  readonly clases = computed(() => this._data()?.clases ?? []);
  readonly total = computed(() => this._data()?.total ?? 0);
  readonly minutosVentana = computed(() => this._data()?.minutosVentana ?? 15);
  readonly hayProximas = computed(() => this.total() > 0);
  readonly visible = computed(() => this.hayProximas() && !this.ocultaManual());

  actualizar(data: AlertasClasesProximasCea | null | undefined) {
    const clases = data?.clases ?? [];
    if (!clases.length) {
      this.ocultaManual.set(false);
      this.idsConocidos.clear();
      this._data.set(null);
      return;
    }

    const ids = new Set(clases.map((c) => c._id));
    for (const id of ids) {
      if (!this.idsConocidos.has(id)) {
        this.ocultaManual.set(false);
        break;
      }
    }
    this.idsConocidos = ids;
    this._data.set(data!);
  }

  cerrar() {
    this.ocultaManual.set(true);
  }

  solicitarActualizacion() {
    this._refresh.next();
  }

  resumenClase(c: ClaseProximaCeaDto): string {
    const tipo = c.tipoClase === 'practica' ? 'Práctica' : c.tipoClase === 'taller' ? 'Taller' : 'Teoría';
    const mins =
      c.minutosRestantes != null && c.minutosRestantes > 0
        ? `en ${c.minutosRestantes} min`
        : c.minutosHastaInicio != null && c.minutosHastaInicio < 0
          ? 'pendiente de iniciar'
          : 'ahora';
    const partes = [c.horaDesde, tipo, mins];
    if (c.instructorNombre) partes.push(c.instructorNombre);
    if (c.programaLabel) partes.push(c.programaLabel);
    return partes.filter(Boolean).join(' · ');
  }
}
