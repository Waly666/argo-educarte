const mongoose = require('mongoose');

const AsisClasJorCapSchema = new mongoose.Schema(
  {
    idclaseJornada: { type: mongoose.Schema.Types.ObjectId, ref: 'ClaseJornadaCap', required: true, index: true },
    numDocAlumno: { type: Number, required: true, index: true },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'asisClasJorCap', timestamps: true },
);

AsisClasJorCapSchema.index({ idclaseJornada: 1, numDocAlumno: 1 }, { unique: true });

module.exports = mongoose.model('AsisClasJorCap', AsisClasJorCapSchema);
