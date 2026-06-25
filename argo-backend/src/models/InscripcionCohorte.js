const mongoose = require('mongoose');
const {
  ESTADOS_INSCRIPCION,
  ESTADO_INSCRIPCION_DEFAULT,
} = require('../constants/cohortesAcademicas');

/** Inscripción de un alumno a una cohorte (un semestre del programa). */
const InscripcionCohorteSchema = new mongoose.Schema(
  {
    numDoc: { type: Number, required: true, index: true },
    idCohorte: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohorte', required: true, index: true },
    idProg: { type: String, required: true, trim: true, index: true },
    numSemestre: { type: Number, required: true, min: 1 },
    idMatricula: { type: mongoose.Schema.Types.ObjectId, ref: 'Matricula', default: null },
    estado: { type: String, enum: ESTADOS_INSCRIPCION, default: ESTADO_INSCRIPCION_DEFAULT, index: true },
    fechaInscripcion: { type: Date, default: Date.now },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'inscripcionesCohorte', timestamps: true },
);

InscripcionCohorteSchema.index({ numDoc: 1, idCohorte: 1 }, { unique: true });

module.exports = mongoose.model('InscripcionCohorte', InscripcionCohorteSchema);
