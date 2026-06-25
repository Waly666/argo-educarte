const mongoose = require('mongoose');
const {
  TIPOS_SERVICIO,
  MODALIDADES,
  COMBUSTIBLES,
  ESTADOS_VEHICULO,
  normalizarPlaca,
} = require('../constants/vehiculo');

function normalizarPlacaEnDoc(doc) {
  if (!doc || doc.placa == null || doc.placa === '') return;
  doc.placa = normalizarPlaca(doc.placa);
}

const VehiculoSchema = new mongoose.Schema(
  {
    placa: { type: String, required: true, unique: true, index: true, trim: true },
    /** Sede base del vehículo */
    idSede: { type: String, trim: true, index: true, default: '' },
    codigoMarca: { type: String, trim: true, index: true },
    nombreMarca: { type: String, trim: true },
    codigoLinea: { type: mongoose.Schema.Types.Mixed },
    nombreLinea: { type: String, trim: true },
    modelo: { type: String, trim: true },
    idClase: { type: mongoose.Schema.Types.Mixed, index: true },
    claseVehiculo: { type: String, trim: true },
    idColor: { type: mongoose.Schema.Types.Mixed },
    color: { type: String, trim: true },
    tipoServicio: { type: String, enum: TIPOS_SERVICIO, trim: true },
    carroceria: { type: String, trim: true },
    modalidad: { type: String, enum: MODALIDADES, trim: true },
    cilindraje: { type: String, trim: true },
    numeroMotor: { type: String, trim: true },
    numeroChasis: { type: String, trim: true },
    serie: { type: String, trim: true },
    tonelaje: { type: String, trim: true },
    pasajeros: { type: String, trim: true },
    combustible: { type: String, enum: COMBUSTIBLES, trim: true },
    numeroLicencia: { type: String, trim: true },
    observaciones: { type: String, trim: true },
    urlFoto: { type: String, trim: true },
    estado: { type: String, enum: ESTADOS_VEHICULO, default: 'Libre', index: true },
    fechaAudi: { type: Date, default: Date.now },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
    fechaMod: { type: Date },
  },
  { collection: 'vehiculos', timestamps: false, strict: false },
);

VehiculoSchema.index({
  placa: 'text',
  nombreMarca: 'text',
  nombreLinea: 'text',
  modelo: 'text',
  claseVehiculo: 'text',
});

VehiculoSchema.pre('validate', function preValidatePlaca(next) {
  normalizarPlacaEnDoc(this);
  if (!this.placa) return next(new Error('La placa es obligatoria'));
  next();
});

VehiculoSchema.pre('findOneAndUpdate', function preUpdatePlaca(next) {
  const upd = this.getUpdate();
  const payload = upd?.$set || upd;
  if (payload) normalizarPlacaEnDoc(payload);
  next();
});

module.exports = mongoose.model('Vehiculo', VehiculoSchema);
