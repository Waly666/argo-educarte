const Config = require('../models/Config');
const {
  GEOREF_PROVEEDOR_NOMINATIM,
  GEOREF_PROVEEDORES,
} = require('../constants/georefProveedor');

const CLAVE = 'georef';

const DEFAULTS = {
  clave: CLAVE,
  proveedor: GEOREF_PROVEEDOR_NOMINATIM,
  hereApiKey: '',
  hereAppId: '',
};

let cacheInterno = null;
let cacheExpira = 0;
const CACHE_MS = 30_000;

function normalizar(doc) {
  const raw = { ...DEFAULTS, ...(doc || {}) };
  const p = String(raw.proveedor || GEOREF_PROVEEDOR_NOMINATIM).trim().toLowerCase();
  raw.proveedor = GEOREF_PROVEEDORES.includes(p) ? p : GEOREF_PROVEEDOR_NOMINATIM;
  raw.hereApiKey = String(raw.hereApiKey || '').trim();
  raw.hereAppId = String(raw.hereAppId || '').trim();
  raw.clave = CLAVE;
  return raw;
}

function enmascararApiKey(key) {
  const k = String(key || '').trim();
  if (!k) return '';
  if (k.length <= 4) return '••••';
  const visibles = k.slice(-4);
  return `${'•'.repeat(Math.min(k.length - 4, 16))}${visibles}`;
}

function esApiKeyEnmascarada(v) {
  const s = String(v || '').trim();
  return !s || s.includes('•');
}

function invalidarCache() {
  cacheInterno = null;
  cacheExpira = 0;
}

function serializarParaApi(doc) {
  const raw = normalizar(doc);
  return {
    proveedor: raw.proveedor,
    hereAppId: raw.hereAppId,
    apiKeyConfigurada: !!raw.hereApiKey,
    apiKeyEnmascarada: enmascararApiKey(raw.hereApiKey),
    _actualizadoEn: doc?.updatedAt || null,
  };
}

async function obtenerConfigGeorefInterno() {
  const now = Date.now();
  if (cacheInterno && now < cacheExpira) return { ...cacheInterno };
  const doc = await Config.findOne({ clave: CLAVE }).lean();
  const cfg = normalizar(doc || DEFAULTS);
  cacheInterno = cfg;
  cacheExpira = now + CACHE_MS;
  return { ...cfg };
}

async function obtenerConfigGeoref() {
  const doc = await Config.findOne({ clave: CLAVE }).lean();
  return serializarParaApi(doc || DEFAULTS);
}

async function actualizarConfigGeoref(dto = {}) {
  const prev = await obtenerConfigGeorefInterno();
  const next = { ...prev };

  if (dto.proveedor !== undefined) {
    const p = String(dto.proveedor || '').trim().toLowerCase();
    if (GEOREF_PROVEEDORES.includes(p)) next.proveedor = p;
  }
  if (dto.hereAppId !== undefined) {
    next.hereAppId = String(dto.hereAppId || '').trim();
  }
  if (dto.hereApiKey !== undefined) {
    const k = String(dto.hereApiKey || '').trim();
    if (k && !esApiKeyEnmascarada(k)) {
      next.hereApiKey = k;
    }
  }

  await Config.findOneAndUpdate({ clave: CLAVE }, { $set: next }, { upsert: true, new: true });
  invalidarCache();
  return obtenerConfigGeoref();
}

module.exports = {
  CLAVE,
  DEFAULTS,
  normalizar,
  enmascararApiKey,
  obtenerConfigGeoref,
  obtenerConfigGeorefInterno,
  actualizarConfigGeoref,
  invalidarCache,
};
