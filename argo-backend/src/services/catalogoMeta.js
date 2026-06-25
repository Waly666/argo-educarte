const { CATALOGOS } = require('../models/catalogos');
const { CATEGORIAS_LICENCIA_VEHICULO } = require('../constants/categoriasLicenciaVehiculo');
const { normClaseVehiculoInspeccion } = require('../constants/inspeccionPreop');
const { CLASES_SERVICIO, CLASE_SERV_DEFAULT, normalizarClaseServ } = require('../constants/claseServicio');

/** Catálogos con pantallas dedicadas (no editar aquí). */
const EXCLUIDOS_ADMIN = new Set([
  'programas',
  'servicios',
  'itemsEstGral',
  'aspecto1',
  'aspecto2',
  'adaptaciones',
]);

const ETIQUETAS = {
  catTipoDoc: 'Tipos de documento',
  catTipoCapacitacion: 'Tipos de capacitación',
  catTipServicio: 'Tipos de servicio',
  cuentasBancarias: 'Cuentas bancarias',
  bancos: 'Bancos',
  catTipoPago: 'Tipos de pago',
  tipoIngreso: 'Tipos de ingreso',
  tipoEgreso: 'Tipos de egreso',
  catRegimenSalud: 'Régimen de salud',
  jornada: 'Jornadas',
  estrato: 'Estratos',
  nivelFormacion: 'Nivel de formación',
  ocupacion: 'Ocupaciones',
  discapacidad: 'Discapacidades',
  estadoCivil: 'Estado civil',
  genero: 'Género',
  tipoSangre: 'Tipo de sangre',
  multiCulturalidad: 'Multiculturalidad',
  claseVehiculo: 'Clases de vehículo',
  marcasVehiculos: 'Marcas de vehículos',
  lineasVehiculos: 'Líneas de vehículos',
  coloresVehiculos: 'Colores de vehículos',
  carrocerias: 'Carrocerías',
  divipola: 'Divipola (municipios)',
  aulas: 'Aulas',
  talleres: 'Talleres / patios / parqueaderos',
  itemDocumentosVehiculo: 'Documentos vehículo',
  itemDocumentosInstructores: 'Documentos instructores',
  itemsEstGral: 'Ítems estado general',
  adaptaciones: 'Adaptaciones',
  aspecto1: 'Aspecto 1',
  aspecto2: 'Aspecto 2',
  itemsInspeccion: 'Ítems inspección preoperacional',
  caractInspeccion: 'Características inspección',
  categoriasVirtual: 'Categorías cursos virtuales',
  modalidades: 'Modalidades de programa',
};

const ID_FIELDS_HINT = {
  catTipoDoc: ['idTipoDoc'],
  catTipoCapacitacion: ['idTipCap'],
  catTipServicio: ['idTipoServ'],
  cuentasBancarias: ['idCuenta'],
  bancos: ['idBanco'],
  catTipoPago: ['idTipoPago'],
  tipoIngreso: ['idTipoIngreso'],
  tipoEgreso: ['idTipoEgreso'],
  catRegimenSalud: ['idRegimen'],
  jornada: ['idJornada'],
  estrato: ['idEstrato'],
  nivelFormacion: ['idNivel'],
  ocupacion: ['idOcupacion'],
  discapacidad: ['idDiscapacidad'],
  estadoCivil: ['idEstadoCivil'],
  genero: ['idGenero'],
  tipoSangre: ['idTipoSangre'],
  multiCulturalidad: ['idMulti'],
  claseVehiculo: ['idClase'],
  marcasVehiculos: ['idMarca'],
  lineasVehiculos: ['idLinea'],
  coloresVehiculos: ['idColor'],
  carrocerias: ['idCarroceria'],
  divipola: ['codMunicipio'],
  aulas: ['idAula'],
  talleres: ['idTaller'],
  itemDocumentosVehiculo: ['idDocVehi'],
  itemDocumentosInstructores: ['idDocInst'],
  itemsEstGral: ['idItemEsGral'],
  itemsInspeccion: ['idItem'],
  caractInspeccion: ['idCaracteristica'],
  categoriasVirtual: ['idCategoria'],
  modalidades: ['idModalidad', 'codigo'],
};

/** Campos válidos por catálogo (evita columnas basura del Excel en admin). */
const CAMPOS_ESQUEMA = {
  aulas: ['idAula', 'nombre', 'estado', 'idSede'],
  talleres: ['idTaller', 'nombre', 'ubicacion', 'activo', 'idSede'],
  claseVehiculo: [
    'idClase',
    'descripcion',
    'carrocerias',
    ...CATEGORIAS_LICENCIA_VEHICULO,
  ],
  itemDocumentosVehiculo: ['idDocVehi', 'documentoVehi', 'descripcionDocVehi', 'controlaVencimiento'],
  itemDocumentosInstructores: ['idDocInst', 'documentoInst', 'descripcionDocInst', 'controlaVencimiento'],
  itemsEstGral: ['idItemEsGral', 'item', 'idClases'],
  adaptaciones: ['idAdaptacion', 'nombre', 'idClases'],
  aspecto1: ['idAspecto1', 'aspecto1', 'idClases'],
  aspecto2: ['idAspecto2', 'aspecto2', 'idClases'],
  itemsInspeccion: ['idItem', 'item', 'tiposVehiculo'],
  caractInspeccion: ['idCaracteristica', 'idItem', 'caracteristica'],
  tipoEgreso: ['idTipoEgreso', 'tipo', 'requiereEmpleado', 'efectoNomina', 'requiereVehiculo'],
  catTipServicio: ['idTipoServ', 'tipoServ', 'descTipoServ', 'claseServ'],
  categoriasVirtual: ['idCategoria', 'nombre', 'orden', 'activo'],
  modalidades: ['idModalidad', 'codigo', 'descripcion', 'activo'],
};

