import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { formatNumDoc, parseNumDocForApi } from '../utils/num-doc.helpers';
import type { DocumentosRequeridosRes, ValidacionDocumentosRes } from './config-requisitos-documentos.service';
import type { AlertaPagoAlumnoItem } from './alerta-pago-alumno.service';

/** Esquema datosAlumnos — _id es idAlumno en Mongo */
export interface AlumnoDto {
  _id?: string;
  fechaReg?: string | Date;
  /** Regular | Jornada Capacitacion */
  tipoAlumno?: string;
  tipoDoc?: string;
  /** En BD/API es número; en formulario de edición suele mostrarse como string */
  numDoc: number | string;
  expedida?: string;
  apellido1: string;
  apellido2?: string;
  nombre1: string;
  nombre2?: string;
  fechaNac?: string | null;
  observaciones?: string;
  genero?: string;
  tipoSangre?: string;
  jornada?: string;
  estadoCivil?: string;
  estrato?: string;
  regimenSalud?: string;
  nivelFormacion?: string;
  ocupacion?: string;
  discapacidad?: string;
  munOrigen?: string;
  /** Código divipola; debe coincidir con munOrigen */
  codMunicipio?: string;
  correo?: string;
  direccion?: string;
  celular?: string;
  multiCulturalidad?: string;
  urlFoto?: string;
  urlCedula?: string;
  urlLicencia?: string;
  docsAlumno?: Record<string, string>;
  fechaAudi?: string;
  userAddReg?: string;
  userChangeRecord?: string;
  fechaMod?: string;
  /** Horas por sesión de práctica CEA al auto-generar (1–4). null = automático. */
  duracionSesionPracticaCea?: number | null;
  /** ID del cliente (empresa de transporte) al que pertenece el alumno. */
  empresaId?: string | null;
  /** Recordatorio de cobro recurrente (técnicos / cuotas). */
  alertaPago?: string | null;
  alertaPagoFrecuencia?: 'quincenal' | 'mensual' | '' | null;
  empresaNombre?: string | null;
}

export interface MovimientoAlarmaHoy {
  id: string;
  numRecibo?: string | null;
  valor: number;
  detalle?: string | null;
  formaPago?: string | null;
  tipoPago?: string | null;
  numComprobante?: string | null;
  fecha?: string | null;
}

export interface FacturaAlarmaHoy {
  id: string;
  numeroFactura?: string | null;
  valor: number;
  estado?: string | null;
  fecha?: string | null;
}

export interface AlumnoListItem {
  _id: string;
  /** En BD/API es número; en formulario de edición suele mostrarse como string */
  numDoc: number | string;
  tipoDoc?: string;
  expedida?: string;
  nombre1?: string;
  nombre2?: string;
  apellido1?: string;
  apellido2?: string;
  nombres?: string;
  apellidos?: string;
  nombreCompleto?: string;
  fechaNac?: string | Date | null;
  genero?: string;
  tipoSangre?: string;
  jornada?: string;
  jornadaLabel?: string;
  estadoCivil?: string;
  estadoCivilLabel?: string;
  estrato?: string;
  celular?: string;
  correo?: string;
  direccion?: string;
  munOrigen?: string;
  codMunicipio?: string;
  munOrigenLabel?: string;
  nombreMunicipio?: string;
  nombreDepto?: string;
  urlFoto?: string;
  urlCedula?: string;
  urlLicencia?: string;
  docsAlumno?: Record<string, string>;
  fechaReg?: string | Date | null;
  fechaMod?: string;
  empresaId?: string | null;
  empresaNombre?: string | null;
  indicadores?: {
    docsPendientes: number;
    saldosPendientes: number;
    saldoTotal: number;
    itemsSaldo?: { id: string; descripcion: string; saldo: number }[];
    clasesCeaCreado?: number;
    programasCeaCreado?: { programaLabel: string; cantidad: number }[];
    comprobanteIngresoHoy?: MovimientoAlarmaHoy | null;
    comprobanteEgresoHoy?: MovimientoAlarmaHoy | null;
    facturaHoy?: FacturaAlarmaHoy | null;
  };
  /** Presente cuando la lista se filtra por jornada de capacitación. */
  certificadoJornada?: {
    generado: boolean;
    codigoCert?: string;
    fechaEmision?: string;
    idJornada?: string;
  };
}

