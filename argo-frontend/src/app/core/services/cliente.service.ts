import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface Cliente {
  _id?: string;
  identificationDocumentCode?: string;
  identificacion: string;
  dv?: string;
  legalOrganizationCode?: string;
  razonSocial?: string;
  nombreComercial?: string;
  nombres?: string;
  tributeCode?: string;
  responsabilidadFiscal?: string;
  direccion?: string;
  correo?: string;
  telefono?: string;
  municipioCodigo?: string;
  municipioNombre?: string;
  /** juridica_empresa | juridica_oficial | juridica_ong | persona_natural */
  tipoContratoCap?: string;
  tipoContratoCapLabel?: string;
  granContribuyente?: boolean;
  autoretenedor?: boolean;
  agenteRetenedorIva?: boolean;
  porcentajeReteIva?: number;
  porcentajeReteFuente?: number;
  activo?: boolean;
  nombre?: string;
}

export interface ClienteCatalogos {
  tiposIdentificacion: { code: string; label: string }[];
  organizacionesLegales: { code: string; label: string }[];
  tributos: { code: string; label: string }[];
  responsabilidadesFiscales: { code: string; label: string }[];
  tiposContratoCap: { id: string; label: string }[];
}

@Injectable({ providedIn: 'root' })
export class ClienteService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/clientes`;

  catalogos(): Observable<ClienteCatalogos> {
    return this.http.get<ClienteCatalogos>(`${this.base}/catalogos`);
  }

  listar(q = ''): Observable<Cliente[]> {
    return this.http.get<Cliente[]>(this.base, { params: q ? { q } : {} });
  }

  obtener(id: string): Observable<Cliente> {
    return this.http.get<Cliente>(`${this.base}/${id}`);
  }

  crear(data: Cliente): Observable<Cliente> {
    return this.http.post<Cliente>(this.base, data);
  }

  actualizar(id: string, data: Cliente): Observable<Cliente> {
    return this.http.put<Cliente>(`${this.base}/${id}`, data);
  }

  eliminar(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}`);
  }
}
