const mongoose = require('mongoose');

const DetInspeccionSchema = new mongoose.Schema(
  {
    idInspeccion: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: 'InspTecPreop' },
    idItem: { type: Number, required: true, index: true },
    idCaracteristica: { type: Number, required: true, index: true },
    aprobado: { type: mongoose.Schema.Types.Mixed },
    observacion: { type: String, trim: true, default: '' },
  },
  { collection: 'detInspeccion', timestamps: false },
);

DetInspeccionSchema.index({ idInspeccion: 1, idCaracteristica: 1 }, { unique: true });

module.exports = mongoose.model('DetInspeccion', DetInspeccionSchema);
