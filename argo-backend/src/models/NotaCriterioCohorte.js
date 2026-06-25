const mongoose = require('mongoose');

/** Nota manual de un criterio (Participación, Talleres, Actitud…) por alumno y materia. */
const NotaCriterioCohorteSchema = new mongoose.Schema(
  {
    idCohorte: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohorte', required: true, index: true },
    idMateria: { type: mongoose.Schema.Types.ObjectId, ref: 'MateriaCohorte', required: true, index: true },
    idCriterio: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    numDoc: { type: Number, required: true, index: true },
    nota: { type: Number, min: 0, max: 100, default: null },
    observacion: { type: String, trim: true, default: '' },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'notasCriterioCohorte', timestamps: true },
);

NotaCriterioCohorteSchema.index({ idCohorte: 1, idMateria: 1, idCriterio: 1, numDoc: 1 }, { unique: true });

module.exports = mongoose.model('NotaCriterioCohorte', NotaCriterioCohorteSchema);
