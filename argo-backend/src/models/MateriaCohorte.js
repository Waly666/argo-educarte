const mongoose = require('mongoose');

/** Materia/tema de un semestre de un programa. Su carga horaria consume el total del semestre. */
const MateriaCohorteSchema = new mongoose.Schema(
  {
    idProg: { type: String, required: true, trim: true, index: true },
    numSemestre: { type: Number, required: true, min: 1, index: true },
    /** Referencia al banco/catálogo global de materias (parametrización). */
    idMateriaCatalogo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CatalogoMateria',
      default: null,
      index: true,
    },
    /** Nombre denormalizado (snapshot del catálogo) para mostrar sin joins. */
    nombre: { type: String, required: true, trim: true },
    horas: { type: Number, default: 0, min: 0 },
    orden: { type: Number, default: 1 },
    activo: { type: Boolean, default: true },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'materiasCohorte', timestamps: true },
);

MateriaCohorteSchema.index({ idProg: 1, numSemestre: 1, orden: 1 });

module.exports = mongoose.model('MateriaCohorte', MateriaCohorteSchema);
