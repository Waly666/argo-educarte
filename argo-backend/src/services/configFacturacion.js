const Config = require('../models/Config');
const {
  PROVEEDOR_STUB,
  PROVEEDOR_FACTUS,
  PROVEEDORES_FE,
  AMBIENTE_SANDBOX,
  AMBIENTE_PRODUCCION,
  AMBIENTES_FE,
  MODO_EMISION_MANUAL,
  MODOS_EMISION,
} = require('../constants/facturacionElectronica');

const CLAVE = 'facturacion';

const DEFAULTS = {
  clave: CLAVE,
  proveedor: PROVEEDOR_STUB,
  ambiente: AMBIENTE_SANDBOX,
  baseUrl: '',
  clientId: '',
  clientSecret: '',
  username: '',
  password: '',
  numberingRangeId: null,
  modoEmision: MODO_EMISION_MANUAL,
  /** El valor de la liquidación incluye IVA (se desglosa). */
  valorIncluyeIva: true,
  sendEmail: true,
  activo: false,

  /** Datos fiscales del emisor (tu CEA). */
  emisorNit: '',
  emisorDv: '',
  emisorRazonSocial: '',
  emisorResponsabilidadFiscal: 'R-99-PN',
  emisorRegimen: 'No responsable de IVA',
  emisorActividadEconomica: '',
  emisorMunicipioCodigo: '',
  /** % IVA por defecto para servicios gravados sin IVA configurado. */
  ivaPorDefecto: 19,
  /** Prefijo de numeración local en modo desarrollo. */
  prefijoDesarrollo: 'DEV',
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

function normalizar(doc) {
  const raw = { ...DEFAULTS, ...(doc || {}), clave: CLAVE };
  const prov = String(raw.proveedor || PROVEEDOR_STUB).trim().toLowerCase();
  raw.proveedor = PROVEEDORES_FE.includes(prov) ? prov : PROVEEDOR_STUB;
  const amb = String(raw.ambiente || AMBIENTE_SANDBOX).trim().toLowerCase();
  raw.ambiente = AMBIENTES_FE.includes(amb) ? amb : AMBIENTE_SANDBOX;
  const modo = String(raw.modoEmision || MODO_EMISION_MANUAL).trim();
  raw.modoEmision = MODOS_EMISION.includes(modo) ? modo : MODO_EMISION_MANUAL;
  raw.baseUrl = String(raw.baseUrl || '').trim();
  raw.clientId = String(raw.clientId || '').trim();
  raw.clientSecret = String(raw.clientSecret || '').trim();
  raw.username = String(raw.username || '').trim();
  raw.password = String(raw.password || '').trim();
  raw.numberingRangeId =
    raw.numberingRangeId != null && raw.numberingRangeId !== ''
      ? Number(raw.numberingRangeId) || null
      : null;
  raw.valorIncluyeIva = raw.valorIncluyeIva !== false;
  raw.sendEmail = raw.sendEmail !== false;
  raw.activo = raw.activo === true;
  raw.emisorNit = String(raw.emisorNit || '').trim();
  raw.emisorDv = String(raw.emisorDv || '').trim();
  raw.emisorRazonSocial = String(raw.emisorRazonSocial || '').trim();
  raw.emisorResponsabilidadFiscal = String(raw.emisorResponsabilidadFiscal || 'R-99-PN').trim();
  raw.emisorRegimen = String(raw.emisorRegimen || '').trim();
  raw.emisorActividadEconomica = String(raw.emisorActividadEconomica || '').trim();
  raw.emisorMunicipioCodigo = String(raw.emisorMunicipioCodigo || '').trim();
  raw.ivaPorDefecto = Number(raw.ivaPorDefecto) || 0;
  raw.prefijoDesarrollo = String(raw.prefijoDesarrollo || 'DEV').trim() || 'DEV';
  return raw;
}

function baseUrlPorAmbiente(ambiente, baseUrlOverride) {
  const custom = String(baseUrlOverride || '').trim();
  if (custom) return custom.replace(/\/$/, '');
  return ambiente === AMBIENTE_PRODUCCION
    ? 'https://api.factus.com.co'
    : 'https://api-sandbox.factus.com.co';
}

function credencialesCompletas(cfg) {
  if (cfg.proveedor === PROVEEDOR_STUB) return true;
  return !!(cfg.clientId && cfg.clientSecret && cfg.username && cfg.password);
}

function serializarParaApi(doc) {
  const raw = normalizar(doc);
  const credencialesOk = credencialesCompletas(raw);
  return {
    proveedor: raw.proveedor,
    ambiente: raw.ambiente,
    baseUrl: baseUrlPorAmbiente(raw.ambiente, raw.baseUrl),
    clientId: raw.clientId,
    clientSecretEnmascarado: enmascararSecreto(raw.clientSecret),
    secretConfigurado: !!raw.clientSecret,
    username: raw.username,
    passwordEnmascarado: enmascararSecreto(raw.password),
    passwordConfigurado: !!raw.password,
    numberingRangeId: raw.numberingRangeId,
    modoEmision: raw.modoEmision,
    valorIncluyeIva: raw.valorIncluyeIva,
    sendEmail: raw.sendEmail,
    activo: raw.activo,
    emisorNit: raw.emisorNit,
    emisorDv: raw.emisorDv,
    emisorRazonSocial: raw.emisorRazonSocial,
    emisorResponsabilidadFiscal: raw.emisorResponsabilidadFiscal,
    emisorRegimen: raw.emisorRegimen,
    emisorActividadEconomica: raw.emisorActividadEconomica,
    emisorMunicipioCodigo: raw.emisorMunicipioCodigo,
    ivaPorDefecto: raw.ivaPorDefecto,
    prefijoDesarrollo: raw.prefijoDesarrollo,
    credencialesCompletas: credencialesOk,
    listoParaFactus: raw.proveedor === PROVEEDOR_FACTUS && raw.activo && credencialesOk,
    _actualizadoEn: doc?.updatedAt || null,
  };
}

async function obtenerConfigFacturacionInterno() {
  const doc = await Config.findOne({ clave: CLAVE }).lean();
  return normalizar(doc || DEFAULTS);
}

async function obtenerConfigFacturacion() {
  const doc = await Config.findOne({ clave: CLAVE }).lean();
  return serializarParaApi(doc || DEFAULTS);
}

async function actualizarConfigFacturacion(dto = {}) {
  const prev = await obtenerConfigFacturacionInterno();
  const next = { ...prev };

  if (dto.proveedor !== undefined) {
    const p = String(dto.proveedor || '').trim().toLowerCase();
    if (PROVEEDORES_FE.includes(p)) next.proveedor = p;
  }
  if (dto.ambiente !== undefined) {
    const a = String(dto.ambiente || '').trim().toLowerCase();
    if (AMBIENTES_FE.includes(a)) next.ambiente = a;
  }
  if (dto.baseUrl !== undefined) next.baseUrl = String(dto.baseUrl || '').trim();
  if (dto.clientId !== undefined) next.clientId = String(dto.clientId || '').trim();
  if (dto.clientSecret !== undefined && !esSecretoEnmascarado(dto.clientSecret)) {
    next.clientSecret = String(dto.clientSecret || '').trim();
  }
  if (dto.username !== undefined) next.username = String(dto.username || '').trim();
  if (dto.password !== undefined && !esSecretoEnmascarado(dto.password)) {
    next.password = String(dto.password || '').trim();
  }
  if (dto.numberingRangeId !== undefined) {
    next.numberingRangeId =
      dto.numberingRangeId != null && dto.numberingRangeId !== ''
        ? Number(dto.numberingRangeId) || null
        : null;
  }
  if (dto.modoEmision !== undefined) {
    const m = String(dto.modoEmision || '').trim();
    if (MODOS_EMISION.includes(m)) next.modoEmision = m;
  }
  if (dto.valorIncluyeIva !== undefined) next.valorIncluyeIva = dto.valorIncluyeIva !== false;
  if (dto.sendEmail !== undefined) next.sendEmail = dto.sendEmail !== false;
  if (dto.activo !== undefined) next.activo = dto.activo === true;
  for (const k of [
    'emisorNit',
    'emisorDv',
    'emisorRazonSocial',
    'emisorResponsabilidadFiscal',
    'emisorRegimen',
    'emisorActividadEconomica',
    'emisorMunicipioCodigo',
    'prefijoDesarrollo',
  ]) {
    if (dto[k] !== undefined) next[k] = String(dto[k] || '').trim();
  }
  if (dto.ivaPorDefecto !== undefined) next.ivaPorDefecto = Number(dto.ivaPorDefecto) || 0;

  await Config.findOneAndUpdate(
    { clave: CLAVE },
    { $set: { ...next, clave: CLAVE } },
    { upsert: true, new: true },
  );
  return obtenerConfigFacturacion();
}

/** Credenciales efectivas: BD + variables de entorno (env tiene prioridad si está definido). */
async function credencialesEfectivas() {
  const cfg = await obtenerConfigFacturacionInterno();
  return {
    ...cfg,
    baseUrl: baseUrlPorAmbiente(
      process.env.FACTUS_AMBIENTE || cfg.ambiente,
      process.env.FACTUS_BASE_URL || cfg.baseUrl,
    ),
    clientId: process.env.FACTUS_CLIENT_ID || cfg.clientId,
    clientSecret: process.env.FACTUS_CLIENT_SECRET || cfg.clientSecret,
    username: process.env.FACTUS_USERNAME || cfg.username,
    password: process.env.FACTUS_PASSWORD || cfg.password,
    numberingRangeId:
      process.env.FACTUS_NUMBERING_RANGE_ID != null &&
      process.env.FACTUS_NUMBERING_RANGE_ID !== ''
        ? Number(process.env.FACTUS_NUMBERING_RANGE_ID) || cfg.numberingRangeId
        : cfg.numberingRangeId,
    proveedor: process.env.FACTUS_PROVEEDOR || cfg.proveedor,
    ambiente: process.env.FACTUS_AMBIENTE || cfg.ambiente,
  };
}

module.exports = {
  CLAVE,
  DEFAULTS,
  normalizar,
  serializarParaApi,
  credencialesCompletas,
  baseUrlPorAmbiente,
  obtenerConfigFacturacion,
  obtenerConfigFacturacionInterno,
  actualizarConfigFacturacion,
  credencialesEfectivas,
};
