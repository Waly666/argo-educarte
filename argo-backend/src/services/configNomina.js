const Config = require('../models/Config');
const DEFAULTS = require('../config/nominaConfig');

const CLAVE = 'nomina';

let cache = null;

const SCALAR_KEYS = [
  'vigenciaAno',
  'vigenciaLabel',
  'smlmv',
  'uvt',
  'auxilioTransporteMensual',
  'saludEmpleadoPct',
  'pensionEmpleadoPct',
  'saludEmpleadorPct',
  'pensionEmpleadorPct',
  'senaPct',
  'icbfPct',
  'ccfPct',
  'arlRiesgoDefault',
  'multiploSalarioAuxilio',
  'retencionUmbralExentoSmmlv',
  'provisionCesantiasPct',
  'provisionPrimaPct',
  'provisionVacacionesPct',
  'provisionIntCesantiasPct',
];

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeInfinity(val, sentinel = 99999) {
  if (val === null || val === undefined || val === '' || val === 'Infinity') return Infinity;
  if (typeof val === 'string' && val.trim() === '') return Infinity;
  const n = Number(val);
  if (!Number.isFinite(n) || n >= sentinel) return Infinity;
  return n;
}

function normalize(doc) {
  const d = { ...DEFAULTS, ...doc, clave: CLAVE };
  d.smlmv = Math.max(0, Math.round(num(d.smlmv, DEFAULTS.smlmv)));
  d.uvt = Math.max(0, Math.round(num(d.uvt, DEFAULTS.uvt)));
  d.auxilioTransporteMensual = Math.max(0, Math.round(num(d.auxilioTransporteMensual, DEFAULTS.auxilioTransporteMensual)));

  for (const k of [
    'saludEmpleadoPct',
    'pensionEmpleadoPct',
    'saludEmpleadorPct',
    'pensionEmpleadorPct',
    'senaPct',
    'icbfPct',
    'ccfPct',
    'provisionCesantiasPct',
    'provisionPrimaPct',
    'provisionVacacionesPct',
    'provisionIntCesantiasPct',
  ]) {
    d[k] = Math.max(0, num(d[k], DEFAULTS[k]));
  }

  d.arlRiesgoDefault = Math.min(5, Math.max(1, Math.round(num(d.arlRiesgoDefault, 1))));
  d.multiploSalarioAuxilio = Math.max(0, num(d.multiploSalarioAuxilio, DEFAULTS.multiploSalarioAuxilio));
  d.retencionUmbralExentoSmmlv = Math.max(0, num(d.retencionUmbralExentoSmmlv, DEFAULTS.retencionUmbralExentoSmmlv));

  const arl = { ...DEFAULTS.arlRiesgoPct, ...(d.arlRiesgoPct || {}) };
  for (let i = 1; i <= 5; i += 1) {
    arl[i] = Math.max(0, num(arl[i] ?? arl[String(i)], DEFAULTS.arlRiesgoPct[i]));
  }
  d.arlRiesgoPct = arl;

  d.fspTramos = (d.fspTramos || DEFAULTS.fspTramos).map((t) => ({
    desdeSmmlv: num(t.desdeSmmlv, 0),
    hastaSmmlv: normalizeInfinity(t.hastaSmmlv),
    pct: Math.max(0, num(t.pct, 0)),
  }));

  d.retencionTramos = (d.retencionTramos || DEFAULTS.retencionTramos).map((t) => ({
    hastaUvt: normalizeInfinity(t.hastaUvt, 999999),
    baseUvt: num(t.baseUvt, 0),
    pct: Math.max(0, num(t.pct, 0)),
  }));

  if (!d.vigenciaAno) d.vigenciaAno = new Date().getFullYear();
  if (!d.vigenciaLabel) d.vigenciaLabel = String(d.vigenciaAno);

  d.tiposDevengo = d.tiposDevengo || DEFAULTS.tiposDevengo;
  d.tiposDeduccion = d.tiposDeduccion || DEFAULTS.tiposDeduccion;
  d.codigosExcluidosIbc = d.codigosExcluidosIbc || DEFAULTS.codigosExcluidosIbc;
  d.codigosPila = d.codigosPila || DEFAULTS.codigosPila;

  return d;
}

function mergeStored(found) {
  if (!found) return normalize({ ...DEFAULTS });
  const { _id, __v, createdAt, updatedAt, ...rest } = found;
  return normalize({ ...DEFAULTS, ...rest });
}

async function obtenerConfigNomina(force = false) {
  if (cache && !force) return cache;
  const found = await Config.findOne({ clave: CLAVE }).lean();
  cache = mergeStored(found);
  return cache;
}

function getConfigSync() {
  return cache || normalize({ ...DEFAULTS });
}

function invalidateCache() {
  cache = null;
}

function pickDto(body) {
  const dto = {};
  for (const k of SCALAR_KEYS) {
    if (body[k] !== undefined) dto[k] = body[k];
  }
  if (body.arlRiesgoPct !== undefined) dto.arlRiesgoPct = body.arlRiesgoPct;
  if (body.fspTramos !== undefined) dto.fspTramos = body.fspTramos;
  if (body.retencionTramos !== undefined) dto.retencionTramos = body.retencionTramos;
  return dto;
}

async function actualizarConfigNomina(body, user = 'admin') {
  const actual = await obtenerConfigNomina(true);
  const merged = normalize({ ...actual, ...pickDto(body) });
  const now = new Date();
  await Config.findOneAndUpdate(
    { clave: CLAVE },
    {
      $set: {
        ...merged,
        clave: CLAVE,
        updatedAt: now,
        userChangeRecord: user,
      },
      $setOnInsert: { createdAt: now, userAddReg: user },
    },
    { upsert: true },
  );
  invalidateCache();
  return obtenerConfigNomina(true);
}

async function restaurarConfigNominaDefaults(user = 'admin') {
  const merged = normalize({ ...DEFAULTS });
  const now = new Date();
  await Config.findOneAndUpdate(
    { clave: CLAVE },
    { $set: { ...merged, clave: CLAVE, updatedAt: now, userChangeRecord: user } },
    { upsert: true },
  );
  invalidateCache();
  return obtenerConfigNomina(true);
}

async function initConfigNomina() {
  await obtenerConfigNomina(true);
}

/** Respuesta API: Infinity → null para JSON */
function serializarParaApi(cfg) {
  const out = { ...cfg };
  out.fspTramos = (out.fspTramos || []).map((t) => ({
    ...t,
    hastaSmmlv: t.hastaSmmlv === Infinity ? null : t.hastaSmmlv,
  }));
  out.retencionTramos = (out.retencionTramos || []).map((t) => ({
    ...t,
    hastaUvt: t.hastaUvt === Infinity ? null : t.hastaUvt,
  }));
  return out;
}

module.exports = {
  CLAVE,
  DEFAULTS,
  SCALAR_KEYS,
  obtenerConfigNomina,
  getConfigSync,
  actualizarConfigNomina,
  restaurarConfigNominaDefaults,
  initConfigNomina,
  invalidateCache,
  serializarParaApi,
};
