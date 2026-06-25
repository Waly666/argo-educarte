import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface ProgramaCohorte {
  idProg: string;
  codigoProg: string;
  nombreProg: string;
  horas: number;
  semestres: number;
}

export interface InstructorCohorte {
  idEmpleado: number;
  nombreCompleto: string;
  cargo?: string;
}

export interface CatalogoMateria {
  _id: string;
  nombre: string;
  area?: string;
  descripcion?: string;
  activo?: boolean;
}

export interface MateriaPlan {
  _id?: string;
  idMateriaCatalogo?: string | null;
  nombre: string;
  horas: number;
  orden?: number;
  activo?: boolean;
}

export interface SemestrePlan {
  numSemestre: number;
  horas: number;
  materias: MateriaPlan[];
}

export interface PlanPrograma {
  idProg: string;
  nombreProg: string;
  horasTotal: number;
  totalSemestres: number;
  horasSugeridasPorSemestre: number;
  semestres: SemestrePlan[];
}

export interface CriterioNota {
  _id?: string;
  nombre: string;
  pesoPct: number;
  tipo: 'MANUAL' | 'EVALUACIONES' | 'ASISTENCIA';
  orden?: number;
}

export interface ConfigEvaluacionesPrograma {
  pesoParcialesPct: number;
  pesoFinalPct: number;
  maxParcialesPorMateria: number;
  requiereFinalPorMateria: boolean;
}

export interface EsquemaNotasPrograma {
  idProg: string;
  criterios: CriterioNota[];
  configEvaluaciones: ConfigEvaluacionesPrograma;
  notaMinimaAprobacion: number;
}

export interface MatrizNotasCriterio {
  idCohorte: string;
  idMateria: string;
  criterios: CriterioNota[];
  filas: {
    numDoc: number;
    nombreCompleto: string;
    celdas: { idCriterio: string; nota: number | null; observacion: string }[];
  }[];
  esquema: { notaMinimaAprobacion: number };
}

export interface Cohorte {
  _id: string;
  idProg: string;
  nombreProg?: string;
  numSemestre: number;
  anio: number;
  periodo: number;
  codigo: string;
  nombre: string;
  idSede?: string;
  cupoMaximo?: number | null;
  inscritos?: number;
  estado: string;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  modoConsumoHoras?: string;
  certificadoModo?: string;
  criteriosCertificado?: CriteriosCertificado;
  idEmpleadoInstructor?: number | null;
  instructorNombre?: string;
  observaciones?: string;
}

export interface CriteriosCertificado {
  minAsistenciaPct: number;
  minNotaPromedio: number;
  requiereTodasMaterias: boolean;
  requiereEvaluaciones: boolean;
}

export interface CohorteDto {
  idProg?: string;
  numSemestre?: number;
  anio?: number;
  periodo?: number;
  nombre?: string;
  idSede?: string;
  cupoMaximo?: number | null;
  estado?: string;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  modoConsumoHoras?: string;
  certificadoModo?: string;
  criteriosCertificado?: CriteriosCertificado;
  idEmpleadoInstructor?: number | null;
  observaciones?: string;
}

export interface ClaseCohorte {
  _id: string;
  idMateria: string;
  materiaNombre?: string;
  fechaClase: string;
  horaDesde?: string;
  horaHasta?: string;
  duracionHoras?: number | null;
  urlMeet?: string;
  sesion?: number;
  estado?: string;
  idEmpleadoInstructor?: number | null;
  instructorNombre?: string;
}

export interface CohorteDetalle extends Cohorte {
  materias: { _id: string; idMateriaCatalogo?: string | null; nombre: string; horas: number; orden: number }[];
  inscripciones: {
    _id: string;
    numDoc: number;
    nombreCompleto: string;
    estado: string;
    fechaInscripcion: string;
  }[];
  clases: ClaseCohorte[];
}

export interface AsistenciaAlumno {
  numDoc: number;
  nombreCompleto: string;
  estado: string;
  origen?: string;
  nota?: number | null;
}

export interface AsistenciaClase {
  idClase: string;
  materiaNombre: string;
  fechaClase: string;
  alumnos: AsistenciaAlumno[];
}

/* ---------- Fase 2 ---------- */

export interface OpcionPregunta {
  texto: string;
  correcta?: boolean;
}

export interface PreguntaBanco {
  _id?: string;
  idMateriaCatalogo?: string | null;
  enunciado: string;
  tipo: 'UNICA' | 'MULTIPLE' | 'VF';
  opciones: OpcionPregunta[];
  explicacion?: string;
  dificultad?: number;
  activo?: boolean;
}

