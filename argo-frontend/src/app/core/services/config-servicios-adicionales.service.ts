import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export type MomentoServicioAdicional = 'matricula' | 'pago';

export interface ReglaServicioAdicional {
  id: string;
  activo: boolean;
  idServ: string;
  momento: MomentoServicioAdicional;
  modalidades: string[];
  tarifasMatricula: number[];
  idTipCaps: string[];
  prefijosCodigo: string[];
  idProgramas: string[];
  idTiposPago: string[];
  repartirSemestres: boolean;
  orden: number;
  nota?: string;
  servicioNombre?: string | null;
  servicioValor?: number | null;
  servicioSinPrograma?: boolean;
}

export interface ConfigServiciosAdicionales {
  clave?: string;
  reglas: ReglaServicioAdicional[];
  updatedAt?: string | null;
}

export interface PreviewServicioAdicionalItem {
  reglaId?: string;
  idServ: string | number;
  descripcion: string;
  valor: number;
  repartirSemestres?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfigServiciosAdicionalesService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/config/servicios-adicionales`;

  obtener(): Observable<ConfigServiciosAdicionales> {
    return this.http.get<ConfigServiciosAdicionales>(this.base);
  }

  guardar(cfg: Pick<ConfigServiciosAdicionales, 'reglas'>): Observable<ConfigServiciosAdicionales> {
    return this.http.put<ConfigServiciosAdicionales>(this.base, cfg);
  }

  previewMatricula(idPrograma: string, tarifa: number): Observable<{
    items: PreviewServicioAdicionalItem[];
    totalExtras: number;
  }> {
    const params = new HttpParams().set('idPrograma', idPrograma).set('tarifa', String(tarifa));
    return this.http.get<{ items: PreviewServicioAdicionalItem[]; totalExtras: number }>(
      `${this.base}/preview-matricula`,
      { params },
    );
  }

  previewPago(idTipoPago: string, idLiquidaciones: string[]): Observable<{
    items: PreviewServicioAdicionalItem[];
    totalExtras: number;
  }> {
    return this.http.post<{ items: PreviewServicioAdicionalItem[]; totalExtras: number }>(
      `${this.base}/preview-pago`,
      { idTipoPago, idLiquidaciones },
    );
  }
}
