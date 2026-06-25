import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface CambioAuditoria {
  campo: string;
  antes?: unknown;
  despues?: unknown;
}

export interface RegistroAuditoria {
  idAuditoria: number;
  fecha: string;
  accion: string;
  entidad?: string;
  idEntidad?: string;
  metodo?: string;
  ruta?: string;
  rutaBase?: string;
  codigoHttp?: number;
  usuario?: string;
  idUsuario?: string;
  rol?: string;
  resumen?: string;
  datosAntes?: Record<string, unknown>;
  datosDespues?: Record<string, unknown>;
  cambios?: CambioAuditoria[];
  payload?: unknown;
  archivoLog?: string;
}

export interface AuditoriaListResponse {
  items: RegistroAuditoria[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface FiltrosAuditoria {
  desde?: string;
  hasta?: string;
  usuario?: string;
  accion?: string;
  entidad?: string;
  ruta?: string;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/auditoria`;

  listar(f: FiltrosAuditoria = {}): Observable<AuditoriaListResponse> {
    let params = new HttpParams();
    if (f.desde) params = params.set('desde', f.desde);
    if (f.hasta) params = params.set('hasta', f.hasta);
    if (f.usuario) params = params.set('usuario', f.usuario);
    if (f.accion) params = params.set('accion', f.accion);
    if (f.entidad) params = params.set('entidad', f.entidad);
    if (f.ruta) params = params.set('ruta', f.ruta);
    if (f.page) params = params.set('page', String(f.page));
    if (f.limit) params = params.set('limit', String(f.limit));
    return this.http.get<AuditoriaListResponse>(this.base, { params });
  }

  obtener(idAuditoria: number): Observable<RegistroAuditoria> {
    return this.http.get<RegistroAuditoria>(`${this.base}/${idAuditoria}`);
  }
}
