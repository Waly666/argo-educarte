const mongoose = require('mongoose');

const LiquidacionSchema = new mongoose.Schema(
  {
    numDoc:      { type: Number, required: true, index: true },
    idSede:      { type: String, trim: true, index: true },
    idMat:       { type: mongoose.Schema.Types.ObjectId, ref: 'Matricula', default: null },
    idServ:      { type: String, trim: true, default: null },
    idProg:      { type: String, trim: true, default: null },
    descripcion: { type: String, trim: true },
    valor:       { type: mongoose.Schema.Types.Decimal128, default: 0 },
    abonado:     { type: mongoose.Schema.Types.Decimal128, default: 0 },
    saldo:       { type: mongoose.Schema.Types.Decimal128, default: 0 },
    estado:      { type: String, trim: true, default: 'pendiente' }, // pendiente | parcial | pagado
    fechaCreacion: { type: Date, default: Date.now },
  },
  { collection: 'liquidacion', timestamps: true, strict: false },
);

module.exports = mongoose.model('Liquidacion', LiquidacionSchema);
