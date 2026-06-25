import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface ComboDetalleProg {
  idPrograma: string;
  nombreProg: string;
  valor: number;
}

export interface Combo {
  id: string;
  nombre: string;
  descripcion: string;
  programas: string[];
  activo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ComboPrevista {
  id: string;
  nombre: string;
  descripcion: string;
  tarifa: number;
  totalValor: number;
  programas: ComboDetalleProg[];
}

export interface ComboAplicarRes {
  ok: boolean;
  message: string;
  combo: { id: string; nombre: string };
  numDoc: number;
  nombreAlumno: string;
  totalValor: number;
  resultados: {
    idPrograma: string;
    nombreProg: string;
    valor: number;
    matricula: unknown;
    liquidacion: unknown;
  }[];
  errores: { idPrograma: string; nombreProg: string; error: string }[];
}

@Injectable({ providedIn: 'root' })
export class ComboService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/combos`;

  listar(): Observable<Combo[]> {
    return this.http.get<Combo[]>(this.base);
  }

  listarTodos(): Observable<Combo[]> {
    return this.http.get<Combo[]>(`${this.base}?todos=true`);
  }

  obtener(id: string): Observable<Combo> {
    return this.http.get<Combo>(`${this.base}/${id}`);
  }

  prevista(id: string): Observable<ComboPrevista> {
    return this.http.get<ComboPrevista>(`${this.base}/${id}/prevista`);
  }

  crear(body: { nombre: string; descripcion?: string; programas: string[] }): Observable<{ combo: Combo; message: string }> {
    return this.http.post<{ combo: Combo; message: string }>(this.base, body);
  }

  actualizar(
    id: string,
    body: { nombre?: string; descripcion?: string; programas?: string[]; activo?: boolean },
  ): Observable<{ combo: Combo; message: string }> {
    return this.http.put<{ combo: Combo; message: string }>(`${this.base}/${id}`, body);
  }

  eliminar(id: string): Observable<{ ok: boolean; message: string }> {
    return this.http.delete<{ ok: boolean; message: string }>(`${this.base}/${id}`);
  }

  aplicar(id: string, numDoc: number | string): Observable<ComboAplicarRes> {
    return this.http.post<ComboAplicarRes>(`${this.base}/${id}/aplicar`, { numDoc });
  }
}
