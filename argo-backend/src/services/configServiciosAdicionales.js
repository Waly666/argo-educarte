const { randomUUID } = require('crypto');
const Config = require('../models/Config');
const { ensureConfigDocument } = require('./configEnsure');
const { MOMENTOS, MOMENTO_MATRICULA, MOMENTO_PAGO } = require('../constants/serviciosAdicionales');
const { MODALIDADES_PROGRAMA, normalizarCodigoModalidad } = require('../constants/modalidadPrograma');
const { TARIFAS_PRESENCIAL, TARIFA_VIRTUAL } = require('../constants/tarifa');

const CLAVE = 'serviciosAdicionales';

const DEFAULTS = {
  clave: CLAVE,
  reglas: [],
};

function normalizeStringList(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    const s = String(item ?? '').trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

function normalizeModalidades(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    const c = normalizarCodigoModalidad(item);
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

function normalizeTarifas(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    const n = Number(item);
    if (n === TARIFA_VIRTUAL || TARIFAS_PRESENCIAL.includes(n)) {
      if (!out.includes(n)) out.push(n);
    }
  }
  return out.sort((a, b) => a - b);
}

function normalizePrefijosCodigo(raw) {
  return normalizeStringList(raw).map((p) => p.toUpperCase());
}

function normalizeRegla(raw, idx) {
  const id = String(raw?.id || '').trim() || randomUUID();
  const momento = MOMENTOS.includes(raw?.momento) ? raw.momento : MOMENTO_MATRICULA;
  const idServ = raw?.idServ != null && raw?.idServ !== '' ? String(raw.idServ).trim() : '';
  const idTiposPago = normalizeStringList(raw?.idTiposPago);

  if (!idServ) {
    const err = new Error(`Regla ${idx + 1}: seleccione un servicio del catálogo`);
    err.status = 400;
    throw err;
  }
  if (momento === MOMENTO_PAGO && !idTiposPago.length) {
    const err = new Error(
      `Regla ${idx + 1}: indique al menos un tipo de pago (ej. pasarela) para cobros al pagar`,
    );
    err.status = 400;
    throw err;
  }

  return {
    id,
    activo: raw?.activo !== false,
    idServ,
    momento,
    modalidades: normalizeModalidades(raw?.modalidades),
    tarifasMatricula: normalizeTarifas(raw?.tarifasMatricula),
    idTipCaps: normalizeStringList(raw?.idTipCaps),
    prefijosCodigo: normalizePrefijosCodigo(raw?.prefijosCodigo),
    idProgramas: normalizeStringList(raw?.idProgramas),
    idTiposPago,
    repartirSemestres: raw?.repartirSemestres === true,
    orden: Number.isFinite(Number(raw?.orden)) ? Number(raw.orden) : idx,
    nota: String(raw?.nota || '').trim(),
  };
}

function normalizeReglas(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((r, i) => normalizeRegla(r, i)).sort((a, b) => a.orden - b.orden);
}

function mapConfig(doc) {
  return {
    clave: CLAVE,
    reglas: normalizeReglas(doc?.reglas),
    updatedAt: doc?.updatedAt || null,
  };
}

async function obtenerConfigServiciosAdicionales() {
  const doc = await ensureConfigDocument(CLAVE, DEFAULTS);
  return mapConfig(doc);
}

async function guardarConfigServiciosAdicionales(body) {
  const reglas = normalizeReglas(body?.reglas);
  const doc = await Config.findOneAndUpdate(
    { clave: CLAVE },
    { $set: { reglas } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  const { invalidarCacheServiciosAdicionales } = require('./serviciosAdicionalesResolver');
  invalidarCacheServiciosAdicionales();
  return mapConfig(doc);
}

module.exports = {
  CLAVE,
  DEFAULTS,
  MODALIDADES_PROGRAMA,
  obtenerConfigServiciosAdicionales,
  guardarConfigServiciosAdicionales,
  normalizeReglas,
};
