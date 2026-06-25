const mongoose = require('mongoose');

const MatriculaSchema = new mongoose.Schema(
  {
    numDoc:    { type: Number, required: true, index: true },
    /** Sede donde se matricula el alumno */
    idSede:    { type: String, trim: true, index: true },
    idProg:    { type: String, required: true, trim: true },
    fechaMat:  { type: Date, default: Date.now },
    valorMat:  { type: mongoose.Schema.Types.Decimal128, default: 0 },
    tarifa:    { type: Number, default: 1 },
    pagada:    { type: String, trim: true, default: 'No Pago' }, // No Pago | Pago Parcial | Pagado
    estado:    { type: String, trim: true, default: 'activa' },
    observaciones: { type: String, trim: true },
  },
  { collection: 'matriculas', timestamps: true, strict: false },
);

module.exports = mongoose.model('Matricula', MatriculaSchema);
