const mongoose = require('mongoose');
const { TIPOS_MATERIAL, TIPO_MATERIAL_DEFAULT } = require('../constants/cohortesAcademicas');

/** Material de apoyo de una materia (enlace, video o documento). */
const MaterialCohorteSchema = new mongoose.Schema(
  {
    idProg: { type: String, required: true, trim: true, index: true },
    numSemestre: { type: Number, required: true, min: 1, index: true },
    idMateria: { type: mongoose.Schema.Types.ObjectId, ref: 'MateriaCohorte', required: true, index: true },
    /** Si se asigna, el material es solo de esa cohorte; si es null, vale para todas. */
    idCohorte: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohorte', default: null, index: true },
    titulo: { type: String, required: true, trim: true },
    tipo: { type: String, enum: TIPOS_MATERIAL, default: TIPO_MATERIAL_DEFAULT },
    url: { type: String, trim: true, default: '' },
    descripcion: { type: String, trim: true, default: '' },
    orden: { type: Number, default: 1 },
    activo: { type: Boolean, default: true },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'materialesCohorte', timestamps: true },
);

MaterialCohorteSchema.index({ idProg: 1, numSemestre: 1, idMateria: 1, orden: 1 });

module.exports = mongoose.model('MaterialCohorte', MaterialCohorteSchema);
