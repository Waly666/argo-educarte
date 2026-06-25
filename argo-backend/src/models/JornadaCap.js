const mongoose = require('mongoose');
const { ESTADOS_JORNADA, ESTADO_JORNADA_INACTIVO, DETE_GEOREFE_VALORES } = require('../constants/jornadaCapacitacion');

const JornadaCapSchema = new mongoose.Schema(
  {
    idContrato: { type: mongoose.Schema.Types.ObjectId, ref: 'Contratacion', required: true, index: true },
    fechaProgramacion: { type: Date, required: true, index: true },
    municipio: { type: String, trim: true, default: '' },
    depto: { type: String, trim: true, default: '' },
    /** Código Divipola del municipio (si se conoce). */
    codMunicipio: { type: String, trim: true, default: '' },
    direccion: { type: String, trim: true, default: '' },
    /** 1..N cuando hay varias jornadas el mismo día (contrato.jornadasPorDia). */
    indiceEnDia: { type: Number, default: 1 },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    /** MAPA | DISPOSITIVO_MOVIL | MANUAL — cómo se obtuvo la georreferenciación. */
    deteGeorefe: { type: String, enum: [...DETE_GEOREFE_VALORES, ''], default: '' },
    horaInicio: { type: Date, default: null },
    numeObjeJornada: { type: Number, default: 0 },
    supervisor: { type: String, trim: true, default: '' },
    estado: { type: String, enum: ESTADOS_JORNADA, default: ESTADO_JORNADA_INACTIVO },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'jornadasCap', timestamps: true },
);

module.exports = mongoose.model('JornadaCap', JornadaCapSchema);
