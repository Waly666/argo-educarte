const mongoose = require('mongoose');

const ItemCheckSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true },
    nombre: { type: String, trim: true },
    item: { type: String, trim: true },
    aspecto: { type: String, trim: true },
    si: { type: mongoose.Schema.Types.Mixed },
    observacion: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const InspeccionVehiculoSchema = new mongoose.Schema(
  {
    placa: { type: String, required: true, index: true, trim: true },
    fecha: { type: String, required: true, index: true, trim: true },
    hora: { type: String, trim: true },
    combustible: { type: String, trim: true },
    quienEntrega: { type: String, trim: true },
    quienRecibe: { type: String, trim: true },
    idEmpleadoInstructor: { type: Number, index: true },
    nombreInstructor: { type: String, trim: true },
    documentosVehiculo: { type: [ItemCheckSchema], default: [] },
    documentosInstructor: { type: [ItemCheckSchema], default: [] },
    estadoGeneral: { type: [ItemCheckSchema], default: [] },
    adaptaciones: { type: [ItemCheckSchema], default: [] },
    aspecto1: { type: [ItemCheckSchema], default: [] },
    aspecto2: { type: [ItemCheckSchema], default: [] },
    aptoLaborar: { type: mongoose.Schema.Types.Mixed },
    observacionesGenerales: { type: String, trim: true, default: '' },
    consecutivo: { type: String, trim: true },
    fechaAudi: { type: Date, default: Date.now },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
    fechaMod: { type: Date },
  },
  { collection: 'inspeccionesvehiculos', timestamps: false, strict: false },
);

InspeccionVehiculoSchema.index({ placa: 1, fecha: 1 }, { unique: true });

module.exports = mongoose.model('InspeccionVehiculo', InspeccionVehiculoSchema);
