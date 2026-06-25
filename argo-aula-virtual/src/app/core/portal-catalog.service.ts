import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface DeptoDivipola {
  codDepto: string;
  nombreDepto: string;
}

export interface MunicipioDivipola {
  codMunicipio: string;
  nombreMunicipio: string;
  codDepto: string;
  nombreDepto: string;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class PortalCatalogService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/aula-virtual/catalogos`;

  tiposDoc(): Observable<Record<string, unknown>[]> {
    return this.http.get<Record<string, unknown>[]>(`${this.base}/tipos-doc`);
  }

  generos(): Observable<Record<string, unknown>[]> {
    return this.http.get<Record<string, unknown>[]>(`${this.base}/generos`);
  }

  departamentos(): Observable<DeptoDivipola[]> {
    return this.http.get<DeptoDivipola[]>(`${this.base}/departamentos`);
  }

  municipios(codDepto: string): Observable<MunicipioDivipola[]> {
    return this.http.get<MunicipioDivipola[]>(
      `${this.base}/municipios/${encodeURIComponent(codDepto)}`,
    );
  }

  buscarMunicipios(q: string, limit = 20): Observable<MunicipioDivipola[]> {
    const params = new URLSearchParams({ q, limit: String(limit) });
    return this.http.get<MunicipioDivipola[]>(`${this.base}/municipios-buscar?${params}`);
  }

  municipioPorCodigo(codMunicipio: string): Observable<MunicipioDivipola> {
    return this.http.get<MunicipioDivipola>(
      `${this.base}/municipio/${encodeURIComponent(codMunicipio)}`,
    );
  }
}
