import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { parseNumDocForApi } from '../utils/num-doc.helpers';
import type { MatriculaCrearRes } from './matricula.service';

export interface ConfigMigracion {
  movimientosHabilitados: boolean;
  prefijoRecibo: string;
}

export interface EstadoMigracionMovimientos extends ConfigMigracion {
  habilitado: boolean;
  puedeUsar: boolean;
  motivo?: string | null;
}

export interface MatriculaHistoricaDto {
  numDoc: number | string;
  idPrograma: string;
  tarifa?: number;
  tarifaManual?: boolean;
  fechaMat: string;
  semestreHasta?: number | null;
  observaciones?: string;
  /** Valor total histórico del curso (puede diferir del catálogo actual). */
  valorHistorico?: number;
  ajustarValor?: boolean;
  valorAcordado?: number;
  motivoAjuste?: string;
  /** Cuotas por semestre (presencial/mixta; migración histórica). */
  ajustarCuotasSemestre?: boolean;
  valoresCuotasSemestre?: number[];
  motivoAjusteCuotas?: string;
}

export interface PagoMigracionDto {
  numDoc: number | string;
  idLiquidacion?: string;
  items?: { idLiquidacion: string; valor: number }[];
  valor?: number;
  numRecibo?: string;
  fecha: string;
  formaPago?: string;
  observaciones?: string;
  concepto?: string;
}

export interface PagoMigracionRes {
  ingreso: Record<string, unknown>;
  numRecibo: string;
  total: number;
  liquidaciones: {
    id: string;
    descripcion?: string;
    abonado: number;
    saldo: number;
    estado: string;
  }[];
}

@Injectable({ providedIn: 'root' })
export class MigracionMovimientosService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/migracion`;

  estado(): Observable<EstadoMigracionMovimientos> {
    return this.http.get<EstadoMigracionMovimientos>(`${this.base}/estado`);
  }

  obtenerConfig(): Observable<ConfigMigracion> {
    return this.http.get<ConfigMigracion>(`${this.base}/config`);
  }

  guardarConfig(cfg: Partial<ConfigMigracion>): Observable<ConfigMigracion> {
    return this.http.put<ConfigMigracion>(`${this.base}/config`, cfg);
  }

  matriculaHistorica(dto: MatriculaHistoricaDto): Observable<MatriculaCrearRes> {
    const numDoc = parseNumDocForApi(dto.numDoc);
    return this.http.post<MatriculaCrearRes>(`${this.base}/matricula`, { ...dto, numDoc: numDoc ?? dto.numDoc });
  }

  pagoMigracion(dto: PagoMigracionDto): Observable<PagoMigracionRes> {
    const numDoc = parseNumDocForApi(dto.numDoc);
    return this.http.post<PagoMigracionRes>(`${this.base}/pago`, { ...dto, numDoc: numDoc ?? dto.numDoc });
  }
}
