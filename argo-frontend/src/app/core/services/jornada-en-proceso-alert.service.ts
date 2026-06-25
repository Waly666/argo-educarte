import { Injectable, computed, signal } from '@angular/core';

import { parseCumplimiento } from '../../features/jornadas/jornada-cumplimiento.util';

export interface JornadaEnProcesoAlerta {
  id: string;
  idContrato?: string;
  fechaProgramacion?: string;
  municipio?: string;
  direccion?: string;
  codContrato?: string;
  contratoLabel?: string;
  supervisor?: string;
  numeroAlumnos?: number;
  numeObjeJornada?: number;
  certificadosContrato?: number;
  cumplidoContrato?: boolean;
  certificadosJornada?: number;
  cumplidoJornada?: boolean;
}

@Injectable({ providedIn: 'root' })
export class JornadaEnProcesoAlertService {
  private ocultaManual = signal(false);
  private idsConocidos = new Set<string>();
  private readonly _activas = signal<JornadaEnProcesoAlerta[]>([]);

  readonly activas = this._activas.asReadonly();
  readonly hayActivas = computed(() => this._activas().length > 0);
  readonly visible = computed(() => this.hayActivas() && !this.ocultaManual());
  readonly hayCumplimientoCritico = computed(() =>
    this._activas().some((j) => j.cumplidoContrato || j.cumplidoJornada),
  );

  actualizarDesdeListado(jornadas: Array<Record<string, unknown>> | null | undefined) {
    const rows = (jornadas || []).filter((j) => String(j['estado'] || '').trim() === 'EN PROCESO');
    const activas: JornadaEnProcesoAlerta[] = rows
      .map((j) => {
        const cumpl = parseCumplimiento(j);
        return {
          id: String(j['_id'] || ''),
          idContrato: j['idContrato'] ? String(j['idContrato']) : undefined,
          fechaProgramacion: j['fechaProgramacion'] ? String(j['fechaProgramacion']) : undefined,
          municipio: String(j['municipio'] || '').trim() || undefined,
          direccion: String(j['direccion'] || '').trim() || undefined,
          codContrato: String(j['codContrato'] || '').trim() || undefined,
          contratoLabel: String(j['contratoLabel'] || '').trim() || undefined,
          supervisor: String(j['supervisor'] || '').trim() || undefined,
          numeObjeJornada: Number(j['numeObjeJornada']) || 0,
          ...cumpl,
        };
      })
      .filter((j) => j.id);

    const ids = new Set(activas.map((j) => j.id));

    if (activas.length === 0) {
      this.ocultaManual.set(false);
      this.idsConocidos.clear();
      this._activas.set([]);
      return;
    }

    for (const id of ids) {
      if (!this.idsConocidos.has(id)) {
        this.ocultaManual.set(false);
        break;
      }
    }

    this.idsConocidos = ids;
    this._activas.set(activas);
  }

  cerrar() {
    this.ocultaManual.set(true);
  }
}
