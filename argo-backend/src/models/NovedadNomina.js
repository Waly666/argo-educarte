const mongoose = require('mongoose');

const NovedadNominaSchema = new mongoose.Schema(
  {
    idNovedad: { type: Number, required: true, unique: true, index: true },
    empleadoId: { type: Number, required: true, index: true },
    idPeriodo: { type: Number, index: true },
    tipoNovedad: { type: String, trim: true, required: true },
    codigoConcepto: { type: String, trim: true, index: true },
    naturaleza: { type: String, enum: ['devengo', 'deduccion'], trim: true },
    descripcion: { type: String, trim: true },
    valor: { type: mongoose.Schema.Types.Decimal128 },
    fecha: { type: Date, default: Date.now },
    autoGenerada: { type: Boolean, default: false },
    /** Egreso en caja que originó esta novedad (préstamo / abono adelanto) */
    idEgresoOrigen: { type: String, trim: true, index: true },
    /** PILA: IGE, LMA, SLN, VAC_LR, IRL */
    codigoPila: { type: String, trim: true, index: true },
    diasNovedad: { type: Number },
    fechaInicioNovedad: { type: Date },
    fechaFinNovedad: { type: Date },
    /** VAC_LR: V = vacaciones (X en PILA), L = licencia remunerada */
    subtipoVacLic: { type: String, trim: true },
    estado: { type: String, trim: true, default: 'activo' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'novedadesNomina', strict: false },
);

module.exports = mongoose.model('NovedadNomina', NovedadNominaSchema);
