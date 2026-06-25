const mongoose = require('mongoose');

const ClaseProgresoSchema = new mongoose.Schema(
  {
    numero: { type: Number, required: true, min: 1 },
    pct: { type: Number, default: 0, min: 0, max: 100 },
    aprobada: { type: Boolean, default: false },
  },
  { _id: false },
);

const IntentoEvalSchema = new mongoose.Schema(
  {
    nota: { type: Number, min: 0, max: 100, required: true },
    pctCompletitud: { type: Number, min: 0, max: 100, default: 0 },
    aprobado: { type: Boolean, default: false },
    fecha: { type: Date, default: Date.now },
  },
  { _id: true },
);

const ProgresoVirtualCursoSchema = new mongoose.Schema(
  {
    numDoc: { type: Number, required: true, index: true },
    idPrograma: { type: String, required: true, trim: true, index: true },
    pctCompletitud: { type: Number, default: 0, min: 0, max: 100 },
    /** Nota media de las lecciones con evaluación (quiz por clase). */
    promedioClases: { type: Number, default: null, min: 0, max: 100 },
    clases: { type: [ClaseProgresoSchema], default: [] },
    mejorNotaEval: { type: Number, default: null, min: 0, max: 100 },
    ultimaNotaEval: { type: Number, default: null, min: 0, max: 100 },
    intentosEval: { type: Number, default: 0, min: 0 },
    aprobado: { type: Boolean, default: false },
    certificadoEmitido: { type: Boolean, default: false },
    intentos: { type: [IntentoEvalSchema], default: [] },
    fechaUltimaActividad: { type: Date, default: Date.now },
    /** Sincronizaciones desde el paquete HTML (argo-bridge). */
    contadorSyncs: { type: Number, default: 0, min: 0 },
  },
  { collection: 'progresoVirtualCurso', timestamps: true },
);

ProgresoVirtualCursoSchema.index({ numDoc: 1, idPrograma: 1 }, { unique: true });

module.exports = mongoose.model('ProgresoVirtualCurso', ProgresoVirtualCursoSchema);
