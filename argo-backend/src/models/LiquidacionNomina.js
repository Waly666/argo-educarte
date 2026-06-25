const mongoose = require('mongoose');

const LineaNominaSchema = new mongoose.Schema(
  {
    codigoConcepto: { type: String, trim: true },
    concepto: { type: String, trim: true },
    naturaleza: {
      type: String,
      enum: ['devengo', 'deduccion', 'patronal', 'provision'],
      required: true,
    },
    valor: { type: Number, default: 0 },
  },
  { _id: false },
);

const DetalleEmpleadoSchema = new mongoose.Schema(
  {
    empleadoId: { type: Number, required: true },
    numeroDocumento: { type: String, trim: true },
    empleadoNombre: { type: String, trim: true },
    lineas: [LineaNominaSchema],
    totalDevengos: { type: Number, default: 0 },
    totalDeducciones: { type: Number, default: 0 },
    netoPagar: { type: Number, default: 0 },
    ibc: { type: Number, default: 0 },
    totalPatronal: { type: Number, default: 0 },
    totalProvisiones: { type: Number, default: 0 },
    totalCostoEmpresa: { type: Number, default: 0 },
    lineasPatronales: [{ codigoConcepto: String, concepto: String, naturaleza: String, valor: Number }],
    lineasProvisiones: [{ codigoConcepto: String, concepto: String, naturaleza: String, valor: Number }],
    pila: { type: mongoose.Schema.Types.Mixed },
    administradoras: { type: mongoose.Schema.Types.Mixed },
    advertencias: [String],
    tipoDocumento: { type: String, trim: true },
  },
  { _id: false },
);

const LiquidacionNominaSchema = new mongoose.Schema(
  {
    idLiquidacionNomina: { type: Number, required: true, unique: true, index: true },
    idPeriodo: { type: Number, required: true, unique: true, index: true },
    fechaLiquidacion: { type: Date, default: Date.now },
    estado: { type: String, trim: true, default: 'borrador' },
    detalle: [DetalleEmpleadoSchema],
    totalDevengos: { type: Number, default: 0 },
    totalDeducciones: { type: Number, default: 0 },
    totalNeto: { type: Number, default: 0 },
    totalPatronal: { type: Number, default: 0 },
    totalProvisiones: { type: Number, default: 0 },
    totalCostoEmpresa: { type: Number, default: 0 },
    cantidadEmpleados: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'liquidacionesNomina', strict: false },
);

module.exports = mongoose.model('LiquidacionNomina', LiquidacionNominaSchema);
