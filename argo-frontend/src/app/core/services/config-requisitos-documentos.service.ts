import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface TipoDocumentoRequisito {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  activo?: boolean;
}

export interface RequisitoPorCap {
  idTipCap: string;
  idDocumentos: string[];
}

export interface ConfigRequisitosDocumentos {
  clave?: string;
  tiposDocumento: TipoDocumentoRequisito[];
  requisitosPorCap: RequisitoPorCap[];
}

export interface TipoCapMatriculaResumen {
  idTipCap: string;
  label: string;
  programas: string[];
}

export interface DocumentoRequeridoAlumno {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  url: string;
  subido: boolean;
  requeridoPor: string[];
}

export interface DocumentosRequeridosRes {
  tiposCapacitacion: TipoCapMatriculaResumen[];
  documentos: DocumentoRequeridoAlumno[];
  sinMatriculas: boolean;
  alumno?: Record<string, unknown>;
}

export interface DocumentoPendienteRes {
  id: string;
  codigo: string;
  nombre: string;
  requeridoPor?: string[];
}

export interface ValidacionDocumentosRes {
  ok: boolean;
  pendientes: DocumentoPendienteRes[];
  programa?: string;
  idTipCap?: string;
  tipoCapLabel?: string;
  tiposCapacitacion?: TipoCapMatriculaResumen[];
  sinMatriculas?: boolean;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigRequisitosDocumentosService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/config/requisitos-documentos`;

  obtener(): Observable<ConfigRequisitosDocumentos> {
    return this.http.get<ConfigRequisitosDocumentos>(this.base);
  }

  guardar(data: ConfigRequisitosDocumentos): Observable<ConfigRequisitosDocumentos> {
    return this.http.put<ConfigRequisitosDocumentos>(this.base, data);
  }
}
