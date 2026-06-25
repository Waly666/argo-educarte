const mongoose = require('mongoose');

function flexSchema(collection) {
  return new mongoose.Schema({}, { collection, timestamps: false, strict: false });
}

function makeModel(modelName, collection) {
  if (mongoose.models[modelName]) return mongoose.models[modelName];
  return mongoose.model(modelName, flexSchema(collection));
}

const CATALOGOS = {
  catTipoDoc: 'catTipoDoc',
  catTipoCapacitacion: 'catTipoCapacitacion',
  catTipServicio: 'catTipServicio',
  servicios: 'servicios',
  programas: 'programas',
  cuentasBancarias: 'cuentasBancarias',
  bancos: 'bancos',
  catTipoPago: 'catTipoPago',
  tipoIngreso: 'tipoIngreso',
  tipoEgreso: 'tipoEgreso',
  catRegimenSalud: 'catRegimenSalud',
  jornada: 'jornada',
  estrato: 'estrato',
  nivelFormacion: 'nivelFormacion',
  ocupacion: 'ocupacion',
  discapacidad: 'discapacidad',
  estadoCivil: 'estadoCivil',
  genero: 'genero',
  tipoSangre: 'tipoSangre',
  multiCulturalidad: 'multiCulturalidad',
  claseVehiculo: 'claseVehiculo',
  marcasVehiculos: 'marcasVehiculos',
  lineasVehiculos: 'lineasVehiculos',
  coloresVehiculos: 'coloresVehiculos',
  carrocerias: 'carrocerias',
  divipola: 'divipola',
  aulas: 'aulas',
  talleres: 'talleres',
  itemDocumentosVehiculo: 'itemDocumentosVehiculo',
  itemDocumentosInstructores: 'itemDocumentosInstructores',
  itemsEstGral: 'itemsEstGral',
  adaptaciones: 'adaptaciones',
  aspecto1: 'aspecto1',
  aspecto2: 'aspecto2',
  itemsInspeccion: 'itemsInspeccion',
  caractInspeccion: 'caractInspeccion',
  categoriasVirtual: 'categoriasVirtual',
  modalidades: 'modalidades',
};

const models = {};
for (const [key, col] of Object.entries(CATALOGOS)) {
  models[key] = makeModel(`Cat_${key}`, col);
}

module.exports = { CATALOGOS, models };
