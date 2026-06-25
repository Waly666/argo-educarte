const mongoose = require('mongoose');

const RolAppSchema = new mongoose.Schema(
  {
    codigo: { type: String, required: true, unique: true, trim: true, lowercase: true },
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String, trim: true, default: '' },
    permisos: { type: [String], default: [] },
    alarmas: { type: [String], default: [] },
    esSistema: { type: Boolean, default: false },
    activo: { type: Boolean, default: true },
  },
  { collection: 'roles_app', timestamps: true },
);

module.exports = mongoose.model('RolApp', RolAppSchema);
