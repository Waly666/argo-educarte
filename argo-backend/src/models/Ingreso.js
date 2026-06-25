const mongoose = require('mongoose');

const FORMAS_PAGO = ['Efectivo', 'Transferencia', 'Cheque', 'Tarjeta debito', 'Tarjeta de Credito'];

/** Detalle de un comprobante que paga varios ítems de liquidación a la vez. */
const DetalleIngresoSchema = new mongoose.Schema(
  {
    idLiquidacion: { type: mongoose.Schema.Types.ObjectId, ref: 'Liquidacion', required: true },
    descripcion: { type: String, trim: true, default: '' },
    valor: { type: mongoose.Schema.Types.Decimal128, required: true },
    tipoAbono: { type: String, enum: ['total', 'abono'], trim: true },
  },
  { _id: false },
);

const IngresoSchema = new mongoose.Schema(
  {
    /** Documento del alumno (cobro liquidación) o null en ingreso caja tercero */
    numDoc: { type: Number, default: null, index: true },
    /** Ítem único (compat). En comprobante multi-ítem va null y el detalle está en `detalle`. */
    idLiquidacion: { type: mongoose.Schema.Types.ObjectId, ref: 'Liquidacion', default: null },
    /** Desglose cuando un mismo comprobante paga varios servicios. */
    detalle: { type: [DetalleIngresoSchema], default: undefined },
    /** Alias esquema: valorIngreso. En multi-ítem es la suma del detalle. */
    valor: { type: mongoose.Schema.Types.Decimal128, required: true },
    numRecibo: { type: String, trim: true, index: true },
    /** Catálogo catTipoPago (legacy) */
    idTipoPago: { type: String, required: true, trim: true },
    idBanco: { type: String, trim: true, default: null },
    idCuentaBancaria: { type: String, trim: true, default: null },
    /** Legacy — usar numTransferencia */
    numComprobante: { type: String, trim: true },
    fecha: { type: Date, default: Date.now },
    observaciones: { type: String, trim: true },
    tipoAbono: { type: String, enum: ['total', 'abono'], trim: true },
    idUsuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
    idSesion: { type: Number, index: true },
    /** Sede donde se registró el ingreso */
    idSede: { type: String, trim: true, index: true },

    /** FK lógica → catálogo tipoIngreso */
    idTipoIngreso: { type: String, trim: true, index: true },
    /** Denormalizado: CURSOS, CEA, INGRESO CONTRATO, etc. */
    tipoIngreso: { type: String, trim: true, index: true },
    ingresoCaja: { type: Boolean, default: false, index: true },
    concepto: { type: String, trim: true },

    /** Quién entrega el dinero */
    recibiDe: { type: String, trim: true },
    recibidoDe: { type: String, trim: true },
    documentoTercero: { type: String, trim: true, index: true },
    tipoPersona: { type: String, enum: ['natural', 'juridica'], trim: true },

    formaPago: { type: String, trim: true, enum: FORMAS_PAGO },
    numTransferencia: { type: String, trim: true },
    fechaTransferencia: { type: String, trim: true },
    bancoEmisor: { type: String, trim: true },
    /** id o descripción cuenta CEA que recibe */
    cuentaRecibe: { type: String, trim: true },
    /** Voucher / captura / foto del cheque para pagos no efectivo */
    urlSoporte: { type: String, trim: true },

    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
    fechaMod: { type: Date },
  },
  { collection: 'ingresos', timestamps: true, strict: false },
);

module.exports = mongoose.model('Ingreso', IngresoSchema);
module.exports.FORMAS_PAGO = FORMAS_PAGO;
