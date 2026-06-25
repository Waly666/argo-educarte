import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface DashboardSegmento {
  label: string;
  cantidad: number;
  total?: number;
  totalValor?: number;
  totalSaldo?: number;
  pct: number;
  estado?: string;
}

export interface DashboardSerieMes {
  mes: string;
  total?: number;
  cantidad: number;
}

export interface DashboardKpis {
  alumnos: number;
  matriculas: number;
  matriculasActivas?: number;
  programas: number;
  servicios: number;
  liquidaciones?: number;
  ingresosTotal: number;
  ingresosMes: number;
  egresosMes: number;
  egresosTotal?: number;
  recibosTotal?: number;
  recibosMes?: number;
  certificados: number;
  certificadosMes: number;
  cajasCerradas: number;
  cajasAbiertas: number;
  descuadresPendientes: number;
  carteraPendiente?: number;
  valorLiquidado?: number;
  totalAbonadoLiq?: number;
  ticketPromedio?: number;
  promedioLiquidacion?: number;
  egresosCount?: number;
}

export interface DashboardResumenFinanciero {
  ingresosHistorico: number;
  ingresosMes: number;
  egresosMes: number;
  egresosHistorico: number;
  netoMes: number;
  carteraPendiente: number;
  valorFacturado: number;
  totalAbonado: number;
  porCobrar: number;
}

export interface DashboardTipoMovimiento {
  tipo: string;
  cantidad: number;
  total: number;
  pct: number;
}

export interface DashboardFiltroFechas {
  activo: boolean;
  desde: string | null;
  hasta: string | null;
}

export interface DashboardStats {
  actualizadoEn: string;
  filtroFechas?: DashboardFiltroFechas;
  colores: string[];
  kpis: DashboardKpis;
  liquidacionesPorEstado: DashboardSegmento[];
  matriculasPorPago: DashboardSegmento[];
  ingresosPorMes: DashboardSerieMes[];
  ingresosPorTipo?: DashboardTipoMovimiento[];
  egresosPorTipo?: DashboardTipoMovimiento[];
  ingresosPorFormaPago: { forma: string; total: number; cantidad: number; pct: number }[];
  certificadosPorMes: DashboardSerieMes[];
  serviciosTodos: { servicio: string; cantidad: number; total: number }[];
  serviciosTop: { servicio: string; cantidad: number; total: number }[];
  matriculasPorPrograma: { programa: string; matriculas: number; pct: number }[];
  programasTop: { programa: string; matriculas: number; pct: number }[];
  cajaMes: { ingresos: number; egresos: number; neto: number; recibosMes: number };
  resumenFinanciero?: DashboardResumenFinanciero;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/dashboard`;

  estadisticas(filtro?: { desde?: string; hasta?: string }): Observable<DashboardStats> {
    const params: Record<string, string> = {};
    if (filtro?.desde) params['desde'] = filtro.desde;
    if (filtro?.hasta) params['hasta'] = filtro.hasta;
    return this.http.get<DashboardStats>(`${this.base}/estadisticas`, { params });
  }
}
