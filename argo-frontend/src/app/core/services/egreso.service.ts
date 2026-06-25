import { HttpClient, HttpParams } from '@angular/common/http';

import { Injectable, inject } from '@angular/core';

import { Observable } from 'rxjs';



import { environment } from '../../../environments/environment';
import { AutorizacionSupervisorDto } from './supervisor-auth.types';



/** Catálogo tipoEgreso — ver Config → Tipos de egreso */

export interface TipoEgresoCat {

  idTipoEgreso: number;

  tipo?: string;

  requiereEmpleado?: boolean | string | number;

  requiereVehiculo?: boolean | string | number;

  efectoNomina?: '' | 'prestamo' | 'abono_adelanto' | 'pago_sueldo' | string;

  esRetiroCaja?: boolean | string | number;

}

function flagActivo(v: unknown): boolean {
  if (v === true || v === 1) return true;
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return s === '1' || s === 'true' || s === 'si' || s === 'sí' || s === 'yes';
}



export interface NovedadAnticipoCreada {

  idNovedad: number;

  idPeriodo: number;

  periodoNombre?: string;

  naturaleza: string;

  tipoNovedad: string;

  valor: number;

}



export const FORMAS_PAGO_EGRESO = [

  'Efectivo',

  'Transferencia',

  'Cheque',

  'Tarjeta debito',

  'Tarjeta de Credito',

] as const;



export type FormaPagoEgreso = (typeof FORMAS_PAGO_EGRESO)[number];



export interface Egreso {

  idEgreso: string;

  numRecibo?: string | null;

  fechaEgreso?: string;

  valorEgreso: number;

  pagueA?: string | null;

  numeroDocumento?: string | null;

  idEmpleado?: number | null;

  empleadoNombre?: string | null;

  empleadoCargo?: string | null;

  concepto: string;

  tipoEgreso?: string | null;

  tipoEgresoDescr?: string | null;

  tipoRequiereEmpleado?: boolean;

  tipoRequiereVehiculo?: boolean;

  tipoEfectoNomina?: string | null;

  placa?: string | null;

  vehiculoMarca?: string | null;

  vehiculoLinea?: string | null;

  vehiculoClase?: string | null;

  formaPago?: FormaPagoEgreso | string | null;

  numTransferencia?: string | null;

  fechaTransferencia?: string | null;

  cuentaOrigen?: string | null;

  cuentaOrigenDescr?: string | null;

  cuentaDestino?: string | null;

  bancoDestino?: string | null;

  bancoDestinoDescr?: string | null;

  urlSoporte?: string | null;

  anticipoNomina?: string | null;

  idPeriodo?: number | null;

  idNovedadGenerada?: number | null;

  idSesion?: number | null;

  novedadAnticipo?: NovedadAnticipoCreada | null;

  fechaAudi?: string;

  userAddReg?: string;

  userChangeRecord?: string;

  fechaMod?: string;

  autorizadoPor?: string | null;

  nombreAutoriza?: string | null;

  autorizadoEn?: string | null;

  estado?: string | null;

  anulado?: boolean;

  anuladoEn?: string | null;

  anuladoPor?: string | null;

  valorAnulado?: number | null;

  motivoAnulacion?: string | null;

}



export interface EgresoDto {

  fechaEgreso?: string;

  valorEgreso?: number;

  pagueA?: string;

  numeroDocumento?: string;

  concepto?: string;

  tipoEgreso?: string;

  formaPago?: string;

  numTransferencia?: string;

  fechaTransferencia?: string;

  cuentaOrigen?: string;

  cuentaDestino?: string;

  bancoDestino?: string;

  idPeriodo?: number | '';

  placa?: string;

}

export type { AutorizacionSupervisorDto } from './supervisor-auth.types';
export type AutorizacionRetiroDto = import('./supervisor-auth.types').AutorizacionSupervisorDto;

export interface VehiculoOpcionEgreso {
  placa: string;
  nombreMarca?: string;
  nombreLinea?: string;
  claseVehiculo?: string;
  modelo?: string;
  tipoServicio?: string;
}



@Injectable({ providedIn: 'root' })

export class EgresoService {

  private http = inject(HttpClient);

  private base = `${environment.apiUrl}/egresos`;



  listar(opts?: { q?: string; numeroDocumento?: string }): Observable<Egreso[]> {

    let params = new HttpParams();

    if (opts?.q) params = params.set('q', opts.q);

    if (opts?.numeroDocumento) params = params.set('numeroDocumento', opts.numeroDocumento);

    return this.http.get<Egreso[]>(this.base, { params });

  }

