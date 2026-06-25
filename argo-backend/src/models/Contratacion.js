const mongoose = require('mongoose');

const ContratacionSchema = new mongoose.Schema(
  {
    tipoIdentificacion: { type: String, trim: true },
    numeroIdentificacion: { type: String, trim: true, index: true },
    /** Código interno / referencia del contrato de capacitación. */
    codContrato: { type: String, trim: true, default: '' },
    razoSocial: { type: String, trim: true },
    nombreComercial: { type: String, trim: true },
    email: { type: String, trim: true },
    telefono: { type: String, trim: true },
    direccion: { type: String, trim: true },
    codMunicipio: { type: String, trim: true },
    ciudad: { type: String, trim: true },
    departamento: { type: String, trim: true },
    pais: { type: String, trim: true, default: 'Colombia' },
    codigoPostal: { type: String, trim: true },
    estado: { type: String, trim: true, default: 'En Ejecución' },
    /** Fecha en que se cerró el contrato (estado Ejecutado). */
    fechaFinalizacion: { type: Date, default: null },
    fechaRegistro: { type: Date, default: Date.now },
    fechacontrato: { type: String, trim: true },
    objeto: { type: String, trim: true },
    /** Descripción larga del objeto contractual (capacitación contratada). */
    objetoContrato: { type: String, trim: true, default: '' },
    supervisor: { type: String, trim: true },
    idSupervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'Supervisor', default: null },
    numerojornadas: { type: Number, default: 0 },
    /** Cuántas jornadas (carpas/sedes) se programan el mismo día calendario. */
    jornadasPorDia: { type: Number, default: 1 },
    numeroAlumnos: { type: Number, default: 0 },
    numeObjeJornada: { type: Number, default: 0 },
    nombreCertificacion: { type: String, trim: true },
    numeroHorascert: { type: String, trim: true },
    incluiSab: { type: Boolean, default: false },
    incluiDom: { type: Boolean, default: false },
    incluiFest: { type: Boolean, default: false },
    fechaInicJornadas: { type: Date, default: null },
    numSesCert: { type: Number, default: 1 },
    jornadasGeneradas: { type: Boolean, default: false },
    /** Cliente en catálogo clientesFacturacion (obligatorio para facturar; el tipo fiscal vive en el cliente). */
    idClienteFacturacion: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', default: null },
    valorContrato: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    idFacturaElectronica: { type: mongoose.Schema.Types.ObjectId, ref: 'FacturaElectronica', default: null },
    facturadoAt: { type: Date, default: null },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'contratacion', timestamps: true, strict: false },
);

module.exports = mongoose.model('Contratacion', ContratacionSchema);
