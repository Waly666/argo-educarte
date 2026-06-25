const mongoose = require('mongoose');

const CategoriaVirtualSchema = new mongoose.Schema(
  {
    idCategoria: { type: Number, required: true, unique: true, index: true },
    nombre: { type: String, trim: true, required: true },
    orden: { type: Number, default: 0 },
    activo: { type: Boolean, default: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'categoriasVirtual', timestamps: true },
);

module.exports = mongoose.model('CategoriaVirtual', CategoriaVirtualSchema);
