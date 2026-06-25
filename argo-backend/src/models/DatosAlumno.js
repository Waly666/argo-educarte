const mongoose = require('mongoose');
const { parseNumDoc, numDocInvalidMessage } = require('../utils/numDoc');
const { TIPOS_ALUMNO, TIPO_ALUMNO_DEFAULT } = require('../constants/tipoAlumno');

function normalizarNumDocEnDoc(doc) {
  if (!doc || doc.numDoc == null || doc.numDoc === '') return;
  const n = parseNumDoc(doc.numDoc);
  if (n != null) doc.numDoc = n;
}

const DatosAlumnoSchema = new mongoose.Schema(
  {
    fechaReg: { type: Date, default: Date.now },
    tipoAlumno: {
      type: String,
      enum: TIPOS_ALUMNO,
      default: TIPO_ALUMNO_DEFAULT,
      index: true,
    },
    tipoDoc: { type: String, trim: true },
    /** Número de documento (Number en MongoDB) */
    numDoc: { type: Number, required: true, unique: true, index: true },
    expedida: { type: String, trim: true },
    apellido1: { type: String, required: true, trim: true },
    apellido2: { type: String, trim: true, default: '' },
    nombre1: { type: String, required: true, trim: true },
    nombre2: { type: String, trim: true, default: '' },
    fechaNac: { type: Date },
    observaciones: { type: String, trim: true },
    genero: { type: String, trim: true },
    tipoSangre: { type: String, trim: true },
    jornada: { type: String, trim: true },
    estadoCivil: { type: String, trim: true },
    estrato: { type: String, trim: true },
    regimenSalud: { type: String, trim: true },
    nivelFormacion: { type: String, trim: true },
    ocupacion: { type: String, trim: true },
    discapacidad: { type: String, trim: true },
    munOrigen: { type: String, trim: true },
    codMunicipio: { type: String, trim: true },
    correo: { type: String, trim: true },
    direccion: { type: String, trim: true },
    celular: { type: String, trim: true },
    multiCulturalidad: { type: String, trim: true },
    urlFoto: { type: String, trim: true },
    urlCedula: { type: String, trim: true },
    urlLicencia: { type: String, trim: true },
    /** Empresa de transporte u organización a la que pertenece el alumno (ref a clientesFacturacion). */
    empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', default: null, index: true },
    /** Horas por sesión de práctica CEA al auto-generar clases (1–4). null = automático según config global. */
    duracionSesionPracticaCea: { type: Number, default: null, min: 1, max: 8 },
    /** Día de referencia acordado con el alumno para recordatorio de cobro (técnicos / cuotas). */
    alertaPago: { type: Date, default: null },
    /** quincenal | mensual */
    alertaPagoFrecuencia: { type: String, trim: true, default: null },
    fechaAudi: { type: Date, default: Date.now },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
    fechaMod: { type: Date },
  },
  { collection: 'datosAlumnos', timestamps: false, strict: false },
);

DatosAlumnoSchema.index({ apellido1: 'text', apellido2: 'text', nombre1: 'text', nombre2: 'text' });

DatosAlumnoSchema.pre('validate', function preValidateNumDoc(next) {
  normalizarNumDocEnDoc(this);
  if (this.numDoc == null || !Number.isFinite(this.numDoc)) {
    return next(new Error(numDocInvalidMessage()));
  }
  next();
});

DatosAlumnoSchema.pre('findOneAndUpdate', function preUpdateNumDoc(next) {
  const upd = this.getUpdate();
  const payload = upd?.$set || upd;
  if (payload) normalizarNumDocEnDoc(payload);
  next();
});

module.exports = mongoose.model('DatosAlumno', DatosAlumnoSchema);
