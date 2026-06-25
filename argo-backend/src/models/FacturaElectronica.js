const mongoose = require('mongoose');
const {
  PROVEEDOR_STUB,
  PROVEEDOR_FACTUS,
  ESTADO_BORRADOR,
  ESTADOS_FE,
  ADQUIRENTE_ALUMNO,
  ADQUIRENTE_CLIENTE,
  FORMA_PAGO_CREDITO,
} = require('../constants/facturacionElectronica');

/** Ítem de factura (proviene de una liquidación del alumno). */
const ItemFacturaSchema = new mongoose.Schema(
  {
    idLiquidacion: { type: mongoose.Schema.Types.ObjectId, ref: 'Liquidacion' },
    idServ: { type: String, trim: true, default: null },
    idProg: { type: String, trim: true, default: null },
    descripcion: { type: String, trim: true, default: '' },
    /** Condición de IVA del servicio: gravado | exento | excluido. */
    condicionIva: { type: String, trim: true, default: 'gravado' },
    porcentajeIva: { type: Number, default: 0 },
    /** Valor de la liquidación (IVA incluido). */
    valorLiquidacion: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    base: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    valorIva: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    total: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  },
  { _id: false },
);

/** Datos del adquirente (alumno o cliente del catálogo). */
const AdquirenteSchema = new mongoose.Schema(
  {
    tipo: { type: String, enum: [ADQUIRENTE_ALUMNO, ADQUIRENTE_CLIENTE], default: ADQUIRENTE_ALUMNO },
    idCliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', default: null },
    identificationDocumentCode: { type: String, trim: true, default: '13' },
    identificacion: { type: String, trim: true, default: '' },
    dv: { type: String, trim: true, default: '' },
    legalOrganizationCode: { type: String, trim: true, default: '2' },
    tributeCode: { type: String, trim: true, default: 'ZZ' },
    responsabilidadFiscal: { type: String, trim: true, default: 'R-99-PN' },
    nombre: { type: String, trim: true, default: '' },
    razonSocial: { type: String, trim: true, default: '' },
    nombres: { type: String, trim: true, default: '' },
    direccion: { type: String, trim: true, default: '' },
    correo: { type: String, trim: true, default: '' },
    telefono: { type: String, trim: true, default: '' },
    municipioCodigo: { type: String, trim: true, default: '' },
    tipoContratoCap: { type: String, trim: true, default: '' },
    granContribuyente: { type: Boolean, default: false },
    autoretenedor: { type: Boolean, default: false },
    agenteRetenedorIva: { type: Boolean, default: false },
    porcentajeReteIva: { type: Number, default: 0 },
    porcentajeReteFuente: { type: Number, default: 0 },
  },
  { _id: false },
);

const FacturaElectronicaSchema = new mongoose.Schema(
  {
    /** Alumno origen de las liquidaciones (aunque se facture a un cliente). */
    numDoc: { type: Number, index: true },
    /** Contrato de capacitación (factura manual, 1 por contrato). */
    idContrato: { type: mongoose.Schema.Types.ObjectId, ref: 'Contratacion', default: null, index: true },
    origenFactura: { type: String, trim: true, default: 'liquidacion' },
    tipoContratoCap: { type: String, trim: true, default: '' },
    retencionesContrato: { type: mongoose.Schema.Types.Mixed, default: null },
    idSede: { type: String, trim: true, index: true },

    /** Código único para el proveedor (Factus reference_code). */
    referenceCode: { type: String, required: true, unique: true, trim: true, index: true },

    adquirente: { type: AdquirenteSchema, default: () => ({}) },
    items: { type: [ItemFacturaSchema], default: [] },

    proveedor: { type: String, enum: [PROVEEDOR_STUB, PROVEEDOR_FACTUS], default: PROVEEDOR_STUB },
    ambiente: { type: String, trim: true, default: 'sandbox' },
    modoDesarrollo: { type: Boolean, default: true, index: true },

    estado: { type: String, enum: ESTADOS_FE, default: ESTADO_BORRADOR, index: true },
    numeroFactura: { type: String, trim: true, index: true },
    prefijo: { type: String, trim: true, default: '' },
    cufe: { type: String, trim: true, default: '', index: true },

    /** Forma de pago DIAN: a crédito por defecto (queda saldo). */
    formaPago: { type: String, trim: true, default: FORMA_PAGO_CREDITO },
    fechaVencimiento: { type: Date, default: null },

    /** Totales de la factura. */
    base: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    valorIva: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    valorTotal: { type: mongoose.Schema.Types.Decimal128, default: 0 },

    /** ReteIVA informativa (la aplica el cliente gran contribuyente). */
    reteIvaAplica: { type: Boolean, default: false },
    reteIvaPorcentaje: { type: Number, default: 0 },
    reteIvaValor: { type: mongoose.Schema.Types.Decimal128, default: 0 },

    payloadEnviado: { type: mongoose.Schema.Types.Mixed, default: null },
    respuestaProveedor: { type: mongoose.Schema.Types.Mixed, default: null },
    erroresValidacion: { type: mongoose.Schema.Types.Mixed, default: null },

    urlPdf: { type: String, trim: true, default: '' },
    urlXml: { type: String, trim: true, default: '' },
    urlQr: { type: String, trim: true, default: '' },
    urlPublica: { type: String, trim: true, default: '' },

    observaciones: { type: String, trim: true, default: '' },
    emitidaAt: { type: Date, default: null },
    validadaAt: { type: Date, default: null },

    idUsuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
    userAddReg: { type: String, trim: true },
  },
  { collection: 'facturasElectronicas', timestamps: true, strict: false },
);

FacturaElectronicaSchema.index({ createdAt: -1 });
FacturaElectronicaSchema.index({ estado: 1, createdAt: -1 });
FacturaElectronicaSchema.index({ 'items.idLiquidacion': 1 });

module.exports = mongoose.model('FacturaElectronica', FacturaElectronicaSchema);
