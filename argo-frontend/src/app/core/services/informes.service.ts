import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export type FiltroInformeTipo =
  | 'texto'
  | 'fecha'
  | 'booleano'
  | 'programa'
  | 'servicio'
  | 'jornada'
  | 'tipoAlumno'
  | 'pagada'
  | 'tipoCap'
  | 'tipoCert';

export type ServicioVinculoInforme = 'general' | 'programa';

export interface FiltroInformeDef {
  clave: string;
  tipo: FiltroInformeTipo;
  etiqueta: string;
  placeholder?: string;
  default?: boolean | string;
  /** Servicios sin programa (vínculo general) vs servicios de matrícula/programa. */
  servicioVinculo?: ServicioVinculoInforme;
}

export interface ColumnaInformeDef {
  clave: string;
  etiqueta: string;
  tipo: 'texto' | 'moneda' | 'fecha';
}

export interface InformeDef {
  id: string;
  etiqueta: string;
  descripcion: string;
  icono: string;
  filtros: FiltroInformeDef[];
  columnas: ColumnaInformeDef[];
}

export interface ResultadoInforme {
  informe: string;
  etiqueta: string;
  columnas: ColumnaInformeDef[];
  items: Record<string, unknown>[];
  total: number;
  skip: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class InformesService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/informes`;

  catalogo(): Observable<{ informes: InformeDef[] }> {
    return this.http.get<{ informes: InformeDef[] }>(`${this.base}/catalogo`);
  }

  obtener(id: string): Observable<InformeDef> {
    return this.http.get<InformeDef>(`${this.base}/${encodeURIComponent(id)}`);
  }

  ejecutar(id: string, params: Record<string, string | number | boolean>): Observable<ResultadoInforme> {
    let hp = new HttpParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === '' || v == null) continue;
      hp = hp.set(k, String(v));
    }
    return this.http.get<ResultadoInforme>(`${this.base}/${encodeURIComponent(id)}/ejecutar`, { params: hp });
  }

  exportarExcel(id: string, params: Record<string, string | number | boolean>): Observable<Blob> {
    let hp = new HttpParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === '' || v == null) continue;
      hp = hp.set(k, String(v));
    }
    return this.http.get(`${this.base}/${encodeURIComponent(id)}/exportar`, {
      params: hp,
      responseType: 'blob',
    });
  }
}
