const mongoose = require('mongoose');
const { ESTADOS_INTENTO, ESTADO_INTENTO_DEFAULT } = require('../constants/cohortesAcademicas');

/** Respuesta del alumno a una pregunta (índices de opciones seleccionadas). */
const RespuestaSchema = new mongoose.Schema(
  {
    idPregunta: { type: mongoose.Schema.Types.ObjectId, required: true },
    seleccion: { type: [Number], default: [] },
    correcta: { type: Boolean, default: false },
    puntosObtenidos: { type: Number, default: 0 },
  },
  { _id: false },
);

/** Intento de un alumno sobre una evaluación. */
const IntentoEvaluacionCohorteSchema = new mongoose.Schema(
  {
    idEvaluacion: { type: mongoose.Schema.Types.ObjectId, ref: 'EvaluacionCohorte', required: true, index: true },
    idCohorte: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohorte', required: true, index: true },
    idMateria: { type: mongoose.Schema.Types.ObjectId, ref: 'MateriaCohorte', default: null },
    numDoc: { type: Number, required: true, index: true },
    numeroIntento: { type: Number, default: 1, min: 1 },
    respuestas: { type: [RespuestaSchema], default: [] },
    /** Nota normalizada 0-100. */
    nota: { type: Number, default: null },
    puntajeObtenido: { type: Number, default: 0 },
    puntajeTotal: { type: Number, default: 0 },
    aprobado: { type: Boolean, default: false },
    estado: { type: String, enum: ESTADOS_INTENTO, default: ESTADO_INTENTO_DEFAULT, index: true },
    fechaInicio: { type: Date, default: Date.now },
    fechaEnvio: { type: Date, default: null },
  },
  { collection: 'intentosEvaluacionCohorte', timestamps: true },
);

IntentoEvaluacionCohorteSchema.index({ idEvaluacion: 1, numDoc: 1, numeroIntento: 1 }, { unique: true });

module.exports = mongoose.model('IntentoEvaluacionCohorte', IntentoEvaluacionCohorteSchema);
