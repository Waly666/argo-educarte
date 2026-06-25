const mongoose = require('mongoose');

const DocVehiculoSchema = new mongoose.Schema(
  {
    idDocVehi: { type: mongoose.Schema.Types.Mixed, index: true },
    placa: { type: String, required: true, index: true, trim: true },
    documento: { type: String, trim: true },
    numero: { type: String, trim: true },
    fechaExp: { type: Date },
    fechaVence: { type: Date },
    urlArchivo: { type: String, trim: true },
    fechaAudi: { type: Date, default: Date.now },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
    fechaMod: { type: Date },
  },
  { collection: 'docsvehiculos', timestamps: false, strict: false },
);

module.exports = mongoose.model('DocVehiculo', DocVehiculoSchema);
