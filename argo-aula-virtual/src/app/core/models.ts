import type { PortalLandingConfig } from './portal-landing';

export interface MateriaAvanceAlumno {
  idMateria: string;
  nombre: string;
  horas: number;
  horasCubiertas: number;
  pct: number;
}

export interface CohorteAlumno {
  idCohorte: string;
  idProg: string;
  nombreProg: string;
  cohorteNombre: string;
  codigo: string;
  numSemestre: number;
  anio: number;
  periodo: number;
  estado: string;
  estadoInscripcion: string;
  totalClases: number;
  clasesPresente: number;
  horasTotal: number;
  horasCubiertas: number;
  pctAvance: number;
  materias: MateriaAvanceAlumno[];
}

export interface ClaseCohorteAlumno {
  idClase: string;
  materiaNombre: string;
  fechaClase: string;
  horaDesde?: string;
  horaHasta?: string;
  urlMeet?: string;
  estado: string;
  miAsistencia: string;
}

export interface CalendarioCohorte {
  idCohorte: string;
  cohorteNombre: string;
  clases: ClaseCohorteAlumno[];
}

export interface EvaluacionCohorteAlumno {
  idEvaluacion: string;
  titulo: string;
  descripcion?: string;
  materiaNombre: string;
  numPreguntas: number;
  notaAprobacion: number;
  duracionMin: number;
  intentosPermitidos: number;
  intentosUsados: number;
  vigente: boolean;
  estado: string;
  fechaApertura?: string | null;
  fechaCierre?: string | null;
  miMejorNota: number | null;
  aprobado: boolean;
  tieneIntentoEnCurso: boolean;
  idIntentoEnCurso: string | null;
  puedeIniciar: boolean;
}

export interface OpcionEvalAlumno {
  texto: string;
}

export interface PreguntaEvalAlumno {
  idPregunta: string;
  enunciado: string;
  tipo: 'UNICA' | 'MULTIPLE' | 'VF';
  puntos: number;
  opciones: OpcionEvalAlumno[];
}

export interface IntentoEvalCohorte {
  idIntento: string;
  idEvaluacion: string;
  titulo: string;
  descripcion?: string;
  duracionMin: number;
  numeroIntento: number;
  fechaInicio: string;
  preguntas: PreguntaEvalAlumno[];
}

export interface CorreccionPregunta {
  idPregunta: string;
  enunciado: string;
  opciones: { texto: string; correcta: boolean; elegida: boolean }[];
  correcta: boolean;
}

export interface ResultadoIntentoCohorte {
  idIntento: string;
  nota: number;
  aprobado: boolean;
  puntajeObtenido: number;
  puntajeTotal: number;
  mostrarResultados: boolean;
  correccion: CorreccionPregunta[];
}

export interface MaterialCohorteAlumno {
  _id: string;
  idMateria: string;
  materiaNombre: string;
  titulo: string;
  tipo: string;
  url: string;
  descripcion?: string;
}

export interface PortalPaginaConfig {
  activa: boolean;
  etiquetaMenu: string;
  ruta: string;
}

export interface PortalTemaConfig {
  colorPrimario: string;
  colorPrimarioOscuro: string;
  colorAcento: string;
  colorFondo: string;
  colorSuperficie: string;
  colorTexto: string;
  colorTextoSecundario: string;
  fuente: string;
  urlHero?: string;
  urlHeroAbsoluta?: string;
}

export interface PortalSiteConfig {
  paginas: Record<string, PortalPaginaConfig>;
  tema: PortalTemaConfig;
  marca?: {
    textoCopyright?: string;
    ocultarMarcaDesarrollador?: boolean;
    textoPieDesarrollador?: string;
  };
  home: {
    orden: string[];
    secciones: Record<string, boolean>;
  };
  homeSeccionesLabels?: Record<string, string>;
}

export interface PortalConfig {
  nombreCea: string;
  nit?: string;
  direccion?: string;
  ciudad?: string;
  telefono?: string;
  email?: string;
  urlLogo?: string;
  urlLogoAbsoluta?: string | null;
  heroTitulo: string;
  heroSubtitulo: string;
  acercaDeHtml?: string;
  landing?: PortalLandingConfig;
  registroAbierto?: boolean;
  emailVerificacionRegistro?: boolean;
  turnstileSiteKey?: string;
  formularioContactoActivo?: boolean;
  formularioPqrActivo?: boolean;
  site?: PortalSiteConfig;
}

export type NivelVirtual = 'PRINCIPIANTE' | 'INTERMEDIO' | 'AVANZADO';

export interface CategoriaVirtual {
  idCategoria: number;
  nombre: string;
  orden?: number;
  activo?: boolean;
}

export interface ClaseProgresoVirtual {
  numero: number;
  pct: number;
  aprobada: boolean;
}

export interface IntentoEvalVirtual {
  numero?: number;
  nota: number;
  pctCompletitud?: number;
  aprobado: boolean;
  fecha?: string | null;
}

