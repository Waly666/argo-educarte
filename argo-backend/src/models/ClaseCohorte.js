const mongoose = require('mongoose');
const {
  ESTADOS_CLASE_COHORTE,
  ESTADO_CLASE_COHORTE_DEFAULT,
} = require('../constants/cohortesAcademicas');

/** Clase programada de una cohorte para una materia (puede haber varias sesiones por materia). */
const ClaseCohorteSchema = new mongoose.Schema(
  {
    idCohorte: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohorte', required: true, index: true },
    idMateria: { type: mongoose.Schema.Types.ObjectId, ref: 'MateriaCohorte', required: true, index: true },
    idProg: { type: String, required: true, trim: true, index: true },
    fechaClase: { type: Date, required: true, index: true },
    horaDesde: { type: String, trim: true, default: '' },
    horaHasta: { type: String, trim: true, default: '' },
    duracionHoras: { type: Number, default: null },
    /** Enlace Meet/Zoom para asistencia remota */
    urlMeet: { type: String, trim: true, default: '' },
    idEmpleadoInstructor: { type: Number, default: null },
    /** Nº de sesión de la materia (1, 2, ...) */
    sesion: { type: Number, default: 1 },
    estado: { type: String, enum: ESTADOS_CLASE_COHORTE, default: ESTADO_CLASE_COHORTE_DEFAULT, index: true },
    observaciones: { type: String, trim: true, default: '' },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'clasesCohorte', timestamps: true },
);

ClaseCohorteSchema.index({ idCohorte: 1, fechaClase: 1 });

module.exports = mongoose.model('ClaseCohorte', ClaseCohorteSchema);
