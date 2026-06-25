const Config = require('../models/Config');
const { models: cat } = require('../models/catalogos');
const { ensureConfigDocument } = require('./configEnsure');
const {
  TIPO_PAGO_EN_LINEA,
  TIPO_PAGO_EN_LINEA_ID,
  WOMPI_SANDBOX_API,
  WOMPI_PROD_API,
} = require('../constants/pasarela');

const CLAVE = 'pasarela_wompi';

const DEFAULTS = {
  clave: CLAVE,
  activo: false,
  ambiente: 'sandbox',
  publicKey: '',
  privateKey: '',
  integritySecret: '',
  eventsSecret: '',
  idSedeVirtual: '',
  idCuentaBancaria: '',
  idTipoPago: TIPO_PAGO_EN_LINEA,
  redirectUrlBase: '',
  webhookUrl: '',
};

function enmascararSecreto(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (s.length <= 4) return '••••';
  return `${'•'.repeat(Math.min(s.length - 4, 16))}${s.slice(-4)}`;
}

function esSecretoEnmascarado(v) {
  const s = String(v || '').trim();
  return !s || s.includes('•');
}

function inferirAmbienteDesdeLlavePublica(publicKey) {
  const k = String(publicKey || '').trim();
  if (k.startsWith('pub_prod_')) return 'production';
  if (k.startsWith('pub_test_')) return 'sandbox';
  return null;
}

function normalizar(doc) {
  const raw = { ...DEFAULTS, ...(doc || {}), clave: CLAVE };
  raw.activo = raw.activo === true;
  const amb = String(raw.ambiente || 'sandbox').trim().toLowerCase();
  raw.ambiente = amb === 'production' ? 'production' : 'sandbox';
  const inferido = inferirAmbienteDesdeLlavePublica(raw.publicKey);
  if (inferido) raw.ambiente = inferido;
  raw.publicKey = String(raw.publicKey || '').trim();
  raw.privateKey = String(raw.privateKey || '').trim();
  raw.integritySecret = String(raw.integritySecret || '').trim();
  raw.eventsSecret = String(raw.eventsSecret || '').trim();
  raw.idSedeVirtual = String(raw.idSedeVirtual || '').trim();
  raw.idCuentaBancaria = String(raw.idCuentaBancaria || '').trim();
  raw.idTipoPago = String(raw.idTipoPago || TIPO_PAGO_EN_LINEA).trim() || TIPO_PAGO_EN_LINEA;
  raw.redirectUrlBase = String(raw.redirectUrlBase || '').trim();
  raw.webhookUrl = String(raw.webhookUrl || '').trim();
  return raw;
}

function mapPublico(doc) {
  const n = normalizar(doc);
  return {
    clave: CLAVE,
    activo: n.activo,
    ambiente: n.ambiente,
    publicKey: n.publicKey,
    privateKey: enmascararSecreto(n.privateKey),
    integritySecret: enmascararSecreto(n.integritySecret),
    eventsSecret: enmascararSecreto(n.eventsSecret),
    idSedeVirtual: n.idSedeVirtual,
    idCuentaBancaria: n.idCuentaBancaria,
    idTipoPago: n.idTipoPago,
    idTipoPagoEnLinea: TIPO_PAGO_EN_LINEA_ID,
    redirectUrlBase: n.redirectUrlBase,
    webhookUrl: n.webhookUrl,
    updatedAt: doc?.updatedAt || null,
  };
}

async function obtenerConfigPasarela({ incluirSecretos = false } = {}) {
  const doc = await Config.findOne({ clave: CLAVE }).lean();
  if (!doc) {
    const base = normalizar(null);
    return incluirSecretos ? base : mapPublico(base);
  }
  const n = normalizar(doc);
  if (incluirSecretos) return n;
  return mapPublico(doc);
}

async function asegurarTipoPagoEnLinea() {
  const id = TIPO_PAGO_EN_LINEA_ID;
  const codigo = TIPO_PAGO_EN_LINEA;
  const exists = await cat.catTipoPago.findOne({
    $or: [{ idTipoPago: id }, { codigo }, { idTipoPago: codigo }],
  }).lean();
  if (exists) return;
  await cat.catTipoPago.updateOne(
    { idTipoPago: id },
    { $set: { idTipoPago: id, codigo, descripcion: 'Pago en línea' } },
    { upsert: true },
  );
}

async function guardarConfigPasarela(body, { mergeSecretos = true } = {}) {
  const prev = mergeSecretos ? normalizar(await Config.findOne({ clave: CLAVE }).lean()) : null;
  const next = normalizar(body);
  if (mergeSecretos && prev) {
    if (esSecretoEnmascarado(body?.privateKey)) next.privateKey = prev.privateKey;
    if (esSecretoEnmascarado(body?.integritySecret)) next.integritySecret = prev.integritySecret;
    if (esSecretoEnmascarado(body?.eventsSecret)) next.eventsSecret = prev.eventsSecret;
  }
  await ensureConfigDocument(CLAVE, DEFAULTS);
  await asegurarTipoPagoEnLinea();
  const updated = await Config.findOneAndUpdate(
    { clave: CLAVE },
    { $set: next },
    { new: true, upsert: true },
  ).lean();
  return mapPublico(updated);
}

function wompiApiBase(cfg) {
  return cfg?.ambiente === 'production' ? WOMPI_PROD_API : WOMPI_SANDBOX_API;
}

async function assertPasarelaActiva() {
  const cfg = await obtenerConfigPasarela({ incluirSecretos: true });
  if (!cfg.activo) {
    const err = new Error('La pasarela de pagos en línea no está activa.');
    err.status = 503;
    err.code = 'PASARELA_INACTIVA';
    throw err;
  }
  if (
    !cfg.publicKey
    || !cfg.integritySecret
    || !cfg.eventsSecret
    || !cfg.idSedeVirtual
    || !cfg.idCuentaBancaria
  ) {
    const err = new Error(
      'Configure la pasarela Wompi (llaves, secretos, sede virtual y cuenta destino).',
    );
    err.status = 503;
    err.code = 'PASARELA_INCOMPLETA';
    throw err;
  }
  return cfg;
}

module.exports = {
  CLAVE,
  DEFAULTS,
  TIPO_PAGO_EN_LINEA,
  TIPO_PAGO_EN_LINEA_ID,
  obtenerConfigPasarela,
  guardarConfigPasarela,
  wompiApiBase,
  assertPasarelaActiva,
  mapPublico,
  inferirAmbienteDesdeLlavePublica,
};
