import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface TipoDocumentoRequisitoEmp {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  activo?: boolean;
  controlaVencimiento?: boolean;
  diasAvisoVencimiento?: number | null;
}

export interface RequisitoPorCargo {
  idCargo: string;
  idDocumentos: string[];
}

export interface CargoResumen {
  idCargo: string;
  label: string;
}

export interface ConfigRequisitosDocumentosEmpleados {
  clave?: string;
  tiposDocumento: TipoDocumentoRequisitoEmp[];
  requisitosPorCargo: RequisitoPorCargo[];
  diasAvisoVencimiento?: number;
  cargos?: CargoResumen[];
}

export interface DocumentoRequeridoEmpleado {
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

export interface DocumentosRequeridosEmpleadoRes {
  cargo: CargoResumen | null;
  documentos: DocumentoRequeridoEmpleado[];
  sinCargo: boolean;
  diasAvisoVencimiento?: number;
  tiposDocumento?: TipoDocumentoRequisitoEmp[];
}

@Injectable({ providedIn: 'root' })
export class ConfigRequisitosDocumentosEmpleadosService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/config/requisitos-documentos-empleados`;

  obtener(): Observable<ConfigRequisitosDocumentosEmpleados> {
    return this.http.get<ConfigRequisitosDocumentosEmpleados>(this.base);
  }

  guardar(data: ConfigRequisitosDocumentosEmpleados): Observable<ConfigRequisitosDocumentosEmpleados> {
    return this.http.put<ConfigRequisitosDocumentosEmpleados>(this.base, data);
  }
}
