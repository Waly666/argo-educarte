import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { formatNumDoc, parseNumDocForApi } from '../utils/num-doc.helpers';
import { AutorizacionSupervisorDto } from './supervisor-auth.types';

export interface CertificadoCrearDto {
  numDoc: number | string;
  idLiquidacion: string;
  idPlantilla?: string;
  numActa?: string;
  numFolio?: string;
  numRunt?: string;
  fechaEmision?: string;
  observaciones?: string;
}

export interface CertificadoActualizarDto {
  /** Regular | Jornada Capacitacion */
  tipoCertificado?: string;
  encabezado?: string;
  numActa?: string;
  numFolio?: string;
  numRunt?: string;
  fechaEmision?: string;
  fechaVencimiento?: string | null;
  observaciones?: string;
  codVerificacion?: string | null;
}

export interface CertificadoListItem {
  _id: string;
  codigoCert?: string;
  codVerificacion?: string | null;
  numDoc?: number;
  alumnoId?: string | null;
  nombreCompleto?: string;
  expedida?: string | null;
  nombreTitular?: string | null;
  encabezado?: string;
  tipoFormatoCert?: string;
  tipoFormatoCertLabel?: string;
  tipoCertificado?: string;
  fechaEmision?: string;
  fechaVencimiento?: string | null;
  estado?: string;
  numActa?: string;
  numFolio?: string;
  numRunt?: string;
  observaciones?: string;
  horasCert?: string;
  generadoAutoJornada?: boolean;
  codContrato?: string | null;
  ubicacionJornada?: string | null;
  programaDescr?: string | null;
  nomCert?: string | null;
  empresaId?: string | null;
  empresaNombre?: string | null;
}

export interface CertificadoListadoRes {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  emitidosHoy: number;
  items: CertificadoListItem[];
}

export interface CertificadosVencidosListadoRes {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  items: CertificadoListItem[];
}

/** Respuesta de GET /certificados/:id/datos (render + edición). */
export interface CertificadoDatosRes {
  certificado: Record<string, unknown> & {
    _id: string;
    codigoCert?: string;
    numDoc?: number;
    encabezado?: string;
    tipoCertificado?: string;
    tipoFormatoCert?: string;
    fechaEmision?: string;
    fechaVencimiento?: string | null;
    estado?: string;
    numActa?: string;
    numFolio?: string;
    numRunt?: string;
    observaciones?: string;
    codVerificacion?: string | null;
  };
  alumno?: {
    _id?: string;
    nombreCompleto?: string;
    nombre1?: string;
    nombre2?: string;
    apellido1?: string;
    apellido2?: string;
    expedida?: string;
  } | null;
  programa?: {
    descripcion?: string;
    nombreProg?: string;
    nomCert?: string;
  } | null;
  tipoFormatoCert?: string;
}

export interface CertificadoVencimientoAlertaItem {
  _id: string;
  codigoCert?: string | null;
  numDoc?: number;
  alumnoId?: string | null;
  nombreCompleto: string;
  celular?: string | null;
  encabezado?: string | null;
  tipoFormatoCert?: string | null;
  tipoFormatoCertLabel?: string | null;
  fechaEmision?: string;
  fechaVencimiento?: string;
  diasRestantes: number;
  diasVencidos?: number;
  nivelUrgencia: 'vencido' | 'hoy' | 'critico' | 'urgente' | 'proximo' | 'aviso';
}

export interface CertificadosVencimientoAlertasRes {
  total: number;
  diasVentana: number;
  venceHoy: number;
  venceManana: number;
  critico: number;
  urgente: number;
  items: CertificadoVencimientoAlertaItem[];
}

export interface CertificadosVencidosAlertasRes {
  total: number;
  diasVentana: number;
  items: CertificadoVencimientoAlertaItem[];
}

