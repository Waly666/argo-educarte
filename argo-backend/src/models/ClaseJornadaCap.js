const mongoose = require('mongoose');
const { ESTADOS_CLASE, UBICACIONES_CLASE } = require('../constants/jornadaCapacitacion');

const ClaseJornadaCapSchema = new mongoose.Schema(
  {
    idPrograma: { type: String, required: true, trim: true, index: true },
    idJornada: { type: mongoose.Schema.Types.ObjectId, ref: 'JornadaCap', required: true, index: true },
    /** Misma fecha programada de la jornada seleccionada (inicio de día local). */
    fechaClase: { type: Date, required: true, index: true },
    /** Ruta relativa: evidenciascap/{codContrato}/fotos/{idClase}_{YYYYMMDDHHmmss}.ext */
    urlforo: { type: String, trim: true, default: '' },
    horaInicio: { type: Date, default: null },
    horaFin: { type: Date, default: null },
    /** Segundos transcurridos entre horaInicio y horaFin (calculado al finalizar). */
    duracionSegundos: { type: Number, default: null },
    ubicacion: { type: String, enum: UBICACIONES_CLASE, default: 'Carpa' },
    idinstructor: { type: String, trim: true, default: '' },
    /** Empleado instructor (RRHH) vinculado al usuario que crea/opera la clase */
    idEmpleadoInstructor: { type: Number, index: true, default: null },
    idUsuarioInstructor: { type: String, trim: true, default: '' },
    estado: { type: String, enum: ESTADOS_CLASE, default: 'PROGRAMADA' },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'clasesJornadaCap', timestamps: true },
);

module.exports = mongoose.model('ClaseJornadaCap', ClaseJornadaCapSchema);
