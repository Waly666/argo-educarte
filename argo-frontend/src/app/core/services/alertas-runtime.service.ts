import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { ComprobanteHoyTipo } from './comprobante-hoy-alert.service';
import { ConfigAlertasService, ReglaAlerta, VentanaInicioAlerta } from './config-alertas.service';

const FALLBACK: Omit<ReglaAlerta, 'key' | 'label' | 'grupoId' | 'grupoLabel'> = {
  activo: true,
  ventanaInicio: 'desde_registro',
  duracionMinutos: 30,
  intervaloPollSegundos: 60,
  antelacionMinutos: 0,
  diasAntelacion: 0,
  diasGracia: 0,
};

@Injectable({ providedIn: 'root' })
export class AlertasRuntimeService {
  private svc = inject(ConfigAlertasService);
  private mapa = signal<Map<string, ReglaAlerta>>(new Map());
  private listo = signal(false);

  readonly cargado = this.listo.asReadonly();
  /** Dependencia reactiva para computeds que consultan reglas por clave. */
  readonly reglasMap = this.mapa.asReadonly();

  static claveComprobante(tipo: ComprobanteHoyTipo): string {
    if (tipo === 'ingreso') return 'alarmas.alumnos.comprobante_ingreso';
    if (tipo === 'egreso') return 'alarmas.alumnos.comprobante_egreso';
    return 'alarmas.alumnos.factura';
  }

  cargar(): Observable<{ reglas: ReglaAlerta[] }> {
    return this.svc.obtener().pipe(
      tap((r) => {
        const m = new Map<string, ReglaAlerta>();
        for (const regla of r.reglas || []) m.set(regla.key, regla);
        this.mapa.set(m);
        this.listo.set(true);
      }),
    );
  }

  aplicar(reglas: ReglaAlerta[]): void {
    const m = new Map<string, ReglaAlerta>();
    for (const regla of reglas) m.set(regla.key, regla);
    this.mapa.set(m);
    this.listo.set(true);
  }

  regla(key: string): ReglaAlerta {
    const hit = this.mapa().get(key);
    if (hit) return hit;
    return {
      key,
      label: key,
      grupoId: '',
      grupoLabel: '',
      ...FALLBACK,
    };
  }

  activa(key: string): boolean {
    return this.regla(key).activo !== false;
  }

  ventanaInicio(key: string): VentanaInicioAlerta {
    return this.regla(key).ventanaInicio === 'desde_inicio_dia' ? 'desde_inicio_dia' : 'desde_registro';
  }

  duracionMs(key: string): number {
    const m = this.regla(key).duracionMinutos;
    return m > 0 ? m * 60_000 : 0;
  }

  intervaloPollMs(key: string): number {
    const s = this.regla(key).intervaloPollSegundos;
    return s > 0 ? s * 1000 : 60_000;
  }

  antelacionMinutos(key: string): number {
    return Math.max(0, this.regla(key).antelacionMinutos || 0);
  }

  diasAntelacion(key: string): number | undefined {
    const d = this.regla(key).diasAntelacion;
    return d > 0 ? d : undefined;
  }

  diasGracia(key: string): number | undefined {
    const d = this.regla(key).diasGracia;
    return d > 0 ? d : undefined;
  }
}
