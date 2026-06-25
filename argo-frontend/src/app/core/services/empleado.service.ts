import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { DocumentosRequeridosEmpleadoRes } from './config-requisitos-documentos-empleados.service';

export interface Empleado {
  _id?: string;
  idEmpleado: number;
  tipoDocumento?: string;
  numeroDocumento: string;
  primerNombre: string;
  segundoNombre?: string;
  primerApellido: string;
  segundoApellido?: string;
  fechaNacimiento?: string;
  sexo?: string;
  correoPersonal?: string;
  correoCorporativo?: string;
  telefono?: string;
  celular?: string;
  direccion?: string;
  ciudad?: string;
  departamento?: string;
  estadoCivil?: string;
  fechaIngreso?: string;
  fechaRetiro?: string;
  tipoContrato?: string;
  salario?: number;
  epsId?: number;
  afpId?: number;
  arlId?: number;
  cajaCompensacionId?: number;
  cargoId?: number;
  departamentoId?: number;
  idSede?: string | null;
  urlFoto?: string;
  estado?: string;
  nombreCompleto?: string;
  cargoNombre?: string;
  departamentoNombre?: string;
  sedeNombre?: string | null;
  epsNombre?: string;
  afpNombre?: string;
  arlNombre?: string;
  cajaNombre?: string;
  totalEgresos?: number;
  idUsuario?: string | null;
  usuarioLogin?: string | null;
  usuarioRol?: string | null;
  usuarioGenerado?: UsuarioGeneradoEmpleado | null;
}

export interface DocEmpleadoDto {
  _id?: string;
  idDocumento?: string | number;
  idEmpleado?: number;
  documento?: string;
  numero?: string;
  fechaExp?: string | null;
  fechaVence?: string | null;
  urlArchivo?: string;
  vencePronto?: boolean;
  vencido?: boolean;
  faltaFechaVence?: boolean;
  controlaVencimiento?: boolean;
  diasAvisoVencimiento?: number;
}

export type ModoAccesoEmpleado = 'auto' | 'ninguno' | 'vincular';

export interface EmpleadoFormExtras {
  modoAcceso?: ModoAccesoEmpleado;
  idUsuarioExistente?: string;
}

export interface UsuarioGeneradoEmpleado {
  username: string;
  passwordInicial?: string;
  rol: string;
  existente?: boolean;
  vinculado?: boolean;
}

export interface AlertaDocumentoEmpleado {
  idEmpleado: number;
  empleadoId?: string;
  nombreEmpleado: string;
  idDocumento: string;
  documento: string;
  fechaVence?: string | null;
  vencido?: boolean;
  vencePronto?: boolean;
  faltaFechaVence?: boolean;
  diasAvisoVencimiento?: number;
}

export interface AlertasDocumentosEmpleadosRes {
  docsVencidos: number;
  docsPorVencer: number;
  totalAlertas: number;
  empleadosAfectados: number;
  diasAvisoVencimiento: number;
  alertas: AlertaDocumentoEmpleado[];
}

export interface AlertaDocFaltanteEmpleado {
  idEmpleado: number;
  empleadoId?: string;
  nombreEmpleado: string;
  numeroDocumento?: string;
  esInstructor?: boolean;
  idDocumento: string;
  documento: string;
}

export interface AlertasDocsFaltantesEmpleadosRes {
  totalFaltantes: number;
  empleadosAfectados: number;
  alertas: AlertaDocFaltanteEmpleado[];
}

export type EmpleadoDto = Partial<Empleado> & EmpleadoFormExtras;

export interface EmpleadoArchivosUpload {
  foto?: File;
}

const EMPLEADO_SKIP_FORM = new Set([
  '_id',
  'idEmpleado',
  'nombreCompleto',
  'cargoNombre',
  'departamentoNombre',
  'sedeNombre',
  'epsNombre',
  'afpNombre',
  'arlNombre',
  'cajaNombre',
  'totalEgresos',
  'idUsuario',
  'usuarioLogin',
  'usuarioRol',
  'usuarioGenerado',
]);

