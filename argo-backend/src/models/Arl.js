const mongoose = require('mongoose');

const ArlSchema = new mongoose.Schema(
  {
    idArl: { type: Number, required: true, unique: true, index: true },
    nombre: { type: String, required: true, trim: true },
    codigoMinisterio: { type: String, trim: true, index: true },
    nit: { type: String, trim: true },
    direccion: { type: String, trim: true },
    ciudad: { type: String, trim: true },
    nivelRiesgo: { type: Number },
    telefono: { type: String, trim: true },
    estado: { type: String, trim: true, default: 'activo' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'arl', strict: false },
);

module.exports = mongoose.model('Arl', ArlSchema);
