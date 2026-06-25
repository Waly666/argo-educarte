import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface PermisoItem {
  key: string;
  label: string;
}

export interface PermisoGrupo {
  id: string;
  label: string;
  permisos: PermisoItem[];
}

export interface AlarmaItem {
  key: string;
  label: string;
}

export interface AlarmaGrupo {
  id: string;
  label: string;
  alarmas: AlarmaItem[];
}

export interface RolAppMeta {
  permisosRemovidos?: string[];
  permisosAgregados?: string[];
  permisosEfectivos?: string[];
  permisosRev?: string | null;
}

export interface RolApp {
  _id?: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  permisos: string[];
  alarmas?: string[];
  esSistema?: boolean;
  activo?: boolean;
  meta?: RolAppMeta;
  updatedAt?: string;
}

export interface RolAppDto {
  codigo?: string;
  nombre: string;
  descripcion?: string;
  permisos: string[];
  alarmas?: string[];
  activo?: boolean;
}

@Injectable({ providedIn: 'root' })
export class RolAppService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/roles`;

  catalogo(): Observable<{ grupos: PermisoGrupo[]; alarmasGrupos: AlarmaGrupo[] }> {
    return this.http.get<{ grupos: PermisoGrupo[]; alarmasGrupos: AlarmaGrupo[] }>(
      `${this.base}/catalogo`,
    );
  }

  listar(): Observable<RolApp[]> {
    return this.http.get<RolApp[]>(this.base);
  }

  obtener(codigo: string): Observable<RolApp> {
    return this.http.get<RolApp>(`${this.base}/${encodeURIComponent(codigo)}`);
  }

  crear(dto: RolAppDto): Observable<RolApp> {
    return this.http.post<RolApp>(this.base, dto);
  }

  actualizar(codigo: string, dto: Partial<RolAppDto>): Observable<RolApp> {
    return this.http.put<RolApp>(`${this.base}/${encodeURIComponent(codigo)}`, dto);
  }

  eliminar(codigo: string): Observable<{ ok: boolean; message: string }> {
    return this.http.delete<{ ok: boolean; message: string }>(
      `${this.base}/${encodeURIComponent(codigo)}`,
    );
  }

  reiniciarSistema(): Observable<{ ok: boolean; message: string }> {
    return this.http.post<{ ok: boolean; message: string }>(`${this.base}/reiniciar-sistema`, {});
  }
}