export interface AlumnoListResponse {
  items: AlumnoListItem[];
  total: number;
  skip: number;
  limit: number;
  jornadaFiltro?: {
    activo?: boolean;
    jornadaIds?: string[];
    mensaje?: string;
  };
}

export interface DocDuplicadoRes {
  existe: boolean;
  _id?: string;
  numDoc?: number | string;
  nombres?: string;
  apellidos?: string;
  nombreCompleto?: string;
  message?: string;
  existingId?: string;
}

export interface CedulaOcrSugerido {
  tipoDoc?: string;
  numDoc?: number | string;
  expedida?: string;
  apellido1?: string;
  apellido2?: string;
  nombre1?: string;
  nombre2?: string;
  fechaNac?: string;
  genero?: string;
  tipoSangre?: string;
}

export interface AlumnoArchivosUpload {
  foto?: File;
  cedula?: File;
  licencia?: File;
}

export interface CedulaOcrResponse {
  sugerido: CedulaOcrSugerido;
  meta: {
    tieneRespaldo: boolean;
    advertencias: string[];
  };
}

@Injectable({ providedIn: 'root' })
export class AlumnoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/alumnos`;

  listar(
    opts: {
      q?: string;
      limit?: number;
      skip?: number;
      tipoAlumno?: string;
      sort?: string;
      dir?: 'asc' | 'desc';
      idJornada?: string;
      fechaJornada?: string;
      certJornada?: '' | 'con' | 'sin';
    } = {},
  ): Observable<AlumnoListResponse> {
    let params = new HttpParams();
    if (opts.q != null) params = params.set('q', opts.q);
    if (opts.limit != null) params = params.set('limit', opts.limit);
    if (opts.skip != null) params = params.set('skip', opts.skip);
    if (opts.tipoAlumno != null && opts.tipoAlumno !== '') {
      params = params.set('tipoAlumno', opts.tipoAlumno);
    }
    if (opts.sort) params = params.set('sort', opts.sort);
    if (opts.dir) params = params.set('dir', opts.dir);
    if (opts.idJornada) params = params.set('idJornada', opts.idJornada);
    if (opts.fechaJornada) params = params.set('fechaJornada', opts.fechaJornada);
    if (opts.certJornada) params = params.set('certJornada', opts.certJornada);
    return this.http.get<AlumnoListResponse>(this.base, { params });
  }

  /** Atajo para autocompletados (nombre o cédula). */
  buscar(q: string, limit = 12): Observable<AlumnoListItem[]> {
    return this.listar({ q, limit }).pipe(map((r) => r.items || []));
  }

  porDocumento(numDoc: number | string): Observable<AlumnoDto> {
    const nd = formatNumDoc(numDoc);
    return this.http.get<AlumnoDto>(`${this.base}/doc/${encodeURIComponent(nd)}`);
  }

  porId(id: string): Observable<AlumnoDto> {
    return this.http.get<AlumnoDto>(`${this.base}/${id}`);
  }

  comprobantesRecientes(desde: string): Observable<
    Array<{
      tipo: 'ingreso' | 'egreso' | 'factura';
      id: string;
      numRecibo?: string | null;
      numeroFactura?: string | null;
      valor: number;
      detalle?: string | null;
      numDoc?: number | string;
      nombreCompleto?: string;
      alumnoId?: string | null;
      fecha?: string;
    }>
  > {
    const params = new HttpParams().set('desde', desde);
    return this.http.get<
      Array<{
        tipo: 'ingreso' | 'egreso' | 'factura';
        id: string;
        numRecibo?: string | null;
        numeroFactura?: string | null;
        valor: number;
        detalle?: string | null;
        numDoc?: number | string;
        nombreCompleto?: string;
        alumnoId?: string | null;
        fecha?: string;
      }>
    >(`${this.base}/alertas-comprobantes-recientes`, { params });
  }

  alertasPagoHoy(): Observable<AlertaPagoAlumnoItem[]> {
    return this.http.get<AlertaPagoAlumnoItem[]>(`${this.base}/alertas-pago-hoy`);
  }

  indicadoresMovimientosHoy(id: string): Observable<{
    comprobanteIngresoHoy: MovimientoAlarmaHoy | null;
    comprobanteEgresoHoy: MovimientoAlarmaHoy | null;
    facturaHoy: FacturaAlarmaHoy | null;
  }> {
    return this.http.get<{
      comprobanteIngresoHoy: MovimientoAlarmaHoy | null;
      comprobanteEgresoHoy: MovimientoAlarmaHoy | null;
      facturaHoy: FacturaAlarmaHoy | null;
    }>(`${this.base}/${encodeURIComponent(id)}/indicadores-hoy`);
  }

  verificarDocumento(numDoc: number | string, excludeId?: string): Observable<DocDuplicadoRes> {
    const nd = parseNumDocForApi(numDoc);
    if (nd == null) return of({ existe: false });
    let params = new HttpParams();
    if (excludeId) params = params.set('excludeId', excludeId);
    return this.http.get<DocDuplicadoRes>(`${this.base}/verificar-doc/${encodeURIComponent(String(nd))}`, {
      params,
    });
  }

  escanearCedula(imagen: File): Observable<CedulaOcrResponse> {
    const form = new FormData();
    form.append('imagen', imagen);
    return this.http.post<CedulaOcrResponse>(`${this.base}/escanear-cedula`, form);
  }

  crear(data: AlumnoDto, files?: AlumnoArchivosUpload): Observable<AlumnoDto> {
    return this.http.post<AlumnoDto>(this.base, this.toForm(data, files));
  }

  actualizar(id: string, data: AlumnoDto, files?: AlumnoArchivosUpload): Observable<AlumnoDto> {
    return this.http.put<AlumnoDto>(`${this.base}/${id}`, this.toForm(data, files));
  }

  eliminar(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}`);
  }

  documentosRequeridos(id: string): Observable<DocumentosRequeridosRes> {
    return this.http.get<DocumentosRequeridosRes>(`${this.base}/${id}/documentos-requeridos`);
  }

  validarDocumentos(id: string, idPrograma?: string): Observable<ValidacionDocumentosRes> {
    let params = new HttpParams();
    if (idPrograma) params = params.set('idPrograma', idPrograma);
    return this.http.get<ValidacionDocumentosRes>(`${this.base}/${id}/documentos-validacion`, { params });
  }

  subirDocumentoRequerido(
    id: string,
    idDoc: string,
    archivo: File,
  ): Observable<DocumentosRequeridosRes & { alumno: AlumnoDto }> {
    const form = new FormData();
    form.append('archivo', archivo);
    return this.http.put<DocumentosRequeridosRes & { alumno: AlumnoDto }>(
      `${this.base}/${id}/documentos/${encodeURIComponent(idDoc)}`,
      form,
    );
  }

  private toForm(data: AlumnoDto, files?: AlumnoArchivosUpload): FormData {
    const form = new FormData();
    Object.entries(data || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || k === '_id') return;
      if (k === 'alertaPago' || k === 'alertaPagoFrecuencia') {
        form.append(k, String(v ?? ''));
        return;
      }
      if (k === 'numDoc') {
        const n = parseNumDocForApi(v);
        if (n != null) form.append(k, String(n));
        return;
      }
      form.append(k, String(v));
    });
    if (files?.foto) form.append('foto', files.foto);
    if (files?.cedula) form.append('cedula', files.cedula);
    if (files?.licencia) form.append('licencia', files.licencia);
    return form;
  }
}
