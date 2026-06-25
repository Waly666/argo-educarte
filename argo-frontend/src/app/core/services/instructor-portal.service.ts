import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { Empleado } from './empleado.service';

export type OrigenClaseInstructor = 'cea' | 'jornada';

export interface ClaseInstructorPortalDto {
  _id: string;
  origen: OrigenClaseInstructor;
  tipoClase: string;
  estado: string;
  fechaClase: string;
  horaDesde: string;
  horaHasta: string;
  programaLabel: string;
  temaNombre: string;
  aulaNombre?: string;
  tallerNombre?: string;
  idVehiculo?: string;
  vehiculoLabel?: string;
  inscritos?: number | null;
  instructorNombre?: string;
  asignadaEn?: string;
  idJornada?: string | null;
  idProg?: string | null;
}

export interface MisClasesInstructorRes {
  desde: string;
  hasta: string;
  total: number;
  clases: ClaseInstructorPortalDto[];
}

export interface InspeccionRequeridaInstructor {
  requerida: boolean;
  fecha: string;
  mensaje: string | null;
  vehiculo: {
    _id: string | null;
    placa: string;
    marcaLinea: string;
    claseVehiculo: string;
  } | null;
  clase: ClaseInstructorPortalDto | null;
  inspeccionCompleta: boolean;
}

export interface ClaseProximaInstructorDto extends ClaseInstructorPortalDto {
  minutosRestantes?: number;
  minutosHastaInicio?: number;
}

export interface AlertasInstructorPortal {
  minutosVentana: number;
  proximas: ClaseProximaInstructorDto[];
  totalProximas: number;
  asignadasRecientes: ClaseInstructorPortalDto[];
  totalAsignadasRecientes: number;
  inspeccion: InspeccionRequeridaInstructor;
  idEmpleado: number;
  nombreInstructor: string;
}

export interface ActualizarPerfilInstructorBody {
  correoPersonal?: string;
  correoCorporativo?: string;
  telefono?: string;
  celular?: string;
  direccion?: string;
  ciudad?: string;
  departamento?: string;
}

@Injectable({ providedIn: 'root' })
export class InstructorPortalService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/instructor-portal`;

  miPerfil(): Observable<Empleado> {
    return this.http.get<Empleado>(`${this.base}/mi-perfil`);
  }

  actualizarMiPerfil(body: ActualizarPerfilInstructorBody): Observable<Empleado> {
    return this.http.patch<Empleado>(`${this.base}/mi-perfil`, body);
  }

  misClases(opts?: { desde?: string; hasta?: string }): Observable<MisClasesInstructorRes> {
    let params = new HttpParams();
    if (opts?.desde) params = params.set('desde', opts.desde);
    if (opts?.hasta) params = params.set('hasta', opts.hasta);
    return this.http.get<MisClasesInstructorRes>(`${this.base}/mis-clases`, { params });
  }

  misAlertas(opts?: { minutos?: number; diasAsignacion?: number }): Observable<AlertasInstructorPortal> {
    let params = new HttpParams();
    if (opts?.minutos != null) params = params.set('minutos', String(opts.minutos));
    if (opts?.diasAsignacion != null) params = params.set('diasAsignacion', String(opts.diasAsignacion));
    return this.http.get<AlertasInstructorPortal>(`${this.base}/mis-alertas`, { params });
  }
}

export function labelOrigenClaseInstructor(origen: OrigenClaseInstructor | string): string {
  if (origen === 'jornada') return 'Jornada carpa';
  return 'CEA';
}

export function labelTipoClaseInstructor(tipo: string): string {
  if (tipo === 'teoria') return 'Teoría';
  if (tipo === 'taller') return 'Taller';
  if (tipo === 'practica') return 'Práctica';
  if (tipo === 'jornada') return 'Jornada';
  return tipo;
}
