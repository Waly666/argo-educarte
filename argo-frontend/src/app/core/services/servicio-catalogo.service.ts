import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ServicioPrograma } from './programa.service';

export interface ServicioCatalogo extends ServicioPrograma {
  _id?: string;
  descripcion?: string;
  programaNombre?: string | null;
  programaCodigo?: string | null;
  permiteCantidad?: boolean;
  condicionIva?: string;
}

export interface ServicioDto {
  descrServicio?: string;
  tipoServ?: string | number;
  idProg?: string | number | null;
  tarifa1?: number;
  tarifa2?: number;
  tarifa3?: number;
  tarifaVirtual?: number;
  facturar?: string | boolean;
  iva?: number;
  condicionIva?: string;
}

@Injectable({ providedIn: 'root' })
export class ServicioCatalogoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/servicios`;

  listar(opts?: {
    q?: string;
    soloPrograma?: boolean;
    sinPrograma?: boolean;
    catalogo?: boolean;
    limit?: number;
  }): Observable<ServicioCatalogo[]> {
    let params = new HttpParams();
    if (opts?.q) params = params.set('q', opts.q);
    if (opts?.soloPrograma) params = params.set('soloPrograma', 'true');
    if (opts?.sinPrograma) params = params.set('sinPrograma', 'true');
    if (opts?.catalogo) params = params.set('catalogo', '1');
    if (opts?.limit != null) params = params.set('limit', String(opts.limit));
    return this.http.get<ServicioCatalogo[]>(this.base, { params });
  }

  obtener(id: string | number): Observable<{ servicio: ServicioCatalogo; programa: unknown }> {
    return this.http.get<{ servicio: ServicioCatalogo; programa: unknown }>(`${this.base}/${id}`);
  }

  crear(dto: ServicioDto): Observable<{ servicio: ServicioCatalogo; message?: string }> {
    return this.http.post<{ servicio: ServicioCatalogo; message?: string }>(this.base, {
      ...dto,
      idProg: dto.idProg ?? null,
    });
  }

  actualizar(id: string | number, dto: ServicioDto): Observable<{ servicio: ServicioCatalogo }> {
    return this.http.put<{ servicio: ServicioCatalogo }>(`${this.base}/${id}`, dto);
  }

  eliminar(id: string | number): Observable<{ ok: boolean; message?: string }> {
    return this.http.delete<{ ok: boolean; message?: string }>(`${this.base}/${id}`);
  }
}
