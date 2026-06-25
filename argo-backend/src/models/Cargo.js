const mongoose = require('mongoose');

const CargoSchema = new mongoose.Schema(
  {
    idCargo: { type: Number, required: true, unique: true, index: true },
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String, trim: true },
    nivel: { type: String, trim: true },
    salarioBase: { type: mongoose.Schema.Types.Decimal128 },
    estado: { type: String, trim: true, default: 'activo' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'cargos', strict: false },
);

module.exports = mongoose.model('Cargo', CargoSchema);