  listarTodosAdmin(opts?: {
    q?: string;
    numeroDocumento?: string;
    desde?: string;
    hasta?: string;
    idSesion?: number;
    skip?: number;
    limit?: number;
  }): Observable<{ items: Egreso[]; total: number; skip: number; limit: number; totalValor: number }> {
    let params = new HttpParams();
    if (opts?.q) params = params.set('q', opts.q);
    if (opts?.numeroDocumento) params = params.set('numeroDocumento', opts.numeroDocumento);
    if (opts?.desde) params = params.set('desde', opts.desde);
    if (opts?.hasta) params = params.set('hasta', opts.hasta);
    if (opts?.idSesion != null) params = params.set('idSesion', String(opts.idSesion));
    if (opts?.skip != null) params = params.set('skip', String(opts.skip));
    if (opts?.limit != null) params = params.set('limit', String(opts.limit));
    return this.http.get<{ items: Egreso[]; total: number; skip: number; limit: number; totalValor: number }>(
      `${this.base}/admin/todos`,
      { params },
    );
  }



  formasPago(): Observable<string[]> {

    return this.http.get<string[]>(`${this.base}/formas-pago`);

  }

  opcionesVehiculos(q = '', limit = 40): Observable<VehiculoOpcionEgreso[]> {
    let params = new HttpParams().set('limit', String(limit));
    if (q) params = params.set('q', q);
    return this.http.get<VehiculoOpcionEgreso[]>(`${this.base}/vehiculos-opciones`, { params });
  }

  verificarPlacaVehiculo(placa: string): Observable<{ existe: boolean; vehiculo: VehiculoOpcionEgreso | null }> {
    return this.http.get<{ existe: boolean; vehiculo: VehiculoOpcionEgreso | null }>(
      `${this.base}/verificar-placa/${encodeURIComponent(placa)}`,
    );
  }



  obtener(id: string): Observable<Egreso> {

    return this.http.get<Egreso>(`${this.base}/${id}`);

  }



  crear(
    dto: EgresoDto,
    soporte?: File | null,
    auth?: AutorizacionSupervisorDto,
  ): Observable<Egreso> {
    return this.http.post<Egreso>(this.base, this.toFormData(dto, soporte, auth));
  }



  actualizar(
    id: string,
    dto: EgresoDto,
    soporte?: File | null,
    auth?: AutorizacionSupervisorDto,
  ): Observable<Egreso> {
    return this.http.put<Egreso>(`${this.base}/${id}`, this.toFormData(dto, soporte, auth));
  }



  eliminar(id: string, auth?: AutorizacionSupervisorDto): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}`, { body: auth || {} });
  }



  urlArchivo(path?: string | null): string | null {

    if (!path) return null;

    if (path.startsWith('http')) return path;

    return `${environment.uploadsUrl}/${path.replace(/^\/+/, '')}`;

  }



  private toFormData(
    dto: EgresoDto,
    soporte?: File | null,
    auth?: AutorizacionSupervisorDto,
  ): FormData {

    const fd = new FormData();

    for (const [k, v] of Object.entries(dto)) {

      if (v === undefined || v === null || v === '') continue;

      fd.append(k, String(v));

    }

    if (auth?.autorizadoUsername) fd.append('autorizadoUsername', auth.autorizadoUsername);

    if (auth?.autorizadoPassword) fd.append('autorizadoPassword', auth.autorizadoPassword);

    if (soporte) fd.append('soporte', soporte, soporte.name);

    return fd;

  }

}



/** Interpreta flags del catálogo tipoEgreso en el cliente */

export function configTipoEgreso(t?: TipoEgresoCat | null) {

  if (!t) {

    return { requiereEmpleado: false, requiereVehiculo: false, efectoNomina: '', generaDeduccion: false };

  }

  const efecto = String(t.efectoNomina || '').toLowerCase();

  const reqEmp = flagActivo(t.requiereEmpleado);

  let reqVehi = flagActivo(t.requiereVehiculo);

  const generaDeduccion = efecto === 'prestamo' || efecto === 'abono_adelanto';

  if (!reqVehi) {

    const name = String(t.tipo || '')

      .normalize('NFD')

      .replace(/\p{M}/gu, '')

      .trim()

      .toUpperCase();

    if (/VEHICULO|COMBUSTIBLE/.test(name)) reqVehi = true;

  }

  return {

    requiereEmpleado: reqEmp || generaDeduccion,

    requiereVehiculo: reqVehi,

    efectoNomina: efecto,

    generaDeduccion,

  };

}

/** Traslado de efectivo (tipo catálogo «Retiro»). */
export function esRetiroCajaTipo(t?: TipoEgresoCat | null): boolean {
  if (!t) return false;
  if (t.esRetiroCaja === true || t.esRetiroCaja === 1 || t.esRetiroCaja === '1') return true;
  const name = String(t.tipo || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toUpperCase();
  return name === 'RETIRO' || /^RETIRO\b/.test(name);
}


