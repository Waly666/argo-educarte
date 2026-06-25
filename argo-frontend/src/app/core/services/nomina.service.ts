import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface PeriodoNomina {
  idPeriodo: number;
  ano: number;
  mes: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  totalNovedades?: number;
  liquidacion?: LiquidacionNomina | null;
  esFuturo?: boolean;
  avisoFuturo?: string | null;
}

export interface LineaNomina {
  codigoConcepto?: string;
  concepto: string;
  naturaleza: 'devengo' | 'deduccion' | 'patronal' | 'provision';
  valor: number;
}

export interface DetalleEmpleadoNomina {
  empleadoId: number;
  numeroDocumento?: string;
  tipoDocumento?: string;
  empleadoNombre: string;
  lineas: LineaNomina[];
  lineasPatronales?: LineaNomina[];
  lineasProvisiones?: LineaNomina[];
  totalDevengos: number;
  totalDeducciones: number;
  netoPagar: number;
  ibc?: number;
  totalPatronal?: number;
  totalProvisiones?: number;
  totalCostoEmpresa?: number;
  administradoras?: { eps?: string; afp?: string; arl?: string; ccf?: string };
  advertencias?: string[];
  /** Días cotizados PILA (máx. 30) */
  diasPila?: number;
  diasSalarioPila?: number;
  novedadesPila?: {
    ing?: string;
    ret?: string;
    ige?: string;
    lma?: string;
    sln?: string;
    vacLr?: string;
  } | null;
  pila?: {
    dias?: number;
    diasCotizacion?: number;
    novedadIng?: string;
    novedadRet?: string;
    novedadIGE?: string;
    novedadLMA?: string;
    novedadSLN?: string;
    novedadVAC_LR?: string;
  };
}

export interface LiquidacionNomina {
  idLiquidacionNomina: number;
  idPeriodo: number;
  fechaLiquidacion: string;
  estado: string;
  detalle: DetalleEmpleadoNomina[];
  totalDevengos: number;
  totalDeducciones: number;
  totalNeto: number;
  totalPatronal?: number;
  totalProvisiones?: number;
  totalCostoEmpresa?: number;
  cantidadEmpleados: number;
}

export interface NominaConfig {
  saludEmpleadoPct: number;
  pensionEmpleadoPct: number;
  saludEmpleadorPct?: number;
  pensionEmpleadorPct?: number;
  senaPct?: number;
  icbfPct?: number;
  ccfPct?: number;
  auxilioTransporteMensual: number;
  smlmv: number;
  uvt?: number;
}

@Injectable({ providedIn: 'root' })
export class NominaService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/rrhh/nomina`;

  config(): Observable<NominaConfig> {
    return this.http.get<NominaConfig>(`${this.base}/config`);
  }

  listarPeriodos(): Observable<PeriodoNomina[]> {
    return this.http.get<PeriodoNomina[]>(`${this.base}/periodos`);
  }

  crearPeriodo(ano: number, mes: number): Observable<PeriodoNomina> {
    return this.http.post<PeriodoNomina>(`${this.base}/periodos`, { ano, mes });
  }

  obtenerPeriodo(id: number): Observable<PeriodoNomina> {
    return this.http.get<PeriodoNomina>(`${this.base}/periodos/${id}`);
  }

  generarNovedades(id: number): Observable<{ ok: boolean; novedadesGeneradas: number; periodo: PeriodoNomina }> {
    return this.http.post<{ ok: boolean; novedadesGeneradas: number; periodo: PeriodoNomina }>(
      `${this.base}/periodos/${id}/generar-novedades`,
      {},
    );
  }

  liquidar(id: number): Observable<LiquidacionNomina> {
    return this.http.post<LiquidacionNomina>(`${this.base}/periodos/${id}/liquidar`, {});
  }

  obtenerLiquidacion(id: number): Observable<LiquidacionNomina> {
    return this.http.get<LiquidacionNomina>(`${this.base}/periodos/${id}/liquidacion`);
  }

  cerrar(id: number): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/periodos/${id}/cerrar`, {});
  }

  reabrir(id: number): Observable<{ ok: boolean; estado: string; periodo: PeriodoNomina }> {
    return this.http.post<{ ok: boolean; estado: string; periodo: PeriodoNomina }>(
      `${this.base}/periodos/${id}/reabrir`,
      {},
    );
  }

  pagar(id: number, formaPago = 'Transferencia'): Observable<{ ok: boolean; egresosCreados: number }> {
    return this.http.post<{ ok: boolean; egresosCreados: number }>(`${this.base}/periodos/${id}/pagar`, {
      formaPago,
    });
  }

  descargarPila(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/periodos/${id}/pila.csv`, { responseType: 'blob' });
  }

  descargarPilaTxt(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/periodos/${id}/pila.txt`, { responseType: 'blob' });
  }

  abrirReciboHtml(idPeriodo: number, empleadoId: number, onError?: (msg: string) => void): void {
    this.http
      .get(`${this.base}/periodos/${idPeriodo}/recibo/${empleadoId}`, { responseType: 'text' })
      .subscribe({
        next: (html) => {
          const w = window.open('', '_blank', 'width=720,height=900');
          if (!w) {
            onError?.('Permita ventanas emergentes para ver la colilla.');
            return;
          }
          w.document.open();
          w.document.write(html);
          w.document.close();
        },
        error: (e) => onError?.(e?.error?.message || 'No se pudo generar la colilla'),
      });
  }
}
