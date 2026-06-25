import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface TipoDocumentoRequisitoVehi {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  activo?: boolean;
  controlaVencimiento?: boolean;
  diasAvisoVencimiento?: number | null;
}

export interface RequisitoPorClase {
  idClase: string;
  idDocumentos: string[];
}

export interface ConfigRequisitosDocumentosVehiculos {
  clave?: string;
  tiposDocumento: TipoDocumentoRequisitoVehi[];
  requisitosPorClase: RequisitoPorClase[];
  diasAvisoVencimiento?: number;
}

export interface ClaseVehiculoResumen {
  idClase: string;
  label: string;
}

export interface DocumentoRequeridoVehiculo {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  subido: boolean;
  docId?: string;
  urlArchivo?: string;
  numero?: string;
  fechaExp?: string | null;
  fechaVence?: string | null;
  controlaVencimiento?: boolean;
  diasAvisoVencimiento?: number;
  vencido?: boolean;
  vencePronto?: boolean;
  faltaFechaVence?: boolean;
  requeridoPor: string[];
}

export interface DocumentosRequeridosVehiculoRes {
  clase: ClaseVehiculoResumen | null;
  documentos: DocumentoRequeridoVehiculo[];
  sinClase: boolean;
  diasAvisoVencimiento?: number;
  tiposDocumento?: TipoDocumentoRequisitoVehi[];
}

export interface DocumentoPendienteVehiRes {
  id: string;
  codigo: string;
  nombre: string;
  requeridoPor?: string[];
}

export interface ValidacionDocumentosVehiculoRes {
  ok: boolean;
  pendientes: DocumentoPendienteVehiRes[];
  clase?: ClaseVehiculoResumen | null;
  sinClase?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfigRequisitosDocumentosVehiculosService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/config/requisitos-documentos-vehiculos`;

  obtener(): Observable<ConfigRequisitosDocumentosVehiculos> {
    return this.http.get<ConfigRequisitosDocumentosVehiculos>(this.base);
  }

  guardar(data: ConfigRequisitosDocumentosVehiculos): Observable<ConfigRequisitosDocumentosVehiculos> {
    return this.http.put<ConfigRequisitosDocumentosVehiculos>(this.base, data);
  }
}
