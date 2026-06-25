const Config = require('../models/Config');

const CLAVE = 'formatoInspeccionVehiculos';
const DEFAULT_CONSECUTIVO = {
  prefijoConsecutivoInspeccion: 'INSP',
  consecutivoInspeccion: 0,
};

function formatearConsecutivoInspeccion(prefijo, numero) {
  const pref = String(prefijo || DEFAULT_CONSECUTIVO.prefijoConsecutivoInspeccion).trim() || 'INSP';
  const n = Math.max(1, Number(numero) || 1);
  return `${pref}-${String(n).padStart(6, '0')}`;
}

async function previewConsecutivoInspeccion() {
  let doc = await Config.findOne({ clave: CLAVE }).lean();
  if (!doc) {
    return formatearConsecutivoInspeccion(DEFAULT_CONSECUTIVO.prefijoConsecutivoInspeccion, 1);
  }
  const prefijo = String(doc.prefijoConsecutivoInspeccion || DEFAULT_CONSECUTIVO.prefijoConsecutivoInspeccion).trim();
  const actual = Math.max(0, Number(doc.consecutivoInspeccion) || 0);
  return formatearConsecutivoInspeccion(prefijo, actual + 1);
}

async function reservarConsecutivoInspeccion() {
  let doc = await Config.findOne({ clave: CLAVE });
  if (!doc) {
    doc = await Config.create({
      clave: CLAVE,
      ...DEFAULT_CONSECUTIVO,
      consecutivoInspeccion: 1,
    });
  } else {
    doc.consecutivoInspeccion = (doc.consecutivoInspeccion || 0) + 1;
    await doc.save();
  }
  const prefijo = String(doc.prefijoConsecutivoInspeccion || DEFAULT_CONSECUTIVO.prefijoConsecutivoInspeccion).trim();
  return formatearConsecutivoInspeccion(prefijo, doc.consecutivoInspeccion || 1);
}

module.exports = {
  CLAVE,
  DEFAULT_CONSECUTIVO,
  formatearConsecutivoInspeccion,
  previewConsecutivoInspeccion,
  reservarConsecutivoInspeccion,
};
