const mongoose = require('mongoose');
const {
  TIPOS_CRITERIO_NOTA,
  TIPO_CRITERIO_NOTA_DEFAULT,
  ESQUEMA_NOTAS_DEFAULT,
  NOTA_MINIMA_APROBACION_DEFAULT,
} = require('../constants/cohortesAcademicas');

const CriterioNotaSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    pesoPct: { type: Number, required: true, min: 0, max: 100 },
    tipo: { type: String, enum: TIPOS_CRITERIO_NOTA, default: TIPO_CRITERIO_NOTA_DEFAULT },
    orden: { type: Number, default: 1 },
  },
  { _id: true },
);

const ConfigEvaluacionesSchema = new mongoose.Schema(
  {
    pesoParcialesPct: { type: Number, default: 40, min: 0, max: 100 },
    pesoFinalPct: { type: Number, default: 60, min: 0, max: 100 },
    maxParcialesPorMateria: { type: Number, default: 3, min: 0 },
    requiereFinalPorMateria: { type: Boolean, default: true },
  },
  { _id: false },
);

/**
 * Esquema de calificación del programa (heredado por todas sus cohortes).
 * Los criterios deben sumar 100%.
 */
const EsquemaNotasProgramaSchema = new mongoose.Schema(
  {
    idProg: { type: String, required: true, trim: true, unique: true, index: true },
    criterios: { type: [CriterioNotaSchema], default: () => ESQUEMA_NOTAS_DEFAULT.criterios.map((c) => ({ ...c })) },
    configEvaluaciones: { type: ConfigEvaluacionesSchema, default: () => ({ ...ESQUEMA_NOTAS_DEFAULT.configEvaluaciones }) },
    notaMinimaAprobacion: { type: Number, default: NOTA_MINIMA_APROBACION_DEFAULT, min: 0, max: 100 },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'esquemasNotasPrograma', timestamps: true },
);

module.exports = mongoose.model('EsquemaNotasPrograma', EsquemaNotasProgramaSchema);
