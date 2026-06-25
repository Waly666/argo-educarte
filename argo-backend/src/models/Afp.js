const mongoose = require('mongoose');

const AfpSchema = new mongoose.Schema(
  {
    idAfp: { type: Number, required: true, unique: true, index: true },
    nombre: { type: String, required: true, trim: true },
    codigoMinisterio: { type: String, trim: true, index: true },
    nit: { type: String, trim: true },
    direccion: { type: String, trim: true },
    ciudad: { type: String, trim: true },
    telefono: { type: String, trim: true },
    estado: { type: String, trim: true, default: 'activo' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'afp', strict: false },
);

module.exports = mongoose.model('Afp', AfpSchema);
