import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { formatNumDoc, parseNumDocForApi } from '../utils/num-doc.helpers';

export interface LiquidacionItem {
  _id: string;
  numDoc: number | string;
  idMat?: string | null;
  idServ?: string | null;
  idProg?: string | null;
  descripcion?: string;
  valor: number;
  abonado: number;
  saldo: number;
  cantidad?: number;
  valorUnitario?: number;
  estado?: string;
  fechaCreacion?: string;
  fecha?: string;
  createdAt?: string;
  /** Matrícula vinculada — tarifa 4 = aula virtual */
  tarifaMatricula?: number | null;
  esVirtual?: boolean;
}

export interface LiquidacionResumen {
  items: LiquidacionItem[];
  totales: { valor: number; abonado: number; saldo: number };
}

export interface LiquidacionCrearDto {
  numDoc: number | string;
  idServ: string;
  descripcion?: string;
  valor?: number;
  cantidad?: number;
}

export interface LiquidacionConSaldoItem extends LiquidacionItem {
  alumnoNombre?: string;
  alumnoDoc?: number | string;
  tipoIngresoDescr?: string | null;
}

export interface LiquidacionConSaldoResumen {
  items: LiquidacionConSaldoItem[];
  total: number;
  skip: number;
  limit: number;
  totales: { valor: number; abonado: number; saldo: number };
}

@Injectable({ providedIn: 'root' })
export class LiquidacionService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/liquidacion`;

  listarConSaldo(params?: { q?: string; skip?: number; limit?: number }): Observable<LiquidacionConSaldoResumen> {
    const q = params?.q?.trim();
    const skip = params?.skip ?? 0;
    const limit = params?.limit ?? 500;
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    query.set('skip', String(skip));
    query.set('limit', String(limit));
    const qs = query.toString();
    return this.http.get<LiquidacionConSaldoResumen>(`${this.base}/con-saldo${qs ? `?${qs}` : ''}`);
  }

  listarPorAlumno(numDoc: number | string): Observable<LiquidacionResumen> {
    return this.http.get<LiquidacionResumen>(`${this.base}/alumno/${encodeURIComponent(formatNumDoc(numDoc))}`);
  }

  obtener(id: string): Observable<LiquidacionItem> {
    return this.http.get<LiquidacionItem>(`${this.base}/${id}`);
  }

  crear(dto: LiquidacionCrearDto): Observable<LiquidacionItem> {
    const numDoc = parseNumDocForApi(dto.numDoc);
    return this.http.post<LiquidacionItem>(this.base, { ...dto, numDoc: numDoc ?? dto.numDoc });
  }

  eliminar(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}`);
  }
}
