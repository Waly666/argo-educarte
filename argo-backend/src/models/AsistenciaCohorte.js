const mongoose = require('mongoose');
const {
  ESTADOS_ASISTENCIA,
  ESTADO_ASISTENCIA_DEFAULT,
  ORIGENES_ASISTENCIA,
} = require('../constants/cohortesAcademicas');

/** Asistencia de un alumno a una clase de cohorte; consume horas de la materia. */
const AsistenciaCohorteSchema = new mongoose.Schema(
  {
    idClase: { type: mongoose.Schema.Types.ObjectId, ref: 'ClaseCohorte', required: true, index: true },
    idCohorte: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohorte', required: true, index: true },
    idMateria: { type: mongoose.Schema.Types.ObjectId, ref: 'MateriaCohorte', default: null, index: true },
    numDoc: { type: Number, required: true, index: true },
    estado: { type: String, enum: ESTADOS_ASISTENCIA, default: ESTADO_ASISTENCIA_DEFAULT },
    origen: { type: String, enum: ORIGENES_ASISTENCIA, default: 'MANUAL' },
    horasConsumidas: { type: Number, default: 0 },
    /** Nota opcional por sesión (0-100), usada en criterio ASISTENCIA si aplica. */
    nota: { type: Number, default: null, min: 0, max: 100 },
    fechaRegistro: { type: Date, default: Date.now },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'asistenciasCohorte', timestamps: true },
);

AsistenciaCohorteSchema.index({ idClase: 1, numDoc: 1 }, { unique: true });

module.exports = mongoose.model('AsistenciaCohorte', AsistenciaCohorteSchema);
