const mongoose = require('mongoose');
const { TIPOS_REGULAR_JORNADA, TIPO_REGULAR_JORNADA_DEFAULT } = require('../constants/tipoRegularJornada');

const CertificadoSchema = new mongoose.Schema(
  {
    numDoc:        { type: Number, required: true, index: true },
    idLiquidacion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Liquidacion',
    },
    idContrato: { type: mongoose.Schema.Types.ObjectId, ref: 'Contratacion', default: null, index: true },
    /** Jornada donde se completó y emitió el certificado (capacitación). */
    idJornada: { type: mongoose.Schema.Types.ObjectId, ref: 'JornadaCap', default: null, index: true },
    generadoAutoJornada: { type: Boolean, default: false },
    horasCert: { type: String, trim: true, default: '' },
    idProg:        { type: String, required: true, trim: true },
    numActa:       { type: String, trim: true },
    numFolio:      { type: String, trim: true },
    numRunt:       { type: String, trim: true },
    fechaEmision:    { type: Date, default: Date.now },
    fechaVencimiento:{ type: Date, default: null },
    observaciones:   { type: String, trim: true },
    estado:        { type: String, trim: true, default: 'vigente' }, // vigente | vencido | anulado
    codigoCert:    { type: String, trim: true, index: true },
    /** Código de verificación público (históricos / consulta Aula Virtual). */
    codVerificacion: { type: String, trim: true, index: true, sparse: true },
    idPlantilla:   { type: mongoose.Schema.Types.ObjectId, ref: 'PlantillaCertificado', default: null },
    orientacion:   { type: String, enum: ['vertical', 'horizontal'], default: 'vertical' },
    /** Formato/plantilla: curso, tecnico, competencias, … */
    tipoFormatoCert: { type: String, trim: true, default: '', index: true },
    /** Categoría: Regular | Jornadas de Capacitación */
    tipoCertificado: {
      type: String,
      enum: TIPOS_REGULAR_JORNADA,
      default: TIPO_REGULAR_JORNADA_DEFAULT,
      index: true,
    },
    /** Nombre del curso / capacitación impreso en el certificado */
    encabezado: { type: String, trim: true, default: '' },
    idUsuario:     { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
    /** Empresa del alumno al momento de emitir (ref a clientesFacturacion). */
    empresaId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', default: null, index: true },
    /** Nombre de la empresa copiado al momento de emitir (para búsqueda y filtro). */
    empresaNombre: { type: String, trim: true, default: null },
  },
  { collection: 'certificados', timestamps: true, strict: false },
);

/** Un certificado por liquidación; los históricos no llevan idLiquidacion (campo ausente). */
CertificadoSchema.index(
  { idLiquidacion: 1 },
  {
    unique: true,
    partialFilterExpression: { idLiquidacion: { $type: 'objectId' } },
  },
);

module.exports = mongoose.model('Certificado', CertificadoSchema);
