const mongoose = require('mongoose');

const CambioSchema = new mongoose.Schema(
  {
    campo: { type: String, trim: true },
    antes: { type: mongoose.Schema.Types.Mixed },
    despues: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false },
);

const AuditoriaSchema = new mongoose.Schema(
  {
    idAuditoria: { type: Number, required: true, unique: true, index: true },
    fecha: { type: Date, default: Date.now, index: true },
    accion: {
      type: String,
      enum: ['crear', 'modificar', 'eliminar', 'consulta', 'apertura_caja', 'cierre_caja', 'otro'],
      required: true,
      index: true,
    },
    entidad: { type: String, trim: true, index: true },
    idEntidad: { type: String, trim: true, index: true },
    metodo: { type: String, trim: true },
    ruta: { type: String, trim: true, index: true },
    rutaBase: { type: String, trim: true, index: true },
    codigoHttp: { type: Number },
    usuario: { type: String, trim: true, index: true },
    idUsuario: { type: String, trim: true },
    rol: { type: String, trim: true },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true },
    resumen: { type: String, trim: true },
    datosAntes: { type: mongoose.Schema.Types.Mixed },
    datosDespues: { type: mongoose.Schema.Types.Mixed },
    cambios: [CambioSchema],
    payload: { type: mongoose.Schema.Types.Mixed },
    archivoLog: { type: String, trim: true },
  },
  { collection: 'auditoria', strict: false },
);

module.exports = mongoose.model('Auditoria', AuditoriaSchema);
