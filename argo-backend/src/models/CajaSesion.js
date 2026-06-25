const mongoose = require('mongoose');

const CajaSesionSchema = new mongoose.Schema(
  {
    idSesion: { type: Number, required: true, unique: true, index: true },
    /** Sede donde opera esta caja */
    idSede: { type: String, trim: true, index: true },
    estado: { type: String, enum: ['abierta', 'cerrada'], default: 'abierta', index: true },
    usuario: { type: String, trim: true, index: true },
    idUsuario: { type: String, trim: true, index: true },
    fechaApertura: { type: Date, default: Date.now, index: true },
    fechaCierre: { type: Date, index: true },
    saldoInicial: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    saldoFinal: { type: mongoose.Schema.Types.Decimal128 },
    observacionesApertura: { type: String, trim: true },
    observacionesCierre: { type: String, trim: true },
    resumen: { type: mongoose.Schema.Types.Mixed },
    fechaAudi: { type: Date, default: Date.now },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
    fechaMod: { type: Date },
  },
  { collection: 'cajaSesiones', strict: false },
);

module.exports = mongoose.model('CajaSesion', CajaSesionSchema);
