const mongoose = require('mongoose');
const { TIPOS_PREGUNTA, TIPO_PREGUNTA_DEFAULT } = require('../constants/cohortesAcademicas');

const OpcionSchema = new mongoose.Schema(
  {
    texto: { type: String, required: true, trim: true },
    correcta: { type: Boolean, default: false },
  },
  { _id: false },
);

/**
 * Pregunta del banco, ligada a una materia del CATÁLOGO global.
 * Así una pregunta sirve para todos los programas que usen esa materia/tema.
 */
const PreguntaBancoCohorteSchema = new mongoose.Schema(
  {
    idMateriaCatalogo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CatalogoMateria',
      required: true,
      index: true,
    },
    enunciado: { type: String, required: true, trim: true },
    tipo: { type: String, enum: TIPOS_PREGUNTA, default: TIPO_PREGUNTA_DEFAULT },
    opciones: { type: [OpcionSchema], default: [] },
    explicacion: { type: String, trim: true, default: '' },
    /** 1=fácil, 2=media, 3=difícil */
    dificultad: { type: Number, default: 1, min: 1, max: 3 },
    activo: { type: Boolean, default: true },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'bancoPreguntasCohorte', timestamps: true },
);

module.exports = mongoose.model('PreguntaBancoCohorte', PreguntaBancoCohorteSchema);
