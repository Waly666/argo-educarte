const mongoose = require('mongoose');

const ComboProgramaSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String, trim: true, default: '' },
    /** IDs de los programas que forman el combo (solo presenciales, tarifa 2) */
    programas: [{ type: String, trim: true }],
    activo: { type: Boolean, default: true },
    userAddReg: { type: String, trim: true },
  },
  { collection: 'combosPrograma', timestamps: true },
);

module.exports = mongoose.model('ComboPrograma', ComboProgramaSchema);
