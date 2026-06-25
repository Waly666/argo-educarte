/** Constantes del módulo de cohortes académicas (formación grupal por semestre). */

const ESTADOS_COHORTE = ['ABIERTA', 'EN_CURSO', 'CERRADA', 'CANCELADA'];
const ESTADO_COHORTE_DEFAULT = 'ABIERTA';
/** Estados en los que aún se puede inscribir alumnos. */
const ESTADOS_COHORTE_INSCRIBIBLE = ['ABIERTA', 'EN_CURSO'];

const ESTADOS_CLASE_COHORTE = ['PROGRAMADA', 'REALIZADA', 'CANCELADA'];
const ESTADO_CLASE_COHORTE_DEFAULT = 'PROGRAMADA';

const ESTADOS_ASISTENCIA = ['PRESENTE', 'AUSENTE', 'JUSTIFICADO'];
const ESTADO_ASISTENCIA_DEFAULT = 'AUSENTE';

const ORIGENES_ASISTENCIA = ['MANUAL', 'MEET'];

/** Cuándo se descuentan las horas de la materia al alumno. */
const MODOS_CONSUMO_HORAS = ['AL_ASISTIR', 'AL_DICTAR'];
const MODO_CONSUMO_HORAS_DEFAULT = 'AL_ASISTIR';

/** Cómo se emite el certificado al cerrar la cohorte. */
const MODOS_CERTIFICADO_COHORTE = ['MANUAL', 'AUTO_CRITERIOS'];
const MODO_CERTIFICADO_COHORTE_DEFAULT = 'MANUAL';

const ESTADOS_INSCRIPCION = ['ACTIVA', 'RETIRADA', 'FINALIZADA'];
const ESTADO_INSCRIPCION_DEFAULT = 'ACTIVA';

/** Nota mínima (0-100) para considerar una materia aprobada por defecto. */
const NOTA_MINIMA_APROBACION_DEFAULT = 60;

/* ---------------- Fase 2: evaluaciones, materiales, certificado ---------------- */

/** Tipos de pregunta del banco. */
const TIPOS_PREGUNTA = ['UNICA', 'MULTIPLE', 'VF'];
const TIPO_PREGUNTA_DEFAULT = 'UNICA';

/** Cómo se arma una evaluación a partir del banco. */
const MODOS_PREGUNTAS_EVALUACION = ['MANUAL', 'BANCO_ALEATORIO'];
const MODO_PREGUNTAS_EVALUACION_DEFAULT = 'MANUAL';

/** Estado de una evaluación. */
const ESTADOS_EVALUACION = ['BORRADOR', 'PUBLICADA', 'CERRADA'];
const ESTADO_EVALUACION_DEFAULT = 'BORRADOR';

/** Estado de un intento de evaluación. */
const ESTADOS_INTENTO = ['EN_CURSO', 'ENVIADO', 'CALIFICADO'];
const ESTADO_INTENTO_DEFAULT = 'EN_CURSO';

/** Tipos de material de apoyo por materia. */
const TIPOS_MATERIAL = ['ENLACE', 'VIDEO', 'DOCUMENTO', 'ARCHIVO'];
const TIPO_MATERIAL_DEFAULT = 'ENLACE';

/** Criterios por defecto para emitir certificado automático. */
const CRITERIOS_CERTIFICADO_DEFAULT = {
  minAsistenciaPct: 80,
  minNotaPromedio: 60,
  requiereTodasMaterias: true,
  requiereEvaluaciones: false,
};

/** Tipos de criterio en el esquema de notas del programa. */
const TIPOS_CRITERIO_NOTA = ['MANUAL', 'EVALUACIONES', 'ASISTENCIA'];
const TIPO_CRITERIO_NOTA_DEFAULT = 'MANUAL';

/** Parcial vs final dentro del criterio de evaluaciones. */
const TIPOS_EVALUACION_COHORTE = ['PARCIAL', 'FINAL', 'GENERAL'];
const TIPO_EVALUACION_COHORTE_DEFAULT = 'PARCIAL';

/** Esquema de notas por defecto (Participación 20%, Talleres 30%, Eval teórica 40%, Actitud 10%). */
const CRITERIOS_NOTA_DEFAULT = [
  { nombre: 'Participación', pesoPct: 20, tipo: 'MANUAL', orden: 1 },
  { nombre: 'Talleres', pesoPct: 30, tipo: 'MANUAL', orden: 2 },
  { nombre: 'Evaluación teórica', pesoPct: 40, tipo: 'EVALUACIONES', orden: 3 },
  { nombre: 'Actitud y compromiso', pesoPct: 10, tipo: 'MANUAL', orden: 4 },
];

const CONFIG_EVALUACIONES_DEFAULT = {
  /** Peso de parciales dentro del criterio EVALUACIONES (resto = final). */
  pesoParcialesPct: 40,
  pesoFinalPct: 60,
  /** Plantilla: cuántas evaluaciones se esperan por materia (orientativo). */
  maxParcialesPorMateria: 3,
  requiereFinalPorMateria: true,
};

const ESQUEMA_NOTAS_DEFAULT = {
  criterios: CRITERIOS_NOTA_DEFAULT,
  configEvaluaciones: CONFIG_EVALUACIONES_DEFAULT,
  notaMinimaAprobacion: NOTA_MINIMA_APROBACION_DEFAULT,
};

module.exports = {
  ESTADOS_COHORTE,
  ESTADO_COHORTE_DEFAULT,
  ESTADOS_COHORTE_INSCRIBIBLE,
  ESTADOS_CLASE_COHORTE,
  ESTADO_CLASE_COHORTE_DEFAULT,
  ESTADOS_ASISTENCIA,
  ESTADO_ASISTENCIA_DEFAULT,
  ORIGENES_ASISTENCIA,
  MODOS_CONSUMO_HORAS,
  MODO_CONSUMO_HORAS_DEFAULT,
  MODOS_CERTIFICADO_COHORTE,
  MODO_CERTIFICADO_COHORTE_DEFAULT,
  ESTADOS_INSCRIPCION,
  ESTADO_INSCRIPCION_DEFAULT,
  NOTA_MINIMA_APROBACION_DEFAULT,
  TIPOS_PREGUNTA,
  TIPO_PREGUNTA_DEFAULT,
  MODOS_PREGUNTAS_EVALUACION,
  MODO_PREGUNTAS_EVALUACION_DEFAULT,
  ESTADOS_EVALUACION,
  ESTADO_EVALUACION_DEFAULT,
  ESTADOS_INTENTO,
  ESTADO_INTENTO_DEFAULT,
  TIPOS_MATERIAL,
  TIPO_MATERIAL_DEFAULT,
  CRITERIOS_CERTIFICADO_DEFAULT,
  TIPOS_CRITERIO_NOTA,
  TIPO_CRITERIO_NOTA_DEFAULT,
  TIPOS_EVALUACION_COHORTE,
  TIPO_EVALUACION_COHORTE_DEFAULT,
  CRITERIOS_NOTA_DEFAULT,
  CONFIG_EVALUACIONES_DEFAULT,
  ESQUEMA_NOTAS_DEFAULT,
};
