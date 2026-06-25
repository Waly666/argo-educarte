const mongoose = require('mongoose');

/**
 * Catálogo global de materias/temas reutilizables entre programas (banco de materias).
 * El nombre identifica la materia; las horas NO van aquí (se asignan por semestre).
 */
const CatalogoMateriaSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    /** Área/categoría opcional para agrupar (ej. "Legislación", "Seguridad"). */
    area: { type: String, trim: true, default: '' },
    descripcion: { type: String, trim: true, default: '' },
    activo: { type: Boolean, default: true, index: true },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'catalogoMaterias', timestamps: true },
);

// Nombre único (case-insensitive) para evitar duplicados en el banco de materias.
CatalogoMateriaSchema.index(
  { nombre: 1 },
  { unique: true, collation: { locale: 'es', strength: 2 } },
);

module.exports = mongoose.model('CatalogoMateria', CatalogoMateriaSchema);
