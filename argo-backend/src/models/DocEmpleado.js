const mongoose = require('mongoose');

const DocEmpleadoSchema = new mongoose.Schema(
  {
    idDocumento: { type: mongoose.Schema.Types.Mixed, index: true },
    idEmpleado: { type: Number, required: true, index: true },
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
  { collection: 'docsempleados', timestamps: false, strict: false },
);

module.exports = mongoose.model('DocEmpleado', DocEmpleadoSchema);
