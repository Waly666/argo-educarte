const mongoose = require('mongoose');

const SupervisorSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    documento: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    telefono: { type: String, trim: true, default: '' },
    activo: { type: Boolean, default: true },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'supervisores', timestamps: true },
);

module.exports = mongoose.model('Supervisor', SupervisorSchema);
