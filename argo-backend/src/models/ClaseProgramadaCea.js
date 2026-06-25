const mongoose = require('mongoose');
const { ESTADOS_CLASE_CEA, TIPOS_CLASE_CEA } = require('../constants/programacionCea');

const ClaseProgramadaCeaSchema = new mongoose.Schema(
  {
    idProg: { type: String, required: true, trim: true, index: true },
    tipoClase: { type: String, enum: TIPOS_CLASE_CEA, required: true, index: true },
    idTema: { type: mongoose.Schema.Types.ObjectId, ref: 'TemaProgramaCea', default: null },
    fechaClase: { type: Date, required: true, index: true },
    /** HH:mm — hora programada de inicio */
    horaDesde: { type: String, trim: true, default: '' },
    /** HH:mm — hora programada de fin */
    horaHasta: { type: String, trim: true, default: '' },
    /** Duración en horas (práctica vehículo: 1–4) */
    duracionHoras: { type: Number, default: null },
    /** Horas a descontar del saldo del alumno (si no se indica, se calcula del horario) */
    horasDescuento: { type: Number, default: null },
    idAula: { type: String, trim: true, default: '' },
    idTaller: { type: String, trim: true, default: '' },
    idVehiculo: { type: String, trim: true, default: '' },
    /** Sede donde se imparte la clase */
    idSede: { type: String, trim: true, index: true, default: '' },
    idEmpleadoInstructor: { type: Number, index: true, default: null },
    idUsuarioInstructor: { type: String, trim: true, default: '' },
    cupoMaximo: { type: Number, default: null },
    inscritos: { type: Number, default: 0 },
    estado: { type: String, enum: ESTADOS_CLASE_CEA, default: 'PROGRAMADA', index: true },
    horaInicio: { type: Date, default: null },
    horaFin: { type: Date, default: null },
    duracionSegundos: { type: Number, default: null },
    observaciones: { type: String, trim: true, default: '' },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'clasesProgramadasCea', timestamps: true },
);

ClaseProgramadaCeaSchema.index({ fechaClase: 1, tipoClase: 1, idVehiculo: 1 });
ClaseProgramadaCeaSchema.index({ fechaClase: 1, idAula: 1 });
ClaseProgramadaCeaSchema.index({ fechaClase: 1, idTaller: 1 });

module.exports = mongoose.model('ClaseProgramadaCea', ClaseProgramadaCeaSchema);
