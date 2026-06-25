const mongoose = require('mongoose');

/** Configuración global (documento único por clave) — recibos / comprobantes */
const ConfigSchema = new mongoose.Schema(
  {
    clave: { type: String, required: true, unique: true, trim: true },
    nombreEmpresa: { type: String, trim: true, default: 'ARGO — Centro de Formación' },
    nit: { type: String, trim: true, default: '' },
    direccion: { type: String, trim: true, default: '' },
    ciudad: { type: String, trim: true, default: '' },
    telefono: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    urlLogo: { type: String, trim: true, default: '' },
    prefijoFactura: { type: String, trim: true, default: 'FV' },
    consecutivoFactura: { type: Number, default: 0 },
    prefijoComprobanteIngreso: { type: String, trim: true, default: 'CI' },
    consecutivoComprobanteIngreso: { type: Number, default: 0 },
    prefijoComprobanteEgreso: { type: String, trim: true, default: 'CE' },
    consecutivoComprobanteEgreso: { type: Number, default: 0 },
    /** Certificados emitidos */
    prefijoCertificado: { type: String, trim: true, default: 'CERT' },
    consecutivoCertificado: { type: Number, default: 0 },
    slogan1: { type: String, trim: true, default: '' },
    mensajeEncabezado: { type: String, trim: true, default: 'COMPROBANTE DE INGRESO' },
    mensajePie: {
      type: String,
      trim: true,
      default: 'Este documento no constituye factura electrónica. Conserve su comprobante.',
    },
    anchoReciboMm: { type: Number, default: 80 },
    mostrarQr: { type: Boolean, default: true },
  },
  { collection: 'config', timestamps: true, strict: false },
);

module.exports = mongoose.model('Config', ConfigSchema);
