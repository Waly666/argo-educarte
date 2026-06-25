import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class RrhhCatalogService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/rrhh`;

  listar<T>(
    path: string,
    opts?: { q?: string; activos?: boolean; idPeriodo?: number; empleadoId?: number },
  ): Observable<T[]> {
    let params = new HttpParams();
    if (opts?.q) params = params.set('q', opts.q);
    if (opts?.activos === false) params = params.set('activos', 'false');
    if (opts?.idPeriodo != null) params = params.set('idPeriodo', String(opts.idPeriodo));
    if (opts?.empleadoId != null) params = params.set('empleadoId', String(opts.empleadoId));
    return this.http.get<T[]>(`${this.base}/${path}`, { params });
  }

  obtener<T>(path: string, id: number | string): Observable<T> {
    return this.http.get<T>(`${this.base}/${path}/${id}`);
  }

  crear<T>(path: string, dto: Record<string, unknown>): Observable<T> {
    return this.http.post<T>(`${this.base}/${path}`, dto);
  }

  actualizar<T>(path: string, id: number | string, dto: Record<string, unknown>): Observable<T> {
    return this.http.put<T>(`${this.base}/${path}/${id}`, dto);
  }

  eliminar(path: string, id: number | string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${path}/${id}`);
  }
}
