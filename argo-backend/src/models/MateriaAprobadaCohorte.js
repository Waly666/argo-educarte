const mongoose = require('mongoose');

/** Registro de materia aprobada por un alumno; se conserva al retomar un semestre. */
const MateriaAprobadaCohorteSchema = new mongoose.Schema(
  {
    numDoc: { type: Number, required: true, index: true },
    idMateria: { type: mongoose.Schema.Types.ObjectId, ref: 'MateriaCohorte', required: true, index: true },
    idProg: { type: String, required: true, trim: true, index: true },
    numSemestre: { type: Number, required: true, min: 1 },
    nota: { type: Number, default: null, min: 0, max: 100 },
    aprobada: { type: Boolean, default: false },
    fecha: { type: Date, default: Date.now },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'materiasAprobadasCohorte', timestamps: true },
);

MateriaAprobadaCohorteSchema.index({ numDoc: 1, idMateria: 1 }, { unique: true });

module.exports = mongoose.model('MateriaAprobadaCohorte', MateriaAprobadaCohorteSchema);