function validarClaseServCatalogo(doc) {
  const raw = doc?.claseServ;
  if (raw == null || String(raw).trim() === '') {
    doc.claseServ = CLASE_SERV_DEFAULT;
    return;
  }
  const norm = normalizarClaseServ(raw);
  if (!norm) {
    const err = new Error(`claseServ inválido. Use: ${CLASES_SERVICIO.join(', ')}`);
    err.status = 400;
    throw err;
  }
  doc.claseServ = norm;
}

/** Catálogos legacy del checklist (solo migración; no admin). */
const CATALOGOS_INSPECCION_LEGACY = new Set(['itemsEstGral', 'aspecto1', 'aspecto2', 'adaptaciones']);

/** Catálogos del checklist preoperacional (modelo inspTecPreop). */
const CATALOGOS_INSPECCION = new Set(['itemsInspeccion', 'caractInspeccion']);

/** Catálogos maestros de tipos de documento (vehículo / instructor). */
const CATALOGOS_DOCUMENTOS = new Set(['itemDocumentosVehiculo', 'itemDocumentosInstructores']);

function normBoolCatalogo(v) {
  if (v === true || v === 1 || v === '1' || v === 'true' || v === 'si' || v === 'Sí') return true;
  if (v === false || v === 0 || v === '0' || v === 'false' || v === 'no' || v === 'No') return false;
  return null;
}

function normalizeIdClases(v) {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) {
    return [...new Set(v.map((c) => String(c).trim()).filter(Boolean))];
  }
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return [];
    if (t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t);
        if (Array.isArray(parsed)) return normalizeIdClases(parsed);
      } catch {
        /* ignore */
      }
    }
    return [t];
  }
  return [String(v).trim()].filter(Boolean);
}

function normalizeTiposVehiculo(v) {
  const raw = normalizeIdClases(v);
  return [...new Set(raw.map((t) => normClaseVehiculoInspeccion(t)).filter(Boolean))];
}

function camposEsquema(nombre) {
  return CAMPOS_ESQUEMA[nombre] || null;
}

function docSegunEsquema(nombre, body) {
  const campos = camposEsquema(nombre);
  const doc = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (k === '_id' || k === '__v') continue;
    if (campos && !campos.includes(k)) continue;
    if (k === 'idClases' || k === 'tiposVehiculo') {
      doc[k] = k === 'tiposVehiculo' ? normalizeTiposVehiculo(v) : normalizeIdClases(v);
      continue;
    }
    if (k === 'controlaVencimiento') {
      doc[k] = normBoolCatalogo(v) ?? true;
      continue;
    }
    if (nombre === 'catTipServicio' && k === 'claseServ') {
      const norm = normalizarClaseServ(v);
      doc[k] = norm || (v == null || String(v).trim() === '' ? null : String(v).trim());
      continue;
    }
    if (CATEGORIAS_LICENCIA_VEHICULO.includes(k)) {
      doc[k] = normBoolCatalogo(v) ?? false;
      continue;
    }
    if (typeof v === 'string') {
      const t = v.trim();
      doc[k] = t === '' ? null : t;
    } else {
      doc[k] = v;
    }
  }
  return doc;
}

function resolverCamposListado(nombre, row) {
  const esquema = camposEsquema(nombre);
  if (esquema?.length) return ['_id', ...esquema];
  if (row) {
    return Object.keys(row).filter((k) => k !== '__v' && !/^col\d+$/i.test(k));
  }
  return [];
}

function nombreValido(nombre) {
  return !!CATALOGOS[nombre] && !EXCLUIDOS_ADMIN.has(nombre);
}

function metaCatalogo(nombre) {
  if (!nombreValido(nombre)) return null;
  return {
    nombre,
    label: ETIQUETAS[nombre] || nombre,
    idFields: ID_FIELDS_HINT[nombre] || [],
    grande: nombre === 'divipola',
    esInspeccionChecklist: CATALOGOS_INSPECCION.has(nombre),
    esCatalogoDocumento: CATALOGOS_DOCUMENTOS.has(nombre),
  };
}

function listarMeta() {
  return Object.keys(CATALOGOS)
    .filter((k) => nombreValido(k))
    .map((k) => metaCatalogo(k))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

function inferirCamposId(doc, hints = []) {
  const keys = Object.keys(doc || {}).filter((k) => k !== '_id' && k !== '__v');
  const fromHint = hints.filter((h) => doc && doc[h] != null);
  if (fromHint.length) return fromHint;
  const idLike = keys.filter((k) => /^id[A-Z_]|^cod[A-Z_]/i.test(k));
  return idLike.length ? idLike : keys.slice(0, 1);
}

module.exports = {
  EXCLUIDOS_ADMIN,
  normalizeIdClases,
  normalizeTiposVehiculo,
  CATALOGOS_INSPECCION,
  CATALOGOS_INSPECCION_LEGACY,
  CATALOGOS_DOCUMENTOS,
  nombreValido,
  metaCatalogo,
  listarMeta,
  inferirCamposId,
  camposEsquema,
  docSegunEsquema,
  resolverCamposListado,
  validarClaseServCatalogo,
};
