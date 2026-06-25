const mongoose = require('mongoose');

const EmpleadoSchema = new mongoose.Schema(
  {
    idEmpleado: { type: Number, required: true, unique: true, index: true },
    tipoDocumento: { type: String, trim: true, default: 'CC' },
    numeroDocumento: { type: String, required: true, unique: true, trim: true, index: true },
    primerNombre: { type: String, required: true, trim: true },
    segundoNombre: { type: String, trim: true, default: '' },
    primerApellido: { type: String, required: true, trim: true },
    segundoApellido: { type: String, trim: true, default: '' },
    fechaNacimiento: { type: Date },
    sexo: { type: String, trim: true },
    correoPersonal: { type: String, trim: true, lowercase: true },
    correoCorporativo: { type: String, trim: true, lowercase: true },
    telefono: { type: String, trim: true },
    celular: { type: String, trim: true },
    direccion: { type: String, trim: true },
    ciudad: { type: String, trim: true },
    departamento: { type: String, trim: true },
    estadoCivil: { type: String, trim: true },
    fechaIngreso: { type: Date },
    fechaRetiro: { type: Date },
    tipoContrato: { type: String, trim: true },
    salario: { type: mongoose.Schema.Types.Decimal128 },
    epsId: { type: Number, index: true },
    afpId: { type: Number, index: true },
    arlId: { type: Number, index: true },
    cajaCompensacionId: { type: Number, index: true },
    cargoId: { type: Number, index: true },
    departamentoId: { type: Number, index: true },
    /** Sede operativa del empleado; se hereda al usuario de login automático. */
    idSede: { type: String, trim: true, index: true },
    /** Usuario de login generado (cajero / instructor) */
    idUsuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', index: true },
    urlFoto: { type: String, trim: true },
    estado: { type: String, trim: true, default: 'activo' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'empleados', strict: false },
);

EmpleadoSchema.index({
  primerApellido: 'text',
  segundoApellido: 'text',
  primerNombre: 'text',
  segundoNombre: 'text',
  numeroDocumento: 'text',
});

module.exports = mongoose.model('Empleado', EmpleadoSchema);
