const mongoose = require('mongoose');
const {
  TIPOS_PREGUNTA,
  TIPO_PREGUNTA_DEFAULT,
  MODOS_PREGUNTAS_EVALUACION,
  MODO_PREGUNTAS_EVALUACION_DEFAULT,
  ESTADOS_EVALUACION,
  ESTADO_EVALUACION_DEFAULT,
  TIPOS_EVALUACION_COHORTE,
  TIPO_EVALUACION_COHORTE_DEFAULT,
} = require('../constants/cohortesAcademicas');

/** Snapshot de pregunta dentro de la evaluación (estable aunque cambie el banco). */
const PreguntaEvalSchema = new mongoose.Schema(
  {
    idBanco: { type: mongoose.Schema.Types.ObjectId, ref: 'PreguntaBancoCohorte', default: null },
    enunciado: { type: String, required: true, trim: true },
    tipo: { type: String, enum: TIPOS_PREGUNTA, default: TIPO_PREGUNTA_DEFAULT },
    opciones: {
      type: [
        new mongoose.Schema(
          { texto: { type: String, trim: true }, correcta: { type: Boolean, default: false } },
          { _id: false },
        ),
      ],
      default: [],
    },
    puntos: { type: Number, default: 1, min: 0 },
  },
  { _id: true },
);

/** Evaluación de una cohorte/materia. */
const EvaluacionCohorteSchema = new mongoose.Schema(
  {
    idCohorte: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohorte', required: true, index: true },
    idProg: { type: String, required: true, trim: true, index: true },
    numSemestre: { type: Number, required: true, min: 1 },
    idMateria: { type: mongoose.Schema.Types.ObjectId, ref: 'MateriaCohorte', default: null, index: true },
    titulo: { type: String, required: true, trim: true },
    descripcion: { type: String, trim: true, default: '' },
    modoPreguntas: {
      type: String,
      enum: MODOS_PREGUNTAS_EVALUACION,
      default: MODO_PREGUNTAS_EVALUACION_DEFAULT,
    },
    /** Si modoPreguntas = BANCO_ALEATORIO: cuántas preguntas tomar del banco. */
    numPreguntasBanco: { type: Number, default: 0, min: 0 },
    preguntas: { type: [PreguntaEvalSchema], default: [] },
    /** Peso de la evaluación dentro de su grupo (parcial o final). */
    pesoNota: { type: Number, default: 100, min: 0, max: 100 },
    /** PARCIAL | FINAL | GENERAL — para calcular el criterio EVALUACIONES. */
    tipoEvaluacion: {
      type: String,
      enum: TIPOS_EVALUACION_COHORTE,
      default: TIPO_EVALUACION_COHORTE_DEFAULT,
    },
    notaAprobacion: { type: Number, default: 60, min: 0, max: 100 },
    duracionMin: { type: Number, default: 0, min: 0 },
    intentosPermitidos: { type: Number, default: 1, min: 1 },
    fechaApertura: { type: Date, default: null },
    fechaCierre: { type: Date, default: null },
    estado: { type: String, enum: ESTADOS_EVALUACION, default: ESTADO_EVALUACION_DEFAULT, index: true },
    /** Mostrar respuestas correctas al alumno tras enviar. */
    mostrarResultados: { type: Boolean, default: true },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'evaluacionesCohorte', timestamps: true },
);

EvaluacionCohorteSchema.index({ idCohorte: 1, idMateria: 1 });

module.exports = mongoose.model('EvaluacionCohorte', EvaluacionCohorteSchema);
