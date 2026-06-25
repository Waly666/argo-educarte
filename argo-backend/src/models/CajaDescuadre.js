const mongoose = require('mongoose');

const CajaDescuadreSchema = new mongoose.Schema(
  {
    idDescuadre: { type: Number, required: true, unique: true, index: true },
    idSesion: { type: Number, required: true, unique: true, index: true },
    idUsuarioCajero: { type: String, trim: true, index: true },
    usuarioCajero: { type: String, trim: true },
    empleadoId: { type: Number, index: true },
    efectivoEsperado: { type: mongoose.Schema.Types.Decimal128 },
    efectivoContado: { type: mongoose.Schema.Types.Decimal128 },
    diferencia: { type: mongoose.Schema.Types.Decimal128 },
    /** Monto que debe el cajero (faltante en caja); 0 si solo sobrante */
    montoDebe: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    estado: {
      type: String,
      enum: ['pendiente', 'resuelto', 'en_nomina', 'descontado_nomina'],
      default: 'pendiente',
      index: true,
    },
    autorizadoPor: { type: String, trim: true },
    nombreAutoriza: { type: String, trim: true },
    autorizadoEn: { type: Date },
    idNovedadNomina: { type: Number, index: true },
    idPeriodoNomina: { type: Number },
    fechaResolucion: { type: Date },
    resueltoPor: { type: String, trim: true },
    notaResolucion: { type: String, trim: true },
    fechaCierre: { type: Date, index: true },
  },
  { collection: 'cajaDescuadres', timestamps: true },
);

module.exports = mongoose.model('CajaDescuadre', CajaDescuadreSchema);