export interface ProgresoVirtual {
  pctCompletitud: number;
  promedioClases?: number | null;
  clases?: ClaseProgresoVirtual[];
  clasesAprobadas?: number;
  totalClases?: number;
  mejorNotaEval: number | null;
  ultimaNotaEval?: number | null;
  intentosEval: number;
  intentos?: IntentoEvalVirtual[];
  aprobado: boolean;
  certificadoEmitido: boolean;
}

export interface ReglasVirtual {
  modoCertificado: string;
  pctMinCompletitud: number;
  pctMinEvaluaciones: number;
  intentosMaxEval: number;
  intentosRestantes: number;
  cumpleCompletitud?: boolean;
  cumpleNota?: boolean;
  puedeReintentar?: boolean;
}

export interface CursoVirtual {
  idPrograma: string | number;
  codigoProg?: string | null;
  nombreProg: string;
  nomCert?: string | null;
  descripcion?: string | null;
  descripcionVirtual?: string | null;
  horas?: number | null;
  tarifaVirtual: number;
  urlPortadaVirtual?: string | null;
  urlPortadaAbsoluta?: string | null;
  idCategorias?: number[];
  categoriaNombres?: string[];
  categoriaNombre?: string | null;
  nivel?: NivelVirtual | null;
  autor?: string | null;
  publicadoPortal?: boolean;
  modoCertificado?: string;
  requierePagoParaCursar?: boolean;
  tienePaquete?: boolean;
  puedeCursar?: boolean;
  accesoBloqueadoPago?: boolean;
  playerUrl?: string | null;
  storagePrefix?: string | null;
  materiales?: MaterialVirtual[];
  sesionesMeet?: SesionMeet[];
  pctMinCompletitud?: number;
  pctMinEvaluaciones?: number;
  intentosMaxEval?: number;
  progreso?: ProgresoVirtual;
  reglas?: ReglasVirtual;
  matricula?: { fechaMat?: string; pagada?: string; tarifa?: number } | null;
  pago?: EstadoPagoVirtual;
}

export interface ReciboPortal {
  idIngreso: string;
  numRecibo: string | null;
  fecha?: string | null;
  valor?: number | null;
}

export interface EstadoPagoVirtual {
  tieneLiquidacion: boolean;
  pagado: boolean;
  saldo: number | null;
  valor: number | null;
  abonado?: number;
  estado: string;
  idLiquidacion?: string;
  recibo?: ReciboPortal | null;
}

export interface EstadoInscripcionVirtual {
  matriculado: boolean;
  matricula: { fechaMat?: string; pagada?: string; tarifa?: number } | null;
  pago: EstadoPagoVirtual | null;
  puedeCursar: boolean;
  accesoBloqueadoPago?: boolean;
  puedeCertificarse: boolean;
  certificadoPendientePago: boolean;
  curso: {
    idPrograma: string | number;
    nombreProg: string;
    tarifaVirtual: number;
    modoCertificado?: string;
    requierePagoParaCursar?: boolean;
    tienePaquete?: boolean;
  };
}

export interface MatriculaVirtualRes {
  yaMatriculado: boolean;
  message: string;
  matricula?: unknown;
  pago?: EstadoPagoVirtual;
}

export interface ProgresoVirtualResp {
  progreso: ProgresoVirtual;
  reglas: ReglasVirtual;
  pago?: EstadoPagoVirtual | null;
  certificado?: { emitido: boolean; codigoCert?: string; motivo?: string } | null;
  aviso?: string;
  avisoCertificado?: string;
}

export interface MaterialVirtual {
  _id?: string;
  titulo: string;
  tipo: string;
  url: string;
  orden?: number;
}

export interface SesionMeet {
  _id?: string;
  titulo: string;
  url: string;
  fecha?: string | null;
  obligatoria?: boolean;
}

export interface PortalAuthUser {
  email: string;
  numDoc: number;
}

export interface PortalAuthRes {
  token: string;
  usuario: PortalAuthUser;
  alumno: { numDoc: number; nombreCompleto: string };
}

export interface RegistroVerificacionRes {
  step: 'verify_email';
  pendingId: string;
  email: string | null;
  expiresInMinutes: number;
  message: string;
}

export interface CertificadoConsultaItem {
  idCertificado: string;
  codVerificacion?: string;
  nombreApellidos: string;
  cedula: number;
  encabezado: string;
  horas: string;
  fechaCert: string | null;
  fechaVence: string | null;
}

export interface CertificadoConsultaRes {
  cedula: number;
  nombreApellidos: string;
  total: number;
  items: CertificadoConsultaItem[];
}

export interface CertificadoPortal {
  _id: string;
  idProg: string | number;
  codigoCert: string | null;
  encabezado: string | null;
  programaDescr: string;
  nomCert: string | null;
  fechaEmision?: string | null;
  fechaVencimiento?: string | null;
  estado: string;
  esCursoVirtual?: boolean;
  generadoAutoVirtual?: boolean;
  generadoAutoPago?: boolean;
  recibo?: ReciboPortal | null;
}

export interface BlogImagen {
  url: string;
  leyenda?: string;
}

export interface BlogPost {
  _id: string;
  titulo: string;
  slug: string;
  contenido: string;
  imagenes: BlogImagen[];
  autorNombre: string;
  publicadoAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}
