import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface CatalogoMetaItem {
  nombre: string;
  label: string;
  idFields: string[];
  grande?: boolean;
  esInspeccionChecklist?: boolean;
  esCatalogoDocumento?: boolean;
}

export interface CatalogoListadoAdmin {
  meta: CatalogoMetaItem;
  total: number;
  skip: number;
  limit: number;
  campos: string[];
  idFields: string[];
  rows: Record<string, unknown>[];
}

@Injectable({ providedIn: 'root' })
export class CatalogoAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/catalogos`;

  meta(): Observable<{ catalogos: CatalogoMetaItem[]; nota?: string }> {
    return this.http.get<{ catalogos: CatalogoMetaItem[]; nota?: string }>(`${this.base}/meta`);
  }

  listar(
    nombre: string,
    opts?: { q?: string; skip?: number; limit?: number },
  ): Observable<CatalogoListadoAdmin> {
    let params = new HttpParams().set('admin', 'true');
    if (opts?.q) params = params.set('q', opts.q);
    if (opts?.skip != null) params = params.set('skip', String(opts.skip));
    if (opts?.limit != null) params = params.set('limit', String(opts.limit));
    return this.http.get<CatalogoListadoAdmin>(`${this.base}/${nombre}`, { params });
  }

  crear(nombre: string, doc: Record<string, unknown>): Observable<{ documento: Record<string, unknown> }> {
    return this.http.post<{ documento: Record<string, unknown> }>(`${this.base}/${nombre}`, doc);
  }

  actualizar(
    nombre: string,
    id: string,
    doc: Record<string, unknown>,
  ): Observable<{ documento: Record<string, unknown> }> {
    return this.http.put<{ documento: Record<string, unknown> }>(
      `${this.base}/${nombre}/${id}`,
      doc,
    );
  }

  eliminar(nombre: string, id: string): Observable<{ ok: boolean; message?: string }> {
    return this.http.delete<{ ok: boolean; message?: string }>(`${this.base}/${nombre}/${id}`);
  }

  importar(
    nombre: string,
    rows: Record<string, unknown>[],
    modo: 'reemplazar' | 'agregar' = 'reemplazar',
  ): Observable<{ insertados: number; total: number; message?: string }> {
    return this.http.post<{ insertados: number; total: number; message?: string }>(
      `${this.base}/${nombre}/importar`,
      { rows, modo },
    );
  }

  recargarExcel(hoja?: string): Observable<{ message?: string; hojas?: unknown[] }> {
    return this.http.post<{ message?: string; hojas?: unknown[] }>(`${this.base}/recargar-excel`, {
      hoja: hoja || undefined,
    });
  }
}
