const mongoose = require('mongoose');
const {
  PROVEEDOR_STUB,
  PROVEEDOR_FACTUS,
  ESTADO_BORRADOR,
  ESTADOS_FE,
  CONCEPTOS_NOTA_CREDITO,
  NC_ANULACION,
  NOTA_CREDITO_TOTAL,
  NOTA_CREDITO_PARCIAL,
} = require('../constants/facturacionElectronica');

const ItemNotaSchema = new mongoose.Schema(
  {
    idLiquidacion: { type: mongoose.Schema.Types.ObjectId, ref: 'Liquidacion', default: null },
    idServ: { type: String, trim: true, default: null },
    descripcion: { type: String, trim: true, default: '' },
    condicionIva: { type: String, trim: true, default: 'gravado' },
    porcentajeIva: { type: Number, default: 0 },
    base: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    valorIva: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    total: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  },
  { _id: false },
);

const NotaCreditoSchema = new mongoose.Schema(
  {
    /** Factura electrónica que esta nota corrige/anula. */
    idFactura: { type: mongoose.Schema.Types.ObjectId, ref: 'FacturaElectronica', required: true, index: true },
    referenceCode: { type: String, required: true, unique: true, trim: true, index: true },

    numDoc: { type: Number, index: true },
    idSede: { type: String, trim: true, index: true },

    /** Concepto de corrección DIAN (1..5). */
    conceptoCorreccion: { type: String, enum: CONCEPTOS_NOTA_CREDITO, default: NC_ANULACION },
    tipo: { type: String, enum: [NOTA_CREDITO_TOTAL, NOTA_CREDITO_PARCIAL], default: NOTA_CREDITO_TOTAL },
    motivo: { type: String, trim: true, default: '' },

    /** Snapshot del adquirente (copiado de la factura). */
    adquirente: { type: mongoose.Schema.Types.Mixed, default: null },
    items: { type: [ItemNotaSchema], default: [] },

    /** Datos de la factura referenciada. */
    facturaNumero: { type: String, trim: true, default: '' },
    facturaCufe: { type: String, trim: true, default: '' },
    facturaReferenceCode: { type: String, trim: true, default: '' },

    proveedor: { type: String, enum: [PROVEEDOR_STUB, PROVEEDOR_FACTUS], default: PROVEEDOR_STUB },
    ambiente: { type: String, trim: true, default: 'sandbox' },
    modoDesarrollo: { type: Boolean, default: true, index: true },

    estado: { type: String, enum: ESTADOS_FE, default: ESTADO_BORRADOR, index: true },
    numeroNota: { type: String, trim: true, index: true },
    prefijo: { type: String, trim: true, default: '' },
    cude: { type: String, trim: true, default: '', index: true },

    base: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    valorIva: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    valorTotal: { type: mongoose.Schema.Types.Decimal128, default: 0 },

    payloadEnviado: { type: mongoose.Schema.Types.Mixed, default: null },
    respuestaProveedor: { type: mongoose.Schema.Types.Mixed, default: null },
    erroresValidacion: { type: mongoose.Schema.Types.Mixed, default: null },

    urlPdf: { type: String, trim: true, default: '' },
    urlQr: { type: String, trim: true, default: '' },

    emitidaAt: { type: Date, default: null },
    validadaAt: { type: Date, default: null },
    idUsuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
    userAddReg: { type: String, trim: true },
  },
  { collection: 'notasCreditoElectronicas', timestamps: true, strict: false },
);

NotaCreditoSchema.index({ createdAt: -1 });
NotaCreditoSchema.index({ idFactura: 1, createdAt: -1 });

module.exports = mongoose.model('NotaCredito', NotaCreditoSchema);
