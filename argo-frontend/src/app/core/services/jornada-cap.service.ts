import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { formatNumDoc, parseNumDocForApi } from '../utils/num-doc.helpers';
import type { AlumnoListItem } from './alumno.service';

export interface ContratacionDto {
  _id?: string;
  tipoIdentificacion?: string;
  numeroIdentificacion?: string;
  codContrato?: string;
  razoSocial?: string;
  nombreComercial?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  codMunicipio?: string;
  departamento?: string;
  pais?: string;
  codigoPostal?: string;
  /** 'En Ejecución' | 'Ejecutado' */
  estado?: string;
  /** Fecha de cierre del contrato (ISO o YYYY-MM-DD). */
  fechaFinalizacion?: string;
  fechacontrato?: string;
  objeto?: string;
  objetoContrato?: string;
  supervisor?: string;
  idSupervisor?: string | null;
  numerojornadas?: number;
  /** Cuántas jornadas se generan el mismo día calendario. */
  jornadasPorDia?: number;
  numeroAlumnos?: number;
  numeObjeJornada?: number;
  nombreCertificacion?: string;
  numeroHorascert?: string;
  incluiSab?: boolean;
  incluiDom?: boolean;
  incluiFest?: boolean;
  fechaInicJornadas?: string;
  numSesCert?: number;
  jornadasGeneradas?: boolean;
  /** juridica_empresa | juridica_oficial | juridica_ong | persona_natural */
  idClienteFacturacion?: string | null;
  /** Nombre mostrado en listados (desde catálogo clientes). */
  clienteNombre?: string;
  clienteIdentificacion?: string | null;
  valorContrato?: number;
  idFacturaElectronica?: string | null;
  facturadoAt?: string;
}

export interface JornadaCapDto {
  _id: string;
  idContrato: string;
  fechaProgramacion: string;
  municipio?: string;
  depto?: string;
  codMunicipio?: string;
  direccion?: string;
  supervisor?: string;
  estado: string;
  numeObjeJornada?: number;
  indiceEnDia?: number;
  lat?: number | null;
  lng?: number | null;
  /** MAPA | DISPOSITIVO_MOVIL | MANUAL */
  deteGeorefe?: string;
  contratoLabel?: string;
  codContrato?: string;
  clienteNombre?: string;
  /** Meta total alumnos del contrato. */
  numeroAlumnos?: number;
  /** Certificados vigentes del contrato (alumnos distintos). */
  certificadosContrato?: number;
  cumplidoContrato?: boolean;
  /** Certificados vigentes atribuidos a esta jornada. */
  certificadosJornada?: number;
  cumplidoJornada?: boolean;
}

export interface ClaseJornadaDto {
  _id: string;
  idJornada: string;
  idPrograma: string;
  fechaClase?: string;
  ubicacion?: string;
  idinstructor?: string;
  idEmpleadoInstructor?: number | null;
  idUsuarioInstructor?: string;
  instructorNombre?: string;
  programaNombre?: string;
  horaInicio?: string;
  horaFin?: string;
  duracionSegundos?: number | null;
  estado: string;
  fechaJornada?: string;
  jornadaEstado?: string;
  idContrato?: string;
  municipioJornada?: string;
  direccionJornada?: string;
  indiceEnDia?: number;
  codContrato?: string;
  contratoLabel?: string;
  /** Ruta relativa bajo uploads/ (evidenciascap/{codContrato}/fotos/...). */
  urlforo?: string;
}

export interface InstructorJornadaDto {
  idEmpleado: number;
  idUsuario: string;
  nombreCompleto: string;
  numeroDocumento?: string;
  cargo?: string;
}

