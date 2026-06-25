import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AutorizacionSupervisorDto } from './supervisor-auth.types';

import { ArqueoLinea } from '../constants/caja-arqueo.constants';

export interface ResumenServicioIngreso {
  servicio?: string;
  descripcion?: string;
  cantidad: number;
  total: number;
  efectivo?: number;
  otros?: number;
}

/** Fila por sesión para resumen de servicios en cierre general. */
export interface ResumenServicioPorSesion {
  idSesion: number;
  usuario?: string;
  servicio: string;
  total: number;
}

export interface CajaIngresoDetalleItem {
  idSesion?: number;
  usuario?: string;
  idIngreso: string;
  numRecibo?: string | null;
  fecha?: string;
  servicio?: string;
  formaPago?: string;
  tipoPagoDescr?: string;
  idTipoPago?: string | null;
  pagador?: string | null;
  valor: number;
}

export interface ResumenTipoMovimiento {
  cantidad: number;
  total: number;
  descripcion?: string;
  idTipoPago?: string;
  tipoEgreso?: string;
  formaPago?: string;
  efectivo?: number;
  otros?: number;
}

export interface ResumenCaja {
  idSesion: number;
  usuario?: string;
  nombreCajero?: string;
  idUsuario?: string;
  nombreCaja?: string;
  estado?: string;
  fechaApertura: string;
  fechaCierre?: string;
  saldoInicial: number;
  totalIngresos: number;
  totalIngresosEfectivo?: number;
  totalIngresosElectronicos?: number;
  totalEgresos: number;
  totalEgresosEfectivo?: number;
  saldoTeorico: number;
  ventasBrutas?: number;
  efectivoEsperado?: number;
  totalGastos?: number;
  totalRetiros?: number;
  cantidadRecibos?: number;
  efectivoContado?: number;
  diferencia?: number;
  cantidadIngresos: number;
  cantidadEgresos: number;
  ingresosPorTipo: ResumenTipoMovimiento[];
  ingresosPorServicio?: ResumenServicioIngreso[];
  egresosPorTipo: ResumenTipoMovimiento[];
  egresosPorFormaPago?: ResumenTipoMovimiento[];
  arqueo?: ArqueoLinea[];
  arqueoTotal?: number;
}

export interface CajaDescuadre {
  idDescuadre: number;
  idSesion: number;
  idUsuarioCajero?: string;
  usuarioCajero?: string;
  empleadoId?: number;
  efectivoEsperado: number;
  efectivoContado: number;
  diferencia: number;
  montoDebe: number;
  estado: 'pendiente' | 'resuelto' | 'en_nomina' | 'descontado_nomina';
  autorizadoPor?: string;
  nombreAutoriza?: string;
  idNovedadNomina?: number;
  fechaCierre?: string;
}

export interface ResumenDescuadresMensual {
  mes: string;
  totalRegistros: number;
  cajeros: {
    idUsuarioCajero?: string;
    usuarioCajero?: string;
    empleadoId?: number;
    cantidadDescuadres: number;
    pendientes: number;
    totalDebe: number;
    totalPendiente: number;
  }[];
}

export interface CajaSesion {
  _id?: string;
  idSesion: number;
  idSede?: string | null;
  sedeNombre?: string | null;
  estado: 'abierta' | 'cerrada';
  fechaReapertura?: string | null;
  fechaCierreAnterior?: string | null;
  usuario?: string;
  idUsuario?: string;
  nombreCaja?: string;
  rolCajero?: string;
  fechaApertura: string;
  fechaCierre?: string;
  saldoInicial: number;
  saldoFinal?: number | null;
  efectivoContado?: number | null;
  diferencia?: number | null;
  descuadreEstado?: 'pendiente' | 'resuelto' | 'en_nomina' | 'descontado_nomina' | null;
  descuadreMontoDebe?: number | null;
  descuadreDiferencia?: number | null;
  idDescuadre?: number | null;
  sinEmpleadoNomina?: boolean;
  observacionesApertura?: string;
  observacionesCierre?: string;
  resumen?: ResumenCaja;
}

export interface CajaActivaResponse {
  abierta: boolean;
  sesion: CajaSesion | null;
  resumenParcial?: ResumenCaja;
}

export interface CajaAbiertaItem {
  sesion: CajaSesion;
  resumenParcial: ResumenCaja;
}

export interface CierreCajaResponse {
  sesion: CajaSesion;
  resumen: ResumenCaja;
  descuadre?: CajaDescuadre | null;
}

export interface CajaDescuadreResumen {
  idSesion: number;
  usuario?: string;
  efectivoEsperado: number;
  efectivoContado: number;
  diferencia: number;
  montoDebe: number;
  estado: string;
  fechaCierre?: string;
}

export interface CajaEgresoDetalleItem {
  idSesion?: number;
  usuario?: string;
  idEgreso: string;
  numRecibo?: string;
  fechaEgreso: string;
  concepto: string;
  valorEgreso: number;
  formaPago?: string;
  tipoEgresoDescr?: string | null;
  pagueA?: string | null;
}

