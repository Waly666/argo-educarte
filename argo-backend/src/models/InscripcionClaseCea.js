const mongoose = require('mongoose');
const {
  ORIGENES_HORAS_CEA,
  TIPOS_HORA_CEA,
  ESTADOS_INSCRIPCION_CEA,
} = require('../constants/programacionCea');

const InscripcionClaseCeaSchema = new mongoose.Schema(
  {
    idClase: { type: mongoose.Schema.Types.ObjectId, ref: 'ClaseProgramadaCea', required: true, index: true },
    numDoc: { type: Number, required: true, index: true },
    idMat: { type: mongoose.Schema.Types.ObjectId, ref: 'Matricula', default: null },
    idLiq: { type: mongoose.Schema.Types.ObjectId, ref: 'Liquidacion', default: null },
    idServ: { type: String, trim: true, default: '' },
    idProg: { type: String, trim: true, required: true, index: true },
    origenHoras: { type: String, enum: ORIGENES_HORAS_CEA, required: true },
    tipoHoras: { type: String, enum: TIPOS_HORA_CEA, required: true },
    /** Horas que consume esta inscripción hacia el saldo del alumno */
    horasAsignadas: { type: Number, default: 0 },
    estado: { type: String, enum: ESTADOS_INSCRIPCION_CEA, default: 'INSCRITO' },
    userAddReg: { type: String, trim: true },
  },
  { collection: 'inscripcionesClaseCea', timestamps: true },
);

InscripcionClaseCeaSchema.index({ numDoc: 1, idProg: 1, tipoHoras: 1 });

module.exports = mongoose.model('InscripcionClaseCea', InscripcionClaseCeaSchema);
