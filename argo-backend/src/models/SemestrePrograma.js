const mongoose = require('mongoose');

/** Horas de cada semestre de un programa que usa cohortes (editable por semestre). */
const SemestreProgramaSchema = new mongoose.Schema(
  {
    idProg: { type: String, required: true, trim: true, index: true },
    numSemestre: { type: Number, required: true, min: 1 },
    horas: { type: Number, default: 0, min: 0 },
    orden: { type: Number, default: 1 },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'semestresPrograma', timestamps: true },
);

SemestreProgramaSchema.index({ idProg: 1, numSemestre: 1 }, { unique: true });

module.exports = mongoose.model('SemestrePrograma', SemestreProgramaSchema);
