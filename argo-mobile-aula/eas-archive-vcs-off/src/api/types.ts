/** Tipos del portal aula virtual — espejo de argo-aula-virtual/src/app/core/models.ts */

export interface PortalSession {
  email: string;
  numDoc: number;
  nombreCompleto: string;
  empresaId?: string | null;
  empresaNombre?: string | null;
}

export interface PortalAuthRes {
  token: string;
  usuario: { email: string; numDoc: number };
  alumno: { numDoc: number; nombreCompleto: string; empresaId?: string | null; empresaNombre?: string | null };
}

export interface PortalTemaConfig {
  colorPrimario: string;
  colorPrimarioOscuro: string;
  colorAcento: string;
  colorFondo: string;
  colorSuperficie: string;
  colorTexto: string;
  colorTextoSecundario: string;
  fuente?: string;
  urlHero?: string;
  urlHeroAbsoluta?: string;
}

export interface PasarelaPublicaConfig {
  activo: boolean;
  ambiente?: string;
  publicKey?: string | null;
}

export interface PagoEnLineaRes {
  checkoutUrl: string;
  montoCop: number;
  reference: string;
}

export interface PortalConfig {
  nombreCea: string;
  nit?: string;
  direccion?: string;
  ciudad?: string;
  telefono?: string;
  telefonoWhatsapp?: string;
  email?: string;
  urlLogo?: string;
  urlLogoAbsoluta?: string | null;
  heroTitulo: string;
  heroSubtitulo: string;
  registroAbierto?: boolean;
  emailVerificacionRegistro?: boolean;
  turnstileSiteKey?: string;
  formularioContactoActivo?: boolean;
  formularioPqrActivo?: boolean;
  site?: {
    paginas?: Record<string, { activa: boolean; etiquetaMenu: string; ruta: string }>;
    tema?: PortalTemaConfig;
  };
}

export interface CategoriaVirtual {
  idCategoria: number;
  nombre: string;
}

export interface ClaseProgresoVirtual {
  numero: number;
  pct: number;
  aprobada: boolean;
}

export interface ProgresoVirtual {
  pctCompletitud: number;
  promedioClases?: number | null;
  clases?: ClaseProgresoVirtual[];
  clasesAprobadas?: number;
  totalClases?: number;
  mejorNotaEval: number | null;
  intentosEval: number;
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
  nivel?: string | null;
  tienePaquete?: boolean;
  puedeCursar?: boolean;
  accesoBloqueadoPago?: boolean;
  requierePagoParaCursar?: boolean;
  playerUrl?: string | null;
  storagePrefix?: string | null;
  progreso?: ProgresoVirtual;
  reglas?: ReglasVirtual;
  pago?: EstadoPagoVirtual;
}

export interface EstadoPagoVirtual {
  tieneLiquidacion: boolean;
  pagado: boolean;
  saldo: number | null;
  valor: number | null;
  estado: string;
  idLiquidacion?: string;
  recibo?: { idIngreso: string; numRecibo: string | null } | null;
}

export interface EstadoInscripcionVirtual {
  matriculado: boolean;
  puedeCursar: boolean;
  accesoBloqueadoPago?: boolean;
  puedeCertificarse: boolean;
  certificadoPendientePago: boolean;
  pago: EstadoPagoVirtual | null;
  curso: {
    idPrograma: string | number;
    nombreProg: string;
    tarifaVirtual: number;
    requierePagoParaCursar?: boolean;
    tienePaquete?: boolean;
  };
}

export interface MatriculaVirtualRes {
  yaMatriculado: boolean;
  message: string;
  pago?: EstadoPagoVirtual;
}

export interface ProgresoVirtualResp {
  progreso: ProgresoVirtual;
  reglas: ReglasVirtual;
  pago?: EstadoPagoVirtual | null;
  certificado?: { emitido: boolean; codigoCert?: string } | null;
  aviso?: string;
  avisoCertificado?: string;
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
  recibo?: { idIngreso: string; numRecibo: string | null } | null;
}

export interface CertificadoConsultaRes {
  cedula: number;
  nombreApellidos: string;
  total: number;
  items: {
    idCertificado: string;
    nombreApellidos: string;
    encabezado: string;
    horas: string;
    fechaCert: string | null;
    fechaVence: string | null;
  }[];
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
  totalClases: number;
  clasesPresente: number;
  pctAvance: number;
  materias: { idMateria: string; nombre: string; horas: number; pct: number }[];
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
  miMejorNota: number | null;
  aprobado: boolean;
  puedeIniciar: boolean;
  tieneIntentoEnCurso: boolean;
  idIntentoEnCurso: string | null;
}

export interface PreguntaEvalAlumno {
  idPregunta: string;
  enunciado: string;
  tipo: 'UNICA' | 'MULTIPLE' | 'VF';
  puntos: number;
  opciones: { texto: string }[];
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

export interface ResultadoIntentoCohorte {
  idIntento: string;
  nota: number;
  aprobado: boolean;
  puntajeObtenido: number;
  puntajeTotal: number;
  mostrarResultados: boolean;
  correccion: {
    idPregunta: string;
    enunciado: string;
    opciones: { texto: string; correcta: boolean; elegida: boolean }[];
    correcta: boolean;
  }[];
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

export interface MensajeForo {
  _id: string;
  idPrograma: string;
  autorNombre: string;
  autorTipo: 'alumno' | 'instructor' | 'admin';
  autorNumDoc?: number | null;
  texto: string;
  createdAt: string;
}

export interface RegistroVerificacionRes {
  step: 'verify_email';
  pendingId: string;
  email: string | null;
  expiresInMinutes: number;
  message: string;
}

export type PanelAula =
  | 'tablero'
  | 'cursos'
  | 'presenciales'
  | 'puntajes'
  | 'certificados'
  | 'foro'
  | 'perfil';
