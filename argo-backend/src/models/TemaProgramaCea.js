const mongoose = require('mongoose');
const { TIPOS_TEMA_CEA } = require('../constants/programacionCea');

const TemaProgramaCeaSchema = new mongoose.Schema(
  {
    idProg: { type: String, required: true, trim: true, index: true },
    tipo: { type: String, enum: TIPOS_TEMA_CEA, required: true },
    nombre: { type: String, required: true, trim: true },
    orden: { type: Number, default: 1 },
    horasTema: { type: Number, default: null },
    activo: { type: Boolean, default: true },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'temasProgramaCea', timestamps: true },
);

TemaProgramaCeaSchema.index({ idProg: 1, tipo: 1, orden: 1 });

module.exports = mongoose.model('TemaProgramaCea', TemaProgramaCeaSchema);
