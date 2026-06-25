const mongoose = require('mongoose');

const UsuarioPortalSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    numDoc: { type: Number, required: true, index: true },
    activo: { type: Boolean, default: true },
    ultimoAcceso: { type: Date, default: null },
  },
  { collection: 'usuariosPortal', timestamps: true },
);

module.exports = mongoose.model('UsuarioPortal', UsuarioPortalSchema);
