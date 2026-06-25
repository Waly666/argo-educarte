const mongoose = require('mongoose');

const ContratoSchema = new mongoose.Schema(
  {
    idContrato: { type: Number, required: true, unique: true, index: true },
    empleadoId: { type: Number, required: true, index: true },
    numeroContrato: { type: String, trim: true },
    tipoContrato: { type: String, trim: true },
    fechaInicio: { type: Date },
    fechaFin: { type: Date },
    salario: { type: mongoose.Schema.Types.Decimal128 },
    auxilioTransporte: { type: Boolean, default: false },
    horasSemanales: { type: Number },
    estado: { type: String, trim: true, default: 'activo' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'contratos', strict: false },
);

module.exports = mongoose.model('Contrato', ContratoSchema);
