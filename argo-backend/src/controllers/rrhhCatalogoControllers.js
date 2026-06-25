const Cargo = require('../models/Cargo');
const DepartamentoEmpresa = require('../models/DepartamentoEmpresa');
const Eps = require('../models/Eps');
const Afp = require('../models/Afp');
const Arl = require('../models/Arl');
const CajaCompensacion = require('../models/CajaCompensacion');
const { createCatalogController } = require('../services/rrhhCatalogo');

const cargoFields = ['nombre', 'descripcion', 'nivel', 'salarioBase', 'estado'];
const simpleFields = ['nombre', 'descripcion', 'estado'];
const nitFields = ['nombre', 'nit', 'telefono', 'estado'];
const arlFields = ['nombre', 'nit', 'nivelRiesgo', 'telefono', 'estado'];

exports.cargo = createCatalogController(Cargo, {
  idField: 'idCargo',
  fields: cargoFields,
  searchFields: ['nombre', 'descripcion', 'nivel'],
});

exports.departamento = createCatalogController(DepartamentoEmpresa, {
  idField: 'idDepartamento',
  fields: simpleFields,
});

exports.eps = createCatalogController(Eps, { idField: 'idEps', fields: nitFields });
exports.afp = createCatalogController(Afp, { idField: 'idAfp', fields: nitFields });
exports.arl = createCatalogController(Arl, {
  idField: 'idArl',
  fields: arlFields,
  searchFields: ['nombre', 'nit'],
});

exports.cajaCompensacion = createCatalogController(CajaCompensacion, {
  idField: 'idCajaCompensacion',
  fields: nitFields,
});