export interface EstadoCierreGeneralDia {
  fechaDia: string;
  cierre: CajaCierreGeneral | null;
  registrado: boolean;
  puedeRegistrar: boolean;
}

export interface ResumenCierreGeneral {
  fechaDia?: string;
  idSede?: string | null;
  sedeNombre?: string | null;
  periodoDesde: string;
  periodoHasta: string;
  cantidadCajas: number;
  /** Cajas con fecha de cierre anterior a fechaDia del registro. */
  sesionesDiasAnteriores?: number;
  cajasAbiertas: { idSesion: number; usuario?: string }[];
  tieneCajasAbiertas: boolean;
  saldoInicialTotal: number;
  totalIngresos: number;
  totalEgresos: number;
  saldoTeoricoConsolidado: number;
  totalEfectivoEsperado?: number;
  totalEfectivoContado?: number;
  totalDiferencia?: number;
  cantidadDescuadres?: number;
  cantidadIngresos: number;
  cantidadEgresos: number;
  ingresosPorTipo: ResumenTipoMovimiento[];
  ingresosPorServicio?: ResumenServicioIngreso[];
  ingresosPorServicioDetalle?: ResumenServicioPorSesion[];
  egresosPorTipo: ResumenTipoMovimiento[];
  egresosPorFormaPago?: ResumenTipoMovimiento[];
  descuadres?: CajaDescuadreResumen[];
  ingresosDetalle?: CajaIngresoDetalleItem[];
  egresosDetalle?: CajaEgresoDetalleItem[];
  detalleSesiones: ResumenCaja[];
  idsSesiones: number[];
}

export interface CajaCierreGeneral {
  idCierreGeneral: number;
  fechaDia?: string;
  idSede?: string | null;
  sedeNombre?: string | null;
  periodoDesde: string;
  periodoHasta: string;
  fechaRegistro: string;
  usuarioAdmin?: string;
  cantidadCajas?: number;
  resumen?: ResumenCierreGeneral;
}

