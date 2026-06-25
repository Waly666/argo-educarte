const mongoose = require('mongoose');

const PagoEnLineaIntentSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, index: true, trim: true },
    numDoc: { type: Number, required: true, index: true },
    idLiquidacion: { type: mongoose.Schema.Types.ObjectId, ref: 'Liquidacion', required: true, index: true },
    idPrograma: { type: String, trim: true, index: true },
    idMatricula: { type: mongoose.Schema.Types.ObjectId, ref: 'Matricula', default: null },
    montoCentavos: { type: Number, required: true },
    montoCop: { type: Number, required: true },
    moneda: { type: String, default: 'COP', trim: true },
    estado: {
      type: String,
      enum: ['pending', 'approved', 'declined', 'voided', 'error'],
      default: 'pending',
      index: true,
    },
    wompiTransactionId: { type: String, trim: true, index: true, sparse: true },
    wompiStatus: { type: String, trim: true },
    idIngreso: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingreso', default: null },
    customerEmail: { type: String, trim: true },
    redirectUrl: { type: String, trim: true },
    rawWebhook: { type: mongoose.Schema.Types.Mixed },
  },
  { collection: 'pagosEnLineaIntents', timestamps: true },
);

module.exports = mongoose.model('PagoEnLineaIntent', PagoEnLineaIntentSchema);
