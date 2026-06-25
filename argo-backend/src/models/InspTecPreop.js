const mongoose = require('mongoose');

const ItemCheckSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true },
    nombre: { type: String, trim: true },
    si: { type: mongoose.Schema.Types.Mixed },
    observacion: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const InspTecPreopSchema = new mongoose.Schema(
  {
    placa: { type: String, required: true, index: true, trim: true },
    fecha: { type: String, required: true, index: true, trim: true },
    hora: { type: String, trim: true },
    entrega: { type: String, trim: true },
    recibe: { type: String, trim: true },
    /** Compatibilidad UI / impresión (nombre legible). */
    quienEntrega: { type: String, trim: true },
    quienRecibe: { type: String, trim: true },
    idEmpleadoRecibe: { type: Number, index: true },
    nombreRecibe: { type: String, trim: true },
    inspector: { type: String, trim: true, default: '' },
    documentoInspector: { type: String, trim: true, default: '' },
    combustible: { type: String, trim: true },
    documentosVehiculo: { type: [ItemCheckSchema], default: [] },
    documentosInstructor: { type: [ItemCheckSchema], default: [] },
    aptoLaborar: { type: mongoose.Schema.Types.Mixed },
    observacionesGenerales: { type: String, trim: true, default: '' },
    consecutivo: { type: String, trim: true },
    urlfotoLatDer: { type: String, trim: true, default: '' },
    urlfotoLatIzq: { type: String, trim: true, default: '' },
    urlfotoFrontal: { type: String, trim: true, default: '' },
    urlfotoPost: { type: String, trim: true, default: '' },
    fechaAudi: { type: Date, default: Date.now },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
    fechaMod: { type: Date },
    /** Id documento legacy inspeccionesvehiculos (migración). */
    legacyInspeccionId: { type: mongoose.Schema.Types.ObjectId, index: true },
  },
  { collection: 'inspTecPreop', timestamps: false, strict: false },
);

InspTecPreopSchema.index({ placa: 1, fecha: 1 }, { unique: true });

module.exports = mongoose.model('InspTecPreop', InspTecPreopSchema);