export interface PreguntaEval {
  _id?: string;
  idBanco?: string | null;
  enunciado: string;
  tipo: 'UNICA' | 'MULTIPLE' | 'VF';
  opciones: OpcionPregunta[];
  puntos?: number;
}

export interface EvaluacionResumen {
  _id: string;
  idCohorte: string;
  idMateria: string | null;
  materiaNombre: string;
  titulo: string;
  estado: 'BORRADOR' | 'PUBLICADA' | 'CERRADA';
  modoPreguntas: 'MANUAL' | 'BANCO_ALEATORIO';
  tipoEvaluacion?: 'PARCIAL' | 'FINAL' | 'GENERAL';
  numPreguntas: number;
  numPreguntasBanco: number;
  pesoNota: number;
  notaAprobacion: number;
  fechaApertura?: string | null;
  fechaCierre?: string | null;
}

export interface Evaluacion extends EvaluacionResumen {
  descripcion?: string;
  preguntas: PreguntaEval[];
  duracionMin?: number;
  intentosPermitidos?: number;
  mostrarResultados?: boolean;
}

export interface EvaluacionDto {
  idMateria?: string | null;
  titulo?: string;
  descripcion?: string;
  modoPreguntas?: 'MANUAL' | 'BANCO_ALEATORIO';
  tipoEvaluacion?: 'PARCIAL' | 'FINAL' | 'GENERAL';
  numPreguntasBanco?: number;
  preguntas?: PreguntaEval[];
  pesoNota?: number;
  notaAprobacion?: number;
  duracionMin?: number;
  intentosPermitidos?: number;
  fechaApertura?: string | null;
  fechaCierre?: string | null;
  mostrarResultados?: boolean;
}

export interface ResultadoEvaluacion {
  idEvaluacion: string;
  titulo: string;
  notaAprobacion: number;
  totalInscritos: number;
  presentados: number;
  aprobados: number;
  promedio: number | null;
  filas: {
    numDoc: number;
    nombreCompleto: string;
    estado: string;
    nota: number | null;
    aprobado: boolean;
    intentos: number;
    fechaEnvio: string | null;
  }[];
}

export interface MaterialCohorte {
  _id?: string;
  idProg?: string;
  numSemestre?: number;
  idMateria: string;
  materiaNombre?: string;
  idCohorte?: string | null;
  titulo: string;
  tipo: 'ENLACE' | 'VIDEO' | 'DOCUMENTO' | 'ARCHIVO';
  url: string;
  descripcion?: string;
  orden?: number;
  activo?: boolean;
}

export interface ElegibilidadCertificado {
  idCohorte: string;
  cohorteNombre: string;
  nombreProg: string;
  criterios: CriteriosCertificado;
  certificadoModo: string;
  totalInscritos: number;
  aptos: number;
  filas: {
    numDoc: number;
    nombreCompleto: string;
    estadoInscripcion: string;
    asistenciaPct: number;
    notaPromedio: number | null;
    materias: string;
    evaluacionesPendientes: number;
    apto: boolean;
    motivos: string[];
  }[];
}

export interface ActaNotas {
  idCohorte: string;
  cohorteNombre: string;
  nombreProg: string;
  materias: { idMateria: string; nombre: string; horas: number }[];
  filas: {
    numDoc: number;
    nombreCompleto: string;
    celdas: { idMateria: string; nota: number | null; aprobada: boolean }[];
    promedio: number | null;
    aprobadas: number;
  }[];
}

export interface ReporteAsistencia {
  idCohorte: string;
  cohorteNombre: string;
  clases: { idClase: string; fechaClase: string; materiaNombre: string; estado: string }[];
  filas: {
    numDoc: number;
    nombreCompleto: string;
    celdas: { idClase: string; estado: string }[];
    pct: number;
  }[];
}

