const mongoose = require('mongoose');

const MaterialVirtualSchema = new mongoose.Schema(
  {
    titulo: { type: String, trim: true, required: true },
    tipo: { type: String, enum: ['pdf', 'link', 'video', 'otro'], default: 'link' },
    url: { type: String, trim: true, required: true },
    orden: { type: Number, default: 0 },
  },
  { _id: true },
);

const SesionMeetSchema = new mongoose.Schema(
  {
    titulo: { type: String, trim: true, required: true },
    url: { type: String, trim: true, required: true },
    fecha: { type: Date, default: null },
    obligatoria: { type: Boolean, default: false },
  },
  { _id: true },
);

const CapacitacionVirtualConfigSchema = new mongoose.Schema(
  {
    idPrograma: { type: String, required: true, unique: true, trim: true, index: true },
    publicadoPortal: { type: Boolean, default: false },
    modoCertificado: {
      type: String,
      enum: ['al_pagar', 'al_aprobar'],
      default: 'al_pagar',
    },
    /** Si true, el alumno debe pagar (saldo en cero) antes de abrir el contenido del curso. */
    requierePagoParaCursar: { type: Boolean, default: false },
    pctMinCompletitud: { type: Number, default: 80, min: 0, max: 100 },
    pctMinEvaluaciones: { type: Number, default: 60, min: 0, max: 100 },
    intentosMaxEval: { type: Number, default: 3, min: 1 },
    /** Categorías del catálogo portal (categoriasVirtual.idCategoria) */
    idCategorias: { type: [Number], default: [] },
    nivel: {
      type: String,
      enum: ['PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO', null],
      default: null,
    },
    /** Ruta relativa bajo /uploads (aula-virtual-cursos/…) */
    rutaPaquete: { type: String, trim: true, default: null },
    indexHtml: { type: String, trim: true, default: 'index.html' },
    /** Prefijo localStorage del paquete (STORAGE_PREFIX en curso-app.js) */
    storagePrefix: { type: String, trim: true, default: null },
    materiales: { type: [MaterialVirtualSchema], default: [] },
    sesionesMeet: { type: [SesionMeetSchema], default: [] },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'capacitacionVirtualConfig', timestamps: true },
);

module.exports = mongoose.model('CapacitacionVirtualConfig', CapacitacionVirtualConfigSchema);