@Injectable({ providedIn: 'root' })
export class CertificadoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/certificados`;

  tiposCertificado(): Observable<{ id: string; label: string }[]> {
    return this.http.get<{ id: string; label: string }[]>(`${this.base}/tipos`);
  }

  plantillas(tipo?: string): Observable<any[]> {
    const q = tipo ? `?tipo=${encodeURIComponent(tipo)}` : '';
    return this.http.get<any[]>(`${this.base}/plantillas${q}`);
  }

  elegibles(numDoc: number | string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/elegibles/${encodeURIComponent(formatNumDoc(numDoc))}`);
  }

  listarPorAlumno(numDoc: number | string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/alumno/${encodeURIComponent(formatNumDoc(numDoc))}`);
  }

  /** Todos los certificados emitidos desde una fecha (alertas globales). */
  listarRecientes(desde: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/recientes`, {
      params: { desde },
    });
  }

  /** Listado global paginado con filtros. */
  listarGlobal(params?: {
    q?: string;
    tipoFormatoCert?: string;
    estado?: string;
    empresaId?: string;
    desde?: string;
    hasta?: string;
    page?: number;
    limit?: number;
    cacheBust?: number;
  }): Observable<CertificadoListadoRes> {
    const p = new URLSearchParams();
    if (params?.q?.trim()) p.set('q', params.q.trim());
    if (params?.tipoFormatoCert) p.set('tipoFormatoCert', params.tipoFormatoCert);
    if (params?.estado) p.set('estado', params.estado);
    if (params?.empresaId) p.set('empresaId', params.empresaId);
    if (params?.desde) p.set('desde', params.desde);
    if (params?.hasta) p.set('hasta', params.hasta);
    if (params?.page != null) p.set('page', String(params.page));
    if (params?.limit != null) p.set('limit', String(params.limit));
    p.set('_', String(params?.cacheBust ?? Date.now()));
    const qs = p.toString() ? `?${p}` : '';
    return this.http.get<CertificadoListadoRes>(`${this.base}/listado${qs}`);
  }

  /** Certificados vencidos paginados, ordenados por fecha de vencimiento desc. */
  listarVencidos(params?: {
    q?: string;
    tipoFormatoCert?: string;
    empresaId?: string;
    vencimientoDesde?: string;
    vencimientoHasta?: string;
    page?: number;
    limit?: number;
    cacheBust?: number;
  }): Observable<CertificadosVencidosListadoRes> {
    const p = new URLSearchParams();
    if (params?.q?.trim()) p.set('q', params.q.trim());
    if (params?.tipoFormatoCert) p.set('tipoFormatoCert', params.tipoFormatoCert);
    if (params?.empresaId) p.set('empresaId', params.empresaId);
    if (params?.vencimientoDesde) p.set('vencimientoDesde', params.vencimientoDesde);
    if (params?.vencimientoHasta) p.set('vencimientoHasta', params.vencimientoHasta);
    if (params?.page != null) p.set('page', String(params.page));
    if (params?.limit != null) p.set('limit', String(params.limit));
    p.set('_', String(params?.cacheBust ?? Date.now()));
    const qs = p.toString() ? `?${p}` : '';
    return this.http.get<CertificadosVencidosListadoRes>(`${this.base}/vencidos${qs}`);
  }

  exportarVencidos(params?: {
    q?: string;
    tipoFormatoCert?: string;
    empresaId?: string;
    vencimientoDesde?: string;
    vencimientoHasta?: string;
  }): Observable<Blob> {
    const p = new URLSearchParams();
    if (params?.q?.trim()) p.set('q', params.q.trim());
    if (params?.tipoFormatoCert) p.set('tipoFormatoCert', params.tipoFormatoCert);
    if (params?.empresaId) p.set('empresaId', params.empresaId);
    if (params?.vencimientoDesde) p.set('vencimientoDesde', params.vencimientoDesde);
    if (params?.vencimientoHasta) p.set('vencimientoHasta', params.vencimientoHasta);
    const qs = p.toString() ? `?${p}` : '';
    return this.http.get(`${this.base}/vencidos/exportar${qs}`, {
      responseType: 'blob',
    });
  }

  alertasPorVencer(dias?: number): Observable<CertificadosVencimientoAlertasRes> {
    const q = dias != null ? `?dias=${encodeURIComponent(String(dias))}` : '';
    return this.http.get<CertificadosVencimientoAlertasRes>(`${this.base}/alertas-por-vencer${q}`);
  }

  alertasVencidos(dias?: number): Observable<CertificadosVencidosAlertasRes> {
    const q = dias != null ? `?dias=${encodeURIComponent(String(dias))}` : '';
    return this.http.get<CertificadosVencidosAlertasRes>(`${this.base}/alertas-vencidos${q}`);
  }

  /** @deprecated Use alertasPorVencer */
  alertasVencimiento(dias?: number): Observable<CertificadosVencimientoAlertasRes> {
    return this.alertasPorVencer(dias);
  }

  crear(dto: CertificadoCrearDto): Observable<any> {
    const numDoc = parseNumDocForApi(dto.numDoc);
    return this.http.post(this.base, { ...dto, numDoc: numDoc ?? dto.numDoc });
  }

  /** Datos completos del certificado (alumno, programa, plantilla). */
  obtenerDatos(id: string): Observable<CertificadoDatosRes> {
    return this.http.get<CertificadoDatosRes>(`${this.base}/${encodeURIComponent(id)}/datos`);
  }

  actualizar(id: string, dto: CertificadoActualizarDto): Observable<any> {
    return this.http.put(`${this.base}/${encodeURIComponent(id)}`, dto);
  }

  eliminar(id: string, auth?: AutorizacionSupervisorDto): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}`, { body: auth || {} });
  }

  abrirHtml(id: string, onError?: (msg: string) => void): void {
    const url = `${this.base}/${id}/html?v=${Date.now()}`;
    this.http.get(url, { responseType: 'text' }).subscribe({
      next: (html) => {
        const w = window.open('', '_blank', 'width=900,height=700');
        if (!w) {
          onError?.('Permita ventanas emergentes para imprimir el certificado.');
          return;
        }
        w.document.open();
        w.document.write(html);
        w.document.close();
      },
      error: (e) => onError?.(e?.error?.message || 'No se pudo generar el certificado.'),
    });
  }
}
