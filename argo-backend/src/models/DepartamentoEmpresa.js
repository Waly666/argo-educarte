const mongoose = require('mongoose');

const DepartamentoEmpresaSchema = new mongoose.Schema(
  {
    idDepartamento: { type: Number, required: true, unique: true, index: true },
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String, trim: true },
    estado: { type: String, trim: true, default: 'activo' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'departamentosEmpresa', strict: false },
);

module.exports = mongoose.model('DepartamentoEmpresa', DepartamentoEmpresaSchema);
