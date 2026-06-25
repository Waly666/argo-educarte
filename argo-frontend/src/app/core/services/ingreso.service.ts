import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { formatNumDoc, parseNumDocForApi } from '../utils/num-doc.helpers';
import { AutorizacionSupervisorDto } from './supervisor-auth.types';

export interface IngresoItemPagoDto {
  idLiquidacion: string;
  valor: number;
}

export interface IngresoCrearDto {
  numDoc: number | string;
  /** Pago de un solo ítem (compatibilidad). */
  idLiquidacion?: string;
  valor?: number;
  /** Pago de varios ítems en un mismo comprobante. */
  items?: IngresoItemPagoDto[];
  idTipoPago: string;
  idBanco?: string;
  idCuentaBancaria?: string;
  numComprobante?: string;
  fecha?: string;
  observaciones?: string;
}

export interface IngresoCajaCrearDto {
  idTipoIngreso: string | number;
  valor: number;
  idTipoPago: string;
  concepto: string;
  recibidoDe?: string;
  documentoTercero?: string;
  tipoPersona?: 'natural' | 'juridica';
  idBanco?: string;
  idCuentaBancaria?: string;
  numComprobante?: string;
  fecha?: string;
  observaciones?: string;
}

@Injectable({ providedIn: 'root' })
export class IngresoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/ingresos`;

  urlArchivo(path?: string | null): string | null {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${environment.uploadsUrl}/${path.replace(/^\/+/, '')}`;
  }

  crear(dto: IngresoCrearDto, soporte?: File | null): Observable<any> {
    const numDoc = parseNumDocForApi(dto.numDoc);
    const payload = { ...dto, numDoc: numDoc ?? dto.numDoc };
    if (soporte) {
      return this.http.post(this.base, this.toFormData(payload, soporte));
    }
    return this.http.post(this.base, payload);
  }

  crearCaja(dto: IngresoCajaCrearDto, soporte?: File | null): Observable<any> {
    if (soporte) {
      return this.http.post(this.base, this.toFormData(dto, soporte));
    }
    return this.http.post(this.base, dto);
  }

  private toFormData(dto: object, soporte: File): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(dto)) {
      if (v === undefined || v === null || v === '') continue;
      if (k === 'items' && Array.isArray(v)) {
        fd.append(k, JSON.stringify(v));
        continue;
      }
      fd.append(k, String(v));
    }
    fd.append('soporte', soporte, soporte.name);
    return fd;
  }

  listarPorAlumno(numDoc: number | string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/alumno/${encodeURIComponent(formatNumDoc(numDoc))}`);
  }

  listarPorLiquidacion(idLiquidacion: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/liquidacion/${idLiquidacion}`);
  }

  eliminar(id: string, auth?: AutorizacionSupervisorDto): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}`, { body: auth || {} });
  }

  listarTodosAdmin(opts?: {
    q?: string;
    numDoc?: string;
    desde?: string;
    hasta?: string;
    idSesion?: number;
    skip?: number;
    limit?: number;
  }): Observable<{ items: any[]; total: number; skip: number; limit: number; totalValor: number }> {
    let params = new HttpParams();
    if (opts?.q) params = params.set('q', opts.q);
    if (opts?.numDoc) params = params.set('numDoc', opts.numDoc);
    if (opts?.desde) params = params.set('desde', opts.desde);
    if (opts?.hasta) params = params.set('hasta', opts.hasta);
    if (opts?.idSesion != null) params = params.set('idSesion', String(opts.idSesion));
    if (opts?.skip != null) params = params.set('skip', String(opts.skip));
    if (opts?.limit != null) params = params.set('limit', String(opts.limit));
    return this.http.get<{ items: any[]; total: number; skip: number; limit: number; totalValor: number }>(
      `${this.base}/admin/todos`,
      { params },
    );
  }
}
