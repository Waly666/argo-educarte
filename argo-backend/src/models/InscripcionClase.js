const mongoose = require('mongoose');

/**
 * Inscripción de un alumno a una clase específica.
 * Es la lista de personas "anotadas" para asistir a esa sesión,
 * independiente de la matrícula al programa (que es un derecho permanente).
 *
 * Al borrar la clase también se eliminan sus inscripciones (cascade en el controlador).
 */
const InscripcionClaseSchema = new mongoose.Schema(
  {
    idClase: { type: mongoose.Schema.Types.ObjectId, ref: 'ClaseJornadaCap', required: true, index: true },
    numDoc: { type: Number, required: true, index: true },
    userAddReg: { type: String, trim: true },
  },
  { collection: 'inscripcionClase', timestamps: true },
);

InscripcionClaseSchema.index({ idClase: 1, numDoc: 1 }, { unique: true });

module.exports = mongoose.model('InscripcionClase', InscripcionClaseSchema);
