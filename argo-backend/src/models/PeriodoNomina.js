const mongoose = require('mongoose');

const PeriodoNominaSchema = new mongoose.Schema(
  {
    idPeriodo: { type: Number, required: true, unique: true, index: true },
    ano: { type: Number, required: true, index: true },
    mes: { type: Number, required: true, index: true },
    nombre: { type: String, trim: true },
    fechaInicio: { type: Date, required: true },
    fechaFin: { type: Date, required: true },
    estado: {
      type: String,
      trim: true,
      default: 'abierto',
      enum: ['abierto', 'novedades', 'liquidado', 'cerrado', 'pagado'],
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'periodosNomina', strict: false },
);

PeriodoNominaSchema.index({ ano: 1, mes: 1 }, { unique: true });

module.exports = mongoose.model('PeriodoNomina', PeriodoNominaSchema);