export interface FiltrosSesiones {
  limit?: number;
  estado?: string;
  usuario?: string;
  desde?: string;
  hasta?: string;
  todas?: boolean;
  /** Filtra por fecha de cierre (listado admin de cierres). */
  porCierre?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CajaSesionService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/caja`;

  activa(): Observable<CajaActivaResponse> {
    return this.http.get<CajaActivaResponse>(`${this.base}/sesiones/activa`);
  }

  listar(f: FiltrosSesiones = {}): Observable<CajaSesion[]> {
    let params = new HttpParams();
    if (f.limit) params = params.set('limit', String(f.limit));
    if (f.estado) params = params.set('estado', f.estado);
    if (f.usuario) params = params.set('usuario', f.usuario);
    if (f.desde) params = params.set('desde', f.desde);
    if (f.hasta) params = params.set('hasta', f.hasta);
    if (f.todas) params = params.set('todas', '1');
    if (f.porCierre) params = params.set('porCierre', '1');
    return this.http.get<CajaSesion[]>(`${this.base}/sesiones`, { params });
  }

  listarAbiertas(): Observable<CajaAbiertaItem[]> {
    return this.http.get<CajaAbiertaItem[]>(`${this.base}/sesiones/abiertas`);
  }

  abrir(saldoInicial: number, observaciones?: string): Observable<CajaSesion> {
    return this.http.post<CajaSesion>(`${this.base}/sesiones/abrir`, { saldoInicial, observaciones });
  }

  cerrar(
    idSesion: number,
    opts?: {
      observaciones?: string;
      efectivoContado?: number;
      arqueo?: ArqueoLinea[];
      idPeriodoNomina?: number;
    } & AutorizacionSupervisorDto,
  ): Observable<CierreCajaResponse> {
    return this.http.post<CierreCajaResponse>(`${this.base}/sesiones/${idSesion}/cerrar`, opts ?? {});
  }

  cerrarMultiples(body: {
    cierres: { idSesion: number; efectivoContado: number; arqueo?: ArqueoLinea[]; observaciones?: string }[];
    autorizadoUsername?: string;
    autorizadoPassword?: string;
  }): Observable<{ cierres: CierreCajaResponse[]; cantidad: number }> {
    return this.http.post<{ cierres: CierreCajaResponse[]; cantidad: number }>(
      `${this.base}/sesiones/cerrar-multiples`,
      body,
    );
  }

  listarDescuadres(f: {
    estado?: string;
    idUsuario?: string;
    desde?: string;
    hasta?: string;
    limit?: number;
  } = {}): Observable<CajaDescuadre[]> {
    let params = new HttpParams();
    if (f.estado) params = params.set('estado', f.estado);
    if (f.idUsuario) params = params.set('idUsuario', f.idUsuario);
    if (f.desde) params = params.set('desde', f.desde);
    if (f.hasta) params = params.set('hasta', f.hasta);
    if (f.limit) params = params.set('limit', String(f.limit));
    return this.http.get<CajaDescuadre[]>(`${this.base}/descuadres`, { params });
  }

  resumenDescuadresMensual(mes: string): Observable<ResumenDescuadresMensual> {
    return this.http.get<ResumenDescuadresMensual>(`${this.base}/descuadres/resumen-mensual`, {
      params: { mes },
    });
  }

  recalcularDescuadre(idSesion: number): Observable<{ resuelto: boolean; descuadre?: CajaDescuadre | null }> {
    return this.http.post<{ resuelto: boolean; descuadre?: CajaDescuadre | null }>(
      `${this.base}/descuadres/${idSesion}/recalcular`,
      {},
    );
  }

  resumen(idSesion: number): Observable<{ sesion: CajaSesion; resumen: ResumenCaja; descuadre?: CajaDescuadre | null }> {
    return this.http.get<{ sesion: CajaSesion; resumen: ResumenCaja; descuadre?: CajaDescuadre | null }>(
      `${this.base}/sesiones/${idSesion}/resumen`,
    );
  }

  reabrirSesion(idSesion: number, observaciones?: string): Observable<{ sesion: CajaSesion; message?: string }> {
    return this.http.post<{ sesion: CajaSesion; message?: string }>(
      `${this.base}/sesiones/${idSesion}/reabrir`,
      { observaciones: observaciones || undefined },
    );
  }

  ingresoCuadreDescuadre(
    idSesion: number,
    body: { valor: number; idTipoPago?: string; observaciones?: string },
  ): Observable<{ ingreso: unknown; descuadre: CajaDescuadre | null; resuelto: boolean }> {
    return this.http.post<{ ingreso: unknown; descuadre: CajaDescuadre | null; resuelto: boolean }>(
      `${this.base}/sesiones/${idSesion}/ingreso-cuadre`,
      body,
    );
  }

  previewCierreGeneral(
    fechaDia: string,
  ): Observable<ResumenCierreGeneral & { estadoDia?: EstadoCierreGeneralDia }> {
    const params = new HttpParams().set('fechaDia', fechaDia);
    return this.http.get<ResumenCierreGeneral & { estadoDia?: EstadoCierreGeneralDia }>(
      `${this.base}/cierre-general/preview`,
      { params },
    );
  }

  estadoCierreGeneralDia(fecha: string): Observable<EstadoCierreGeneralDia> {
    return this.http.get<EstadoCierreGeneralDia>(`${this.base}/cierre-general/estado-dia`, {
      params: { fecha },
    });
  }

  registrarCierreGeneral(body: {
    fechaDia: string;
    observaciones?: string;
    forzar?: boolean;
  }): Observable<{ cierre: CajaCierreGeneral; resumen: ResumenCierreGeneral }> {
    return this.http.post<{ cierre: CajaCierreGeneral; resumen: ResumenCierreGeneral }>(
      `${this.base}/cierre-general`,
      body,
    );
  }

  listarCierresGenerales(limit = 15): Observable<CajaCierreGeneral[]> {
    return this.http.get<CajaCierreGeneral[]>(`${this.base}/cierre-general`, {
      params: { limit: String(limit) },
    });
  }

  ingresosSesionActiva(): Observable<CajaIngresoItem[]> {
    return this.http.get<CajaIngresoItem[]>(`${this.base}/sesiones/activa/ingresos`);
  }

  egresosSesionActiva(): Observable<CajaEgresoItem[]> {
    return this.http.get<CajaEgresoItem[]>(`${this.base}/sesiones/activa/egresos`);
  }

  ingresosPorSesion(idSesion: number): Observable<CajaIngresoItem[]> {
    return this.http.get<CajaIngresoItem[]>(`${this.base}/sesiones/${idSesion}/ingresos`);
  }

  egresosPorSesion(idSesion: number): Observable<CajaEgresoItem[]> {
    return this.http.get<CajaEgresoItem[]>(`${this.base}/sesiones/${idSesion}/egresos`);
  }
}

export interface CajaIngresoItem {
  _id: string;
  numDoc?: number | null;
  numRecibo?: string;
  valor: number;
  fecha: string;
  tipoPagoDescr?: string;
  liquidacionDescr?: string;
  tipoAbonoDescr?: string;
  cuentaBancariaDescr?: string;
  tipoAbono?: string;
  idTipoPago?: string;
  idSesion?: number;
  esIngresoCaja?: boolean;
  tipoIngresoDescr?: string;
  tipoIngreso?: string;
  concepto?: string;
  recibidoDe?: string;
  recibiDe?: string;
  pagadorDescr?: string;
  documentoTercero?: string;
  formaPago?: string;
  numComprobante?: string;
  numTransferencia?: string;
  cuentaRecibe?: string;
  cuadreDescuadre?: boolean;
}

export interface CajaEgresoItem {
  idEgreso: string;
  numRecibo?: string;
  fechaEgreso: string;
  valorEgreso: number;
  concepto: string;
  pagueA?: string;
  formaPago?: string;
  tipoEgresoDescr?: string;
  urlSoporte?: string | null;
  idSesion?: number;
  cuadreDescuadre?: boolean;
}
