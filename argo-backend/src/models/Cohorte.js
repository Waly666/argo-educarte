const mongoose = require('mongoose');
const {
  ESTADOS_COHORTE,
  ESTADO_COHORTE_DEFAULT,
  MODOS_CONSUMO_HORAS,
  MODO_CONSUMO_HORAS_DEFAULT,
  MODOS_CERTIFICADO_COHORTE,
  MODO_CERTIFICADO_COHORTE_DEFAULT,
  CRITERIOS_CERTIFICADO_DEFAULT,
} = require('../constants/cohortesAcademicas');

/** Criterios para emitir certificado automático al cerrar la cohorte. */
const CriteriosCertificadoSchema = new mongoose.Schema(
  {
    minAsistenciaPct: { type: Number, default: CRITERIOS_CERTIFICADO_DEFAULT.minAsistenciaPct, min: 0, max: 100 },
    minNotaPromedio: { type: Number, default: CRITERIOS_CERTIFICADO_DEFAULT.minNotaPromedio, min: 0, max: 100 },
    requiereTodasMaterias: { type: Boolean, default: CRITERIOS_CERTIFICADO_DEFAULT.requiereTodasMaterias },
    requiereEvaluaciones: { type: Boolean, default: CRITERIOS_CERTIFICADO_DEFAULT.requiereEvaluaciones },
  },
  { _id: false },
);

/** Oferta de un semestre de un programa en un periodo (grupo de alumnos). */
const CohorteSchema = new mongoose.Schema(
  {
    idProg: { type: String, required: true, trim: true, index: true },
    numSemestre: { type: Number, required: true, min: 1 },
    anio: { type: Number, required: true, index: true },
    /** Periodo dentro del año (1, 2, ...) */
    periodo: { type: Number, default: 1, min: 1 },
    /** Código automático, ej. 2026-1-PROG12-S1 */
    codigo: { type: String, trim: true, index: true },
    /** Nombre editable, ej. "Diplomado RRHH mañana" */
    nombre: { type: String, trim: true, default: '' },
    idSede: { type: String, trim: true, index: true, default: '' },
    cupoMaximo: { type: Number, default: null },
    inscritos: { type: Number, default: 0 },
    estado: { type: String, enum: ESTADOS_COHORTE, default: ESTADO_COHORTE_DEFAULT, index: true },
    fechaInicio: { type: Date, default: null },
    fechaFin: { type: Date, default: null },
    modoConsumoHoras: {
      type: String,
      enum: MODOS_CONSUMO_HORAS,
      default: MODO_CONSUMO_HORAS_DEFAULT,
    },
    certificadoModo: {
      type: String,
      enum: MODOS_CERTIFICADO_COHORTE,
      default: MODO_CERTIFICADO_COHORTE_DEFAULT,
    },
    criteriosCertificado: { type: CriteriosCertificadoSchema, default: () => ({}) },
    idEmpleadoInstructor: { type: Number, default: null },
    observaciones: { type: String, trim: true, default: '' },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'cohortes', timestamps: true },
);

CohorteSchema.index({ idProg: 1, numSemestre: 1, anio: 1, periodo: 1 }, { unique: true });

module.exports = mongoose.model('Cohorte', CohorteSchema);