@Injectable({ providedIn: 'root' })
export class EmpleadoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/rrhh/empleados`;
  private rrhhBase = `${environment.apiUrl}/rrhh`;

  /** Alertas globales de vencimiento — usuario autenticado con alarma correspondiente. */
  alertasDocumentos(): Observable<AlertasDocumentosEmpleadosRes> {
    return this.http.get<AlertasDocumentosEmpleadosRes>(`${this.rrhhBase}/alertas-documentos-empleados`);
  }

  alertasDocumentosFaltantes(): Observable<AlertasDocsFaltantesEmpleadosRes> {
    return this.http.get<AlertasDocsFaltantesEmpleadosRes>(`${this.rrhhBase}/alertas-documentos-empleados-faltantes`);
  }

  listar(opts?: { q?: string; activos?: boolean }): Observable<Empleado[]> {
    let params = new HttpParams();
    if (opts?.q) params = params.set('q', opts.q);
    if (opts?.activos === false) params = params.set('activos', 'false');
    return this.http.get<Empleado[]>(this.base, { params });
  }

  /** Empleados con cargo instructor (módulo Instructores). */
  listarInstructores(opts?: { q?: string; activos?: boolean }): Observable<Empleado[]> {
    let params = new HttpParams();
    if (opts?.q) params = params.set('q', opts.q);
    if (opts?.activos === false) params = params.set('activos', 'false');
    return this.http.get<Empleado[]>(`${this.rrhhBase}/instructores`, { params });
  }

  obtenerInstructor(id: number | string): Observable<Empleado> {
    return this.http.get<Empleado>(`${this.rrhhBase}/instructores/${id}`);
  }

  obtener(id: number | string): Observable<Empleado> {
    return this.http.get<Empleado>(`${this.base}/${id}`);
  }

  crear(dto: EmpleadoDto, files?: EmpleadoArchivosUpload): Observable<Empleado> {
    return this.http.post<Empleado>(this.base, this.toForm(dto, files));
  }

  actualizar(id: number | string, dto: EmpleadoDto, files?: EmpleadoArchivosUpload): Observable<Empleado> {
    return this.http.put<Empleado>(`${this.base}/${id}`, this.toForm(dto, files));
  }

  eliminar(id: number | string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}`);
  }

  documentosRequeridos(id: number | string): Observable<DocumentosRequeridosEmpleadoRes> {
    return this.http.get<DocumentosRequeridosEmpleadoRes>(`${this.base}/${id}/documentos-requeridos`);
  }

  listarDocumentos(id: number | string): Observable<DocEmpleadoDto[]> {
    return this.http.get<DocEmpleadoDto[]>(`${this.base}/${id}/documentos`);
  }

  crearDocumento(
    id: number | string,
    data: Partial<DocEmpleadoDto>,
    archivo?: File,
  ): Observable<DocEmpleadoDto> {
    return this.http.post<DocEmpleadoDto>(`${this.base}/${id}/documentos`, this.toDocForm(data, archivo));
  }

  actualizarDocumento(
    id: number | string,
    docId: string,
    data: Partial<DocEmpleadoDto>,
    archivo?: File,
  ): Observable<DocEmpleadoDto> {
    return this.http.put<DocEmpleadoDto>(`${this.base}/${id}/documentos/${docId}`, this.toDocForm(data, archivo));
  }

  eliminarDocumento(id: number | string, docId: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}/documentos/${docId}`);
  }

  private toDocForm(data: Partial<DocEmpleadoDto>, archivo?: File): FormData {
    const form = new FormData();
    Object.entries(data || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || k === '_id' || k === 'idEmpleado') return;
      form.append(k, String(v));
    });
    if (archivo) form.append('archivo', archivo);
    return form;
  }

  private toForm(data: EmpleadoDto, files?: EmpleadoArchivosUpload): FormData {
    const form = new FormData();
    Object.entries(data || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || EMPLEADO_SKIP_FORM.has(k)) return;
      form.append(k, String(v));
    });
    if (files?.foto) form.append('foto', files.foto);
    return form;
  }
}
