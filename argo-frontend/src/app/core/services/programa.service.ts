import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface Programa {
  _id?: string;
  idPrograma: number | string;
  codigoProg?: string;
  nombreProg: string;
  nomCert?: string;
  idTipCap?: string | number;
  semestres?: number | null;
  horas?: number | null;
  horasTeoria?: number | null;
  horasPractica?: number | null;
  horasTaller?: number | null;
  valorMatricula?: number;
  /** Habilita el módulo de cohortes académicas (formación grupal por semestre). */
  usaCohortes?: boolean;
  descripcion?: string | null;
  estado?: string;
  requistos?: string | null;
  diasVencimiento?: number;
  /** Tipo de plantilla de certificado (Config. Certificados). Vacío = automático */
  tipoCertificado?: string | null;
  /** Texto para ficha del curso en portal virtual (HTML/markdown simple). */
  descripcionVirtual?: string | null;
  /** Ruta relativa bajo /uploads (programas-virtual/…). */
  urlPortadaVirtual?: string | null;
  /** Precio virtual del servicio de matrícula (solo informativo en listado). */
  tarifaVirtual?: number;
  /** Permite refrendación (renovación) con tarifa 3 para alumnos ya certificados. */
  admiteRevalidacion?: boolean;
  /** Al matricular, aplica tarifa 3 automáticamente si califica refrendación. */
  aplicarTarifaRevalidacionAuto?: boolean;
  esCapacitacionVirtual?: boolean;
  /** Modalidades de oferta: VIRTUAL, PRESENCIAL, MIXTA */
  modalidades?: string[];
  tarifasPermitidas?: number[];
  soloVirtual?: boolean;
  admiteVirtual?: boolean;
  admitePresencial?: boolean;
  modalidadLabels?: string[];
  fechaAudi?: string | Date;
  userAddReg?: string;
  userChangeRecord?: string;
  fechaMod?: string | Date;
}

export interface ServicioPrograma {
  idServ?: number | string;
  numSemestre?: number | null;
  tipoServ?: string | number;
  idProg?: number | string;
  descrServicio?: string;
  facturar?: string | boolean;
  iva?: number;
  tarifa1?: number;
  tarifa2?: number;
  tarifa3?: number;
  /** Precio educación virtual (matrícula con tarifa 4). */
  tarifaVirtual?: number;
  rolServicio?: string;
  usaCantidad?: boolean;
  unidadMedida?: string;
  excluirMatricula?: boolean;
  fechaAudi?: string | Date;
  userAddReg?: string;
  userChangeRecord?: string;
  fechaMod?: string | Date;
}

export interface ProgramaDto {
  codigoProg?: string;
  nombreProg: string;
  nomCert?: string;
  idTipCap: string | number | '';
  semestres?: number | null;
  horas?: number | null;
  horasTeoria?: number | null;
  horasPractica?: number | null;
  horasTaller?: number | null;
  valorMatricula?: number;
  usaCohortes?: boolean;
  descripcion?: string;
  estado?: string;
  requistos?: string;
  diasVencimiento?: number;
  /** Refrendación / renovación de certificados no formales. */
  admiteRevalidacion?: boolean;
  aplicarTarifaRevalidacionAuto?: boolean;
  tipoCertificado?: string | null;
  tarifa1?: number;
  tarifa2?: number;
  tarifa3?: number;
  tarifaVirtual?: number;
  descripcionVirtual?: string | null;
  urlPortadaVirtual?: string | null;
  descrServicio?: string;
  tipoServ?: string | number;
  facturar?: string;
  iva?: number;
  /** Tarifa por hora del servicio adicional de clase práctica (programas licencia de conducción). */
  tarifaHoraPractica?: number;
  modalidades?: string[];
}

export interface ProgramaDetalle {
  programa: Programa;
  servicio: ServicioPrograma | null;
  servicios?: ServicioPrograma[];
}

@Injectable({ providedIn: 'root' })
export class ProgramaService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/programas`;

  listar(opts?: { q?: string; activos?: boolean; catalogo?: boolean; limit?: number }): Observable<Programa[]> {
    let params = new HttpParams();
    if (opts?.q) params = params.set('q', opts.q);
    if (opts?.activos === false) params = params.set('activos', 'false');
    if (opts?.catalogo) params = params.set('catalogo', '1');
    if (opts?.limit != null) params = params.set('limit', String(opts.limit));
    return this.http.get<Programa[]>(this.base, { params });
  }

  obtener(id: string | number): Observable<ProgramaDetalle> {
    return this.http.get<ProgramaDetalle>(`${this.base}/${id}`);
  }

  crear(dto: ProgramaDto): Observable<ProgramaDetalle & { message?: string }> {
    return this.http.post<ProgramaDetalle & { message?: string }>(this.base, dto);
  }

  actualizar(
    id: string | number,
    dto: ProgramaDto,
  ): Observable<ProgramaDetalle & { message?: string }> {
    return this.http.put<ProgramaDetalle & { message?: string }>(`${this.base}/${id}`, dto);
  }

  subirPortadaVirtual(
    id: string | number,
    file: File,
  ): Observable<{ urlPortadaVirtual: string; message?: string }> {
    const fd = new FormData();
    fd.append('portada', file);
    return this.http.post<{ urlPortadaVirtual: string; message?: string }>(
      `${this.base}/${id}/portada-virtual`,
      fd,
    );
  }

  eliminar(id: string | number): Observable<{ ok: boolean; message?: string }> {
    return this.http.delete<{ ok: boolean; message?: string }>(`${this.base}/${id}`);
  }

  listarMatriculas(
    id: string | number,
    opts?: { q?: string; pagada?: string; modalidad?: 'virtual' | 'presencial' | ''; skip?: number; limit?: number },
  ): Observable<{ items: MatriculaProgramaItem[]; total: number; skip: number; limit: number }> {
    let params = new HttpParams();
    if (opts?.q) params = params.set('q', opts.q);
    if (opts?.pagada) params = params.set('pagada', opts.pagada);
    if (opts?.modalidad) params = params.set('modalidad', opts.modalidad);
    if (opts?.skip != null) params = params.set('skip', String(opts.skip));
    if (opts?.limit != null) params = params.set('limit', String(opts.limit));
    return this.http.get<{ items: MatriculaProgramaItem[]; total: number; skip: number; limit: number }>(
      `${this.base}/${id}/matriculas`,
      { params },
    );
  }
}

export interface MatriculaProgramaItem {
  idMatricula: string;
  numDoc: number | string;
  alumnoId?: string | null;
  nombreCompleto: string;
  celular?: string | null;
  correo?: string | null;
  fechaMat?: string | Date;
  valorMat: number;
  tarifa: number;
  modalidad: 'virtual' | 'presencial';
  modalidadLabel: string;
  pagada: string;
  saldo: number;
  estado: string;
}