@Injectable({ providedIn: 'root' })
export class JornadaCapService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/jornadas`;

  listarContratos(): Observable<ContratacionDto[]> {
    return this.http.get<ContratacionDto[]>(`${this.base}/contratos`);
  }

  crearContrato(dto: ContratacionDto): Observable<ContratacionDto> {
    return this.http.post<ContratacionDto>(`${this.base}/contratos`, dto);
  }

  actualizarContrato(id: string, dto: ContratacionDto): Observable<ContratacionDto> {
    return this.http.put<ContratacionDto>(`${this.base}/contratos/${id}`, dto);
  }

  eliminarContrato(id: string): Observable<{ ok: boolean; message?: string; jornadasEliminadas?: number }> {
    return this.http.delete<{ ok: boolean; message?: string; jornadasEliminadas?: number }>(
      `${this.base}/contratos/${id}`,
    );
  }

  generarJornadas(idContrato: string): Observable<{
    ok: boolean;
    count: number;
    total?: number;
    fechaDesde?: string;
    fechaInicioContrato?: string;
    ajustadoDesdeHoy?: boolean;
  }> {
    return this.http.post<{
      ok: boolean;
      count: number;
      total?: number;
      fechaDesde?: string;
      fechaInicioContrato?: string;
      ajustadoDesdeHoy?: boolean;
    }>(`${this.base}/contratos/${idContrato}/generar-jornadas`, {});
  }

  finalizarContrato(
    id: string,
    fechaFinalizacion?: string,
  ): Observable<{
    ok: boolean;
    contrato: ContratacionDto;
    jornadasCerradas?: number;
    message?: string;
  }> {
    return this.http.post<{
      ok: boolean;
      contrato: ContratacionDto;
      jornadasCerradas?: number;
      message?: string;
    }>(`${this.base}/contratos/${id}/finalizar`, { fechaFinalizacion: fechaFinalizacion || undefined });
  }

  eliminarJornada(id: string) {
    return this.http.delete<{ ok: boolean; message: string; restantes?: number }>(
      `${this.base}/jornadas/${id}`,
    );
  }

  jornadasDelDia(fecha?: string, idContrato?: string) {
    let p = new HttpParams();
    if (fecha) p = p.set('fecha', fecha);
    if (idContrato) p = p.set('idContrato', idContrato);
    return this.http.get<any[]>(`${this.base}/jornadas/del-dia`, { params: p });
  }

  listarJornadas(params?: {
    idContrato?: string;
    desde?: string;
    hasta?: string;
    creadoDesde?: string;
  }): Observable<JornadaCapDto[]> {
    let p = new HttpParams();
    if (params?.idContrato) p = p.set('idContrato', params.idContrato);
    if (params?.desde) p = p.set('desde', params.desde);
    if (params?.hasta) p = p.set('hasta', params.hasta);
    if (params?.creadoDesde) p = p.set('creadoDesde', params.creadoDesde);
    return this.http.get<JornadaCapDto[]>(`${this.base}/jornadas`, { params: p });
  }

  listarJornadasEnProceso(): Observable<JornadaCapDto[]> {
    return this.http.get<JornadaCapDto[]>(`${this.base}/jornadas/en-proceso`);
  }

  actualizarJornada(id: string, dto: Partial<JornadaCapDto>): Observable<JornadaCapDto> {
    return this.http.patch<JornadaCapDto>(`${this.base}/jornadas/${id}`, dto);
  }

  /** Municipio/departamento según lat/lng (proveedor configurable + Divipola). */
  resolverMunicipioGeoref(lat: number, lng: number): Observable<{
    municipio: string;
    depto: string;
    codMunicipio?: string | null;
    fuente?: string;
  }> {
    const p = new HttpParams().set('lat', String(lat)).set('lng', String(lng));
    return this.http.get<{ municipio: string; depto: string; codMunicipio?: string | null; fuente?: string }>(
      `${this.base}/jornadas/georef/municipio`,
      { params: p },
    );
  }

  listarClases(opts?: {
    idJornada?: string;
    idContrato?: string;
    creadoDesde?: string;
  }): Observable<ClaseJornadaDto[]> {
    let p = new HttpParams();
    if (opts?.idJornada) p = p.set('idJornada', opts.idJornada);
    if (opts?.idContrato) p = p.set('idContrato', opts.idContrato);
    if (opts?.creadoDesde) p = p.set('creadoDesde', opts.creadoDesde);
    return this.http.get<ClaseJornadaDto[]>(`${this.base}/clases`, { params: p });
  }

  obtenerClase(id: string): Observable<ClaseJornadaDto> {
    return this.http.get<ClaseJornadaDto>(`${this.base}/clases/${id}`);
  }

  listarClasesDelDia(fecha?: string): Observable<ClaseJornadaDto[]> {
    let p = new HttpParams();
    if (fecha) p = p.set('fecha', fecha);
    return this.http.get<ClaseJornadaDto[]>(`${this.base}/clases/del-dia`, { params: p });
  }

  crearClase(dto: {
    idJornada: string;
    idPrograma: string;
    ubicacion?: string;
    idEmpleadoInstructor?: number;
  }) {
    return this.http.post<ClaseJornadaDto>(`${this.base}/clases`, dto);
  }

  actualizarClase(
    id: string,
    dto: {
      idPrograma?: string;
      ubicacion?: string;
      idEmpleadoInstructor?: number;
      horaInicio?: string | null;
      horaFin?: string | null;
    },
  ) {
    return this.http.patch<ClaseJornadaDto>(`${this.base}/clases/${id}`, dto);
  }

  eliminarClase(id: string) {
    return this.http.delete<{ ok: boolean; message: string }>(`${this.base}/clases/${id}`);
  }

  iniciarClase(id: string) {
    return this.http.post<ClaseJornadaDto>(`${this.base}/clases/${id}/iniciar`, {});
  }

  finalizarClase(id: string) {
    return this.http.post(`${this.base}/clases/${id}/finalizar`, {});
  }

  sincronizarAsistenciasInscritos(idClase: string) {
    return this.http.post<{
      ok: boolean;
      registradas: number;
      certificadosNuevos: number;
      certificadosEmitidos?: Array<{
        certificado: Record<string, unknown>;
        nombreAlumno?: string;
        numDoc?: number;
      }>;
      message?: string;
    }>(`${this.base}/clases/${idClase}/sincronizar-asistencias`, {});
  }

  subirFotoEvidenciaClase(id: string, file: File): Observable<ClaseJornadaDto> {
    const fd = new FormData();
    fd.append('foto', file);
    return this.http.post<ClaseJornadaDto>(`${this.base}/clases/${id}/foto-evidencia`, fd);
  }

  registrarAsistencia(idClase: string, numDoc: number | string) {
    const nd = parseNumDocForApi(numDoc);
    return this.http.post(`${this.base}/clases/${idClase}/asistencia`, { numDoc: nd ?? numDoc });
  }

  listarAsistencias(idClase: string) {
    return this.http.get<any[]>(`${this.base}/clases/${idClase}/asistencias`);
  }

  quitarInscripcionClase(idClase: string, numDoc: number | string) {
    return this.http.delete<{ ok: boolean; numDoc: number }>(
      `${this.base}/clases/${idClase}/inscritos/${numDoc}`,
    );
  }

  eliminarAsistencia(idClase: string, numDoc: number | string) {
    return this.http.delete<{ ok: boolean; numDoc: number }>(
      `${this.base}/clases/${idClase}/asistencias/${numDoc}`,
    );
  }

  inscritosClase(idClase: string) {
    return this.http.get<Array<{
      numDoc: number;
      nombreCompleto: string;
      tieneAsistencia: boolean;
      asistenciaAt?: string | null;
      fechaMatricula?: string;
      yaCertificadoContrato?: boolean;
      certificadoCodigo?: string | null;
      certificadoId?: string | null;
    }>>(`${this.base}/clases/${idClase}/inscritos`);
  }

  certificadosGenerados(idContrato?: string) {
    let p = new HttpParams();
    if (idContrato) p = p.set('idContrato', idContrato);
    return this.http.get<any[]>(`${this.base}/certificados-generados`, { params: p });
  }

  listarCertificadosJornada(opts?: { idContrato?: string; q?: string; desde?: string }) {
    let p = new HttpParams();
    if (opts?.idContrato) p = p.set('idContrato', opts.idContrato);
    if (opts?.q) p = p.set('q', opts.q);
    if (opts?.desde) p = p.set('desde', opts.desde);
    return this.http.get<any[]>(`${this.base}/certificados-generados`, { params: p });
  }

  actualizarCertificadoJornada(id: string, dto: Record<string, unknown>) {
    return this.http.patch<any>(`${this.base}/certificados-generados/${id}`, dto);
  }

  eliminarCertificadoJornada(id: string) {
    return this.http.delete<{ ok: boolean }>(`${this.base}/certificados-generados/${id}`);
  }

  imprimirCertificadoJornada(id: string, onError?: (msg: string) => void): void {
    const url = `${this.base}/certificados-generados/${id}/html?v=${Date.now()}`;
    this.http.get(url, { responseType: 'text' }).subscribe({
      next: (html) => {
        const w = window.open('', '_blank', 'width=900,height=700');
        if (!w) {
          onError?.('Permita ventanas emergentes para imprimir el certificado.');
          return;
        }
        w.document.open();
        w.document.write(html);
        w.document.close();
      },
      error: (e) => onError?.(e?.error?.message || 'No se pudo generar el certificado.'),
    });
  }

  /** Programas de capacitación jornada (catálogo; no dependen del contrato). */
  programasJornadaCap() {
    return this.http.get<any[]>(`${this.base}/programas-jornada`);
  }

  listarSupervisores() {
    return this.http.get<any[]>(`${this.base}/supervisores`);
  }

  listarInstructores(): Observable<InstructorJornadaDto[]> {
    return this.http.get<InstructorJornadaDto[]>(`${this.base}/instructores`);
  }

  crearSupervisor(dto: { nombre: string; documento?: string; email?: string; telefono?: string }) {
    return this.http.post<{ _id: string; nombre: string }>(`${this.base}/supervisores`, dto);
  }

  buscarAlumnoDoc(numDoc: number | string) {
    return this.http.get<any>(`${this.base}/alumnos/doc/${encodeURIComponent(formatNumDoc(numDoc))}`);
  }

  buscarAlumnos(q: string, limit = 12) {
    let params = new HttpParams().set('limit', String(limit));
    if (q) params = params.set('q', q);
    return this.http.get<AlumnoListItem[]>(`${this.base}/alumnos`, { params });
  }

  matricularAlumno(dto: { numDoc: number | string; idPrograma: string; idClase?: string }) {
    const numDoc = parseNumDocForApi(dto.numDoc);
    return this.http.post(`${this.base}/matricular`, {
      numDoc: numDoc ?? dto.numDoc,
      idPrograma: dto.idPrograma,
      ...(dto.idClase ? { idClase: dto.idClase } : {}),
    });
  }

  progresoCertificacion(numDoc: number | string, idContrato: string) {
    const nd = parseNumDocForApi(numDoc);
    return this.http.get<{
      sesiones: number;
      numSesCert: number;
      cumplio: boolean;
      faltan: number;
      certificado?: { _id?: string; codigoCert?: string } | null;
    }>(`${this.base}/alumnos/${encodeURIComponent(formatNumDoc(nd ?? numDoc))}/progreso-cert`, {
      params: { idContrato },
    });
  }
}