@Injectable({ providedIn: 'root' })
export class CohorteService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/cohortes-academicas`;

  programas(): Observable<ProgramaCohorte[]> {
    return this.http.get<ProgramaCohorte[]>(`${this.base}/programas`);
  }

  instructores(): Observable<InstructorCohorte[]> {
    return this.http.get<InstructorCohorte[]>(`${this.base}/instructores`);
  }

  /* ---------- Catálogo (banco) de materias ---------- */

  listarCatalogoMaterias(q?: string): Observable<CatalogoMateria[]> {
    let params = new HttpParams();
    if (q) params = params.set('q', q);
    return this.http.get<CatalogoMateria[]>(`${this.base}/catalogo-materias`, { params });
  }

  crearMateriaCatalogo(dto: { nombre: string; area?: string; descripcion?: string }): Observable<CatalogoMateria> {
    return this.http.post<CatalogoMateria>(`${this.base}/catalogo-materias`, dto);
  }

  actualizarMateriaCatalogo(id: string, dto: Partial<CatalogoMateria>): Observable<CatalogoMateria> {
    return this.http.put<CatalogoMateria>(`${this.base}/catalogo-materias/${id}`, dto);
  }

  eliminarMateriaCatalogo(id: string): Observable<{ ok: boolean; desactivada?: boolean }> {
    return this.http.delete<{ ok: boolean; desactivada?: boolean }>(`${this.base}/catalogo-materias/${id}`);
  }

  obtenerPlan(idProg: string): Observable<PlanPrograma> {
    return this.http.get<PlanPrograma>(`${this.base}/programas/${idProg}/plan`);
  }

  guardarPlan(idProg: string, semestres: SemestrePlan[]): Observable<PlanPrograma> {
    return this.http.put<PlanPrograma>(`${this.base}/programas/${idProg}/plan`, { semestres });
  }

  obtenerEsquemaNotas(idProg: string): Observable<EsquemaNotasPrograma> {
    return this.http.get<EsquemaNotasPrograma>(`${this.base}/programas/${idProg}/esquema-notas`);
  }

  guardarEsquemaNotas(idProg: string, dto: EsquemaNotasPrograma): Observable<EsquemaNotasPrograma> {
    return this.http.put<EsquemaNotasPrograma>(`${this.base}/programas/${idProg}/esquema-notas`, dto);
  }

  matrizNotasCriterio(idCohorte: string, idMateria: string): Observable<MatrizNotasCriterio> {
    const params = new HttpParams().set('idMateria', idMateria);
    return this.http.get<MatrizNotasCriterio>(`${this.base}/cohortes/${idCohorte}/notas-criterio`, { params });
  }

  guardarNotasCriterio(
    idCohorte: string,
    dto: { idMateria: string; notas: { numDoc: number; idCriterio: string; nota: number | null; observacion?: string }[] },
  ): Observable<{ guardadas: number }> {
    return this.http.post<{ guardadas: number }>(`${this.base}/cohortes/${idCohorte}/notas-criterio`, dto);
  }

  listarCohortes(filtros?: { idProg?: string; estado?: string; anio?: number }): Observable<Cohorte[]> {
    let params = new HttpParams();
    if (filtros?.idProg) params = params.set('idProg', filtros.idProg);
    if (filtros?.estado) params = params.set('estado', filtros.estado);
    if (filtros?.anio) params = params.set('anio', String(filtros.anio));
    return this.http.get<Cohorte[]>(`${this.base}/cohortes`, { params });
  }

  crearCohorte(dto: CohorteDto): Observable<Cohorte> {
    return this.http.post<Cohorte>(`${this.base}/cohortes`, dto);
  }

  actualizarCohorte(id: string, dto: CohorteDto): Observable<Cohorte> {
    return this.http.put<Cohorte>(`${this.base}/cohortes/${id}`, dto);
  }

  detalle(id: string): Observable<CohorteDetalle> {
    return this.http.get<CohorteDetalle>(`${this.base}/cohortes/${id}`);
  }

  inscribir(id: string, numDoc: string | number): Observable<{ nombreCompleto: string }> {
    return this.http.post<{ nombreCompleto: string }>(`${this.base}/cohortes/${id}/inscribir`, { numDoc });
  }

  crearClase(id: string, dto: Partial<ClaseCohorte> & { idMateria: string; fechaClase: string }): Observable<ClaseCohorte> {
    return this.http.post<ClaseCohorte>(`${this.base}/cohortes/${id}/clases`, dto);
  }

  planificar(
    id: string,
    cfg: { fechaInicio?: string; dias?: number[]; horaDesde?: string; horaHasta?: string; horasPorSesion?: number },
  ): Observable<{ clasesGeneradas: number }> {
    return this.http.post<{ clasesGeneradas: number }>(`${this.base}/cohortes/${id}/planificar`, cfg);
  }

  actualizarClase(idClase: string, dto: Partial<ClaseCohorte>): Observable<ClaseCohorte> {
    return this.http.put<ClaseCohorte>(`${this.base}/clases/${idClase}`, dto);
  }

  asistencia(idClase: string): Observable<AsistenciaClase> {
    return this.http.get<AsistenciaClase>(`${this.base}/clases/${idClase}/asistencia`);
  }

  registrarAsistencia(
    idClase: string,
    asistencias: { numDoc: number; estado: string; nota?: number | null }[],
  ): Observable<{ registradas: number }> {
    return this.http.post<{ registradas: number }>(`${this.base}/clases/${idClase}/asistencia`, { asistencias });
  }

  /* ---------- Banco de preguntas ---------- */

  listarBanco(filtros: { idMateriaCatalogo?: string }): Observable<PreguntaBanco[]> {
    let params = new HttpParams();
    if (filtros.idMateriaCatalogo) params = params.set('idMateriaCatalogo', filtros.idMateriaCatalogo);
    return this.http.get<PreguntaBanco[]>(`${this.base}/banco-preguntas`, { params });
  }

  crearPregunta(dto: PreguntaBanco): Observable<PreguntaBanco> {
    return this.http.post<PreguntaBanco>(`${this.base}/banco-preguntas`, dto);
  }

  actualizarPregunta(id: string, dto: Partial<PreguntaBanco>): Observable<PreguntaBanco> {
    return this.http.put<PreguntaBanco>(`${this.base}/banco-preguntas/${id}`, dto);
  }

  eliminarPregunta(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/banco-preguntas/${id}`);
  }

  /* ---------- Evaluaciones ---------- */

  listarEvaluaciones(idCohorte: string): Observable<EvaluacionResumen[]> {
    return this.http.get<EvaluacionResumen[]>(`${this.base}/cohortes/${idCohorte}/evaluaciones`);
  }

  crearEvaluacion(idCohorte: string, dto: EvaluacionDto): Observable<Evaluacion> {
    return this.http.post<Evaluacion>(`${this.base}/cohortes/${idCohorte}/evaluaciones`, dto);
  }

  obtenerEvaluacion(idEval: string): Observable<Evaluacion> {
    return this.http.get<Evaluacion>(`${this.base}/evaluaciones/${idEval}`);
  }

  actualizarEvaluacion(idEval: string, dto: EvaluacionDto): Observable<Evaluacion> {
    return this.http.put<Evaluacion>(`${this.base}/evaluaciones/${idEval}`, dto);
  }

  publicarEvaluacion(idEval: string): Observable<Evaluacion> {
    return this.http.post<Evaluacion>(`${this.base}/evaluaciones/${idEval}/publicar`, {});
  }

  cerrarEvaluacion(idEval: string): Observable<Evaluacion> {
    return this.http.post<Evaluacion>(`${this.base}/evaluaciones/${idEval}/cerrar`, {});
  }

  eliminarEvaluacion(idEval: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/evaluaciones/${idEval}`);
  }

  resultadosEvaluacion(idEval: string): Observable<ResultadoEvaluacion> {
    return this.http.get<ResultadoEvaluacion>(`${this.base}/evaluaciones/${idEval}/resultados`);
  }

  /* ---------- Materiales ---------- */

  listarMateriales(filtros: { idProg?: string; numSemestre?: number; idMateria?: string }): Observable<MaterialCohorte[]> {
    let params = new HttpParams();
    if (filtros.idProg) params = params.set('idProg', filtros.idProg);
    if (filtros.numSemestre) params = params.set('numSemestre', String(filtros.numSemestre));
    if (filtros.idMateria) params = params.set('idMateria', filtros.idMateria);
    return this.http.get<MaterialCohorte[]>(`${this.base}/materiales`, { params });
  }

  crearMaterial(dto: MaterialCohorte): Observable<MaterialCohorte> {
    return this.http.post<MaterialCohorte>(`${this.base}/materiales`, dto);
  }

  actualizarMaterial(id: string, dto: Partial<MaterialCohorte>): Observable<MaterialCohorte> {
    return this.http.put<MaterialCohorte>(`${this.base}/materiales/${id}`, dto);
  }

  eliminarMaterial(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/materiales/${id}`);
  }

  /* ---------- Reportes / actas / certificado ---------- */

  elegibilidadCertificado(idCohorte: string): Observable<ElegibilidadCertificado> {
    return this.http.get<ElegibilidadCertificado>(`${this.base}/cohortes/${idCohorte}/certificado-elegibilidad`);
  }

  finalizarAptos(idCohorte: string): Observable<{ finalizados: number; aptos: number[]; totalInscritos: number }> {
    return this.http.post<{ finalizados: number; aptos: number[]; totalInscritos: number }>(
      `${this.base}/cohortes/${idCohorte}/certificado-finalizar`,
      {},
    );
  }

  actaNotas(idCohorte: string): Observable<ActaNotas> {
    return this.http.get<ActaNotas>(`${this.base}/cohortes/${idCohorte}/acta-notas`);
  }

  reporteAsistencia(idCohorte: string): Observable<ReporteAsistencia> {
    return this.http.get<ReporteAsistencia>(`${this.base}/cohortes/${idCohorte}/reporte-asistencia`);
  }
}
