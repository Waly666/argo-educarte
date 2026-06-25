const mongoose = require('mongoose');

const FORMAS_PAGO = ['Efectivo', 'Transferencia', 'Cheque', 'Tarjeta debito', 'Tarjeta de Credito'];

const EgresoSchema = new mongoose.Schema(
  {
    fechaEgreso: { type: Date, default: Date.now, index: true },
    valorEgreso: { type: mongoose.Schema.Types.Decimal128, required: true },
    pagueA: { type: String, trim: true },
    /** FK lógica → empleados.numeroDocumento (opcional si el beneficiario es tercero) */
    numeroDocumento: { type: String, trim: true, index: true },
    concepto: { type: String, trim: true, required: true },
    /** idTipoEgreso del catálogo tipoEgreso (como string) */
    tipoEgreso: { type: String, trim: true, index: true },
    formaPago: { type: String, trim: true, enum: FORMAS_PAGO },
    numTransferencia: { type: String, trim: true },
    fechaTransferencia: { type: String, trim: true },
    cuentaOrigen: { type: String, trim: true },
    cuentaDestino: { type: String, trim: true },
    bancoDestino: { type: String, trim: true },
    urlSoporte: { type: String, trim: true },
    /** prestamo | abono_adelanto — plata que sale antes del pago de nómina */
    anticipoNomina: { type: String, trim: true },
    idPeriodo: { type: Number, index: true },
    idEmpleado: { type: Number, index: true },
    idNovedadGenerada: { type: Number },
    fechaAudi: { type: Date, default: Date.now },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
    fechaMod: { type: Date },
    /** Retiro de caja: supervisor que autorizó (login admin, sin cambiar sesión del cajero) */
    autorizadoPor: { type: String, trim: true },
    idUsuarioAutoriza: { type: mongoose.Schema.Types.ObjectId, index: true },
    nombreAutoriza: { type: String, trim: true },
    autorizadoEn: { type: Date },
    /** Sesión de caja en la que se registró el egreso */
    idSesion: { type: Number, index: true },
    /** Sede donde se registró el egreso */
    idSede: { type: String, trim: true, index: true },
    /** Placa del vehículo (egresos tipo combustible, mantenimiento, etc.) */
    placa: { type: String, trim: true, index: true },
  },
  { collection: 'egresos', timestamps: false, strict: false },
);

module.exports = mongoose.model('Egreso', EgresoSchema);
module.exports.FORMAS_PAGO = FORMAS_PAGO;
