import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, shareReplay, tap } from 'rxjs';

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private http = inject(HttpClient);
  private cache = new Map<string, Observable<any[]>>();

  list<T = any>(name: string, opts?: { refresh?: boolean }): Observable<T[]> {
    if (opts?.refresh) this.cache.delete(name);
    if (!this.cache.has(name)) {
      const obs = this.http.get<T[]>(`${environment.apiUrl}/catalogos/${name}`).pipe(
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.cache.set(name, obs);
    }
    return this.cache.get(name) as Observable<T[]>;
  }

  invalidate(name?: string) {
    if (name) this.cache.delete(name);
    else this.cache.clear();
  }

  departamentos(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/catalogos/divipola/departamentos`);
  }

  municipios(codDepto: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.apiUrl}/catalogos/divipola/municipios/${encodeURIComponent(codDepto)}`,
    );
  }

  buscarMunicipios(q: string, limit = 20): Observable<MunicipioDivipola[]> {
    const params = new URLSearchParams({ q, limit: String(limit) });
    return this.http.get<MunicipioDivipola[]>(
      `${environment.apiUrl}/catalogos/divipola/buscar?${params}`,
    );
  }

  municipioPorCodigo(codMunicipio: string): Observable<MunicipioDivipola> {
    return this.http.get<MunicipioDivipola>(
      `${environment.apiUrl}/catalogos/divipola/municipio/${encodeURIComponent(codMunicipio)}`,
    );
  }
}

export interface MunicipioDivipola {
  codMunicipio: string;
  nombreMunicipio: string;
  codDepto: string;
  nombreDepto: string;
  label: string;
}
