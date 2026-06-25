const mongoose = require('mongoose');
const { DETE_GEOREFE_VALORES } = require('../constants/jornadaCapacitacion');

const SedeSchema = new mongoose.Schema(
  {
    idSede: { type: String, required: true, unique: true, trim: true, index: true },
    nombre: { type: String, required: true, trim: true },
    codigo: { type: String, trim: true, default: '' },
    direccion: { type: String, trim: true, default: '' },
    /** Municipio (nombre) */
    ciudad: { type: String, trim: true, default: '' },
    departamento: { type: String, trim: true, default: '' },
    codMunicipio: { type: String, trim: true, default: '' },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    deteGeorefe: { type: String, enum: [...DETE_GEOREFE_VALORES, ''], default: '' },
    telefono: { type: String, trim: true, default: '' },
    activa: { type: Boolean, default: true, index: true },
    esPrincipal: { type: Boolean, default: false, index: true },
    /** todos | tipos | especificos */
    programasMode: { type: String, trim: true, default: 'todos' },
    programasTiposPermitidos: { type: [String], default: [] },
    programasIdsPermitidos: { type: [Number], default: [] },
    serviciosMode: { type: String, trim: true, default: 'todos' },
    serviciosTiposPermitidos: { type: [String], default: [] },
    serviciosIdsPermitidos: { type: [Number], default: [] },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'sedes', timestamps: true },
);

module.exports = mongoose.model('Sede', SedeSchema);
