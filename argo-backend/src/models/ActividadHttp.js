const mongoose = require('mongoose');

const ActividadHttpSchema = new mongoose.Schema(
  {
    idActividad: { type: Number, required: true, unique: true, index: true },
    fecha: { type: Date, default: Date.now },
    idUsuario: { type: String, index: true },
    usuario: { type: String, trim: true, index: true },
    nombreUsuario: { type: String, trim: true },
    rol: { type: String, trim: true },
    metodo: { type: String, trim: true },
    ruta: { type: String, trim: true },
    rutaBase: { type: String, trim: true, index: true },
    rutaPantalla: { type: String, trim: true },
    codigoHttp: { type: Number },
    duracionMs: { type: Number },
    bytesEntrada: { type: Number, default: 0 },
    bytesSalida: { type: Number, default: 0 },
    actividad: { type: String, trim: true },
    ip: { type: String, trim: true },
  },
  { collection: 'actividadHttp', strict: false },
);

ActividadHttpSchema.index({ fecha: -1 });
ActividadHttpSchema.index({ fecha: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 14 });

module.exports = mongoose.model('ActividadHttp', ActividadHttpSchema);
