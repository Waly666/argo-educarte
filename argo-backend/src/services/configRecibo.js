const Config = require('../models/Config');
const Sede = require('../models/Sede');
const { normalizarFormatoComprobante, FORMATOS } = require('./comprobanteFormato');
const { uploadFileToDataUrl } = require('../utils/uploadPublicUrl');

/** Logo institucional: portal (aula_virtual) primero; si no hay, Config → Recibos. */
async function resolverUrlLogoRelativa(urlLogoRecibo) {
  try {
    const aula = await Config.findOne({ clave: 'aula_virtual' }).lean();
    const aulaLogo = String(aula?.urlLogo || '').trim();
    if (aulaLogo) return aulaLogo;
  } catch {
    /* ignore */
  }
  return String(urlLogoRecibo || '').trim();
}

const CLAVE = 'recibo';

const DEFAULTS = {
  clave: CLAVE,
  nombreEmpresa: 'ARGO — Centro de Formación en Conducción',
  nit: '',
  direccion: '',
  ciudad: '',
  telefono: '',
  email: '',
  urlLogo: '',
  prefijoFactura: 'FV',
  consecutivoFactura: 0,
  prefijoComprobanteIngreso: 'CI',
  consecutivoComprobanteIngreso: 0,
  usarPrefijoComprobanteIngreso: true,
  usarSegundoPrefijoComprobanteIngreso: false,
  segundoPrefijoComprobanteIngreso: String(new Date().getFullYear()),
  prefijoComprobanteEgreso: 'CE',
  consecutivoComprobanteEgreso: 0,
  usarPrefijoComprobanteEgreso: true,
  usarSegundoPrefijoComprobanteEgreso: false,
  segundoPrefijoComprobanteEgreso: String(new Date().getFullYear()),
  slogan1: '',
  mensajeEncabezado: 'COMPROBANTE DE INGRESO',
  mensajeEncabezadoEgreso: 'COMPROBANTE DE EGRESO',
  mensajePie:
    'Documento soporte de pago. No sustituye factura electrónica. Conserve este comprobante.',
  mensajePieEgreso:
    'Constancia de egreso. El beneficiario debe firmar este recibo o adjuntar factura/voucher como soporte del pago.',
  mensajeCreacionAlumnoTitulo: '¡Alumno registrado!',
  mensajeCreacionAlumno:
    'Se registró correctamente a {nombre} con documento {numDoc}.\n\nBienvenido(a) a {empresa}.{slogan}',
  anchoReciboMm: 80,
  mostrarQr: true,
  formatoComprobanteIngreso: FORMATOS.VALIDADORA,
  formatoComprobanteEgreso: FORMATOS.VALIDADORA,
  /** Rebaja de valor al crear matrícula (ficha alumno → Servicios). */
  permitirAjusteValorMatricula: true,
  /** Cuotas personalizadas por semestre (presencial/mixta; no virtual). */
  permitirAjusteCuotasSemestre: false,
};

/** Clave legado por sede (solo scripts/migración; ya no se usa en runtime). */
function claveRecibo(idSede) {
  const sid = String(idSede || '').trim();
  return sid ? `${CLAVE}:${sid}` : CLAVE;
}

function normalizar(doc, claveOverride) {
  const raw = { ...DEFAULTS, ...doc, clave: claveOverride || doc?.clave || CLAVE };
  if (doc?.prefijoRecibo != null && doc.prefijoFactura == null) {
    raw.prefijoFactura = String(doc.prefijoRecibo).trim() || DEFAULTS.prefijoFactura;
  }
  if (doc?.consecutivoRecibo != null && doc.consecutivoFactura == null) {
    raw.consecutivoFactura = Number(doc.consecutivoRecibo) || 0;
  }
  const enc = String(raw.mensajeEncabezado || '').trim().toUpperCase();
  if (enc === 'COMPROBANTE DE EGRESO' || enc.includes('EGRESO')) {
    raw.mensajeEncabezado = 'COMPROBANTE DE INGRESO';
  }
  raw.formatoComprobanteIngreso = normalizarFormatoComprobante(
    raw.formatoComprobanteIngreso,
    FORMATOS.VALIDADORA,
  );
  raw.formatoComprobanteEgreso = normalizarFormatoComprobante(
    raw.formatoComprobanteEgreso,
    FORMATOS.VALIDADORA,
  );
  raw.usarSegundoPrefijoComprobanteIngreso = !!raw.usarSegundoPrefijoComprobanteIngreso;
  raw.usarSegundoPrefijoComprobanteEgreso = !!raw.usarSegundoPrefijoComprobanteEgreso;
  raw.usarPrefijoComprobanteIngreso = raw.usarPrefijoComprobanteIngreso !== false;
  raw.usarPrefijoComprobanteEgreso = raw.usarPrefijoComprobanteEgreso !== false;
  const anio = String(new Date().getFullYear());
  if (!String(raw.segundoPrefijoComprobanteIngreso || '').trim()) {
    raw.segundoPrefijoComprobanteIngreso = anio;
  }
  if (!String(raw.segundoPrefijoComprobanteEgreso || '').trim()) {
    raw.segundoPrefijoComprobanteEgreso = anio;
  }
  raw.permitirAjusteValorMatricula = raw.permitirAjusteValorMatricula !== false;
  raw.permitirAjusteCuotasSemestre = raw.permitirAjusteCuotasSemestre === true;
  return raw;
}

function armarCodigoComprobante(
  doc,
  prefijoField,
  usarSegundoField,
  segundoPrefijoField,
  n,
  usarPrefijoField = null,
) {
  const partes = [];
  const usarPrimero = usarPrefijoField ? doc[usarPrefijoField] !== false : true;
  if (usarPrimero) {
    const pref = String(doc[prefijoField] || '').trim() || 'DOC';
    partes.push(pref);
  }
  if (doc[usarSegundoField]) {
    const seg =
      String(doc[segundoPrefijoField] || '').trim() || String(new Date().getFullYear());
    partes.push(seg);
  }
  const num = String(n).padStart(6, '0');
  return partes.length ? `${partes.join('-')}-${num}` : num;
}

/** Datos operativos de la sede en comprobantes (no duplica config en Mongo). */
function pickEncabezado(globalVal, sedeVal) {
  const g = String(globalVal ?? '').trim();
  if (g) return g;
  return String(sedeVal ?? '').trim();
}

function aplicarEncabezadoSede(config, sede) {
  if (!sede) return { ...config };
  return {
    ...config,
    nombreSede: String(sede.nombre || config.nombreSede || '').trim(),
    telefono: pickEncabezado(config.telefono, sede.telefono),
    direccion: pickEncabezado(config.direccion, sede.direccion),
    ciudad: pickEncabezado(config.ciudad, sede.ciudad),
    departamento: pickEncabezado(config.departamento, sede.departamento),
    idSede: sede.idSede || config.idSede || null,
  };
}

async function asegurarGlobalRecibo() {
  let doc = await Config.findOne({ clave: CLAVE }).lean();
  if (!doc) {
    doc = (await Config.create({ ...DEFAULTS, clave: CLAVE })).toObject();
  }
  return normalizar(doc, CLAVE);
}

async function cargarGlobalRecibo() {
  const doc = await Config.findOne({ clave: CLAVE }).lean();
  return doc ? normalizar(doc, CLAVE) : { ...DEFAULTS };
}

/**
 * Config de recibos: siempre global (clave `recibo`).
 * Si se pasa idSede, se añade el nombre de la sede al imprimir.
 * Dirección, ciudad, teléfono y departamento: primero la config global;
 * solo si están vacíos allí se toman de la sede.
 */
async function obtenerConfigRecibo(idSede = null) {
  const global = await asegurarGlobalRecibo();
  const urlLogoRel = await resolverUrlLogoRelativa(global.urlLogo);
  const urlLogoDataUrl = urlLogoRel ? uploadFileToDataUrl(urlLogoRel) : null;
  const conLogo = { ...global, urlLogo: urlLogoRel, urlLogoDataUrl: urlLogoDataUrl || null };
  const sid = String(idSede || '').trim();
  if (!sid) return conLogo;
  const sede = await Sede.findOne({ idSede: sid }).lean();
  return aplicarEncabezadoSede(conLogo, sede);
}

/** Compatibilidad: encabezados de sede se leen del catálogo Sede, no de config por sede. */
async function sincronizarEncabezadoReciboDesdeSede(_idSede) {
  await asegurarGlobalRecibo();
}

async function reservarConsecutivo(
  campoConsecutivo,
  prefijo,
  usarSegundo,
  segundoPrefijo,
  usarPrefijo,
) {
  let doc = await Config.findOne({ clave: CLAVE });
  if (!doc) {
    doc = await Config.create({ ...DEFAULTS, clave: CLAVE, [campoConsecutivo]: 1 });
  } else {
    doc[campoConsecutivo] = (doc[campoConsecutivo] || 0) + 1;
    await doc.save();
  }
  const n = doc[campoConsecutivo] || 1;
  return armarCodigoComprobante(doc, prefijo, usarSegundo, segundoPrefijo, n, usarPrefijo);
}

async function siguienteNumComprobanteIngreso(_idSede = null) {
  await asegurarGlobalRecibo();
  return reservarConsecutivo(
    'consecutivoComprobanteIngreso',
    'prefijoComprobanteIngreso',
    'usarSegundoPrefijoComprobanteIngreso',
    'segundoPrefijoComprobanteIngreso',
    'usarPrefijoComprobanteIngreso',
  );
}

async function siguienteNumComprobanteEgreso(_idSede = null) {
  await asegurarGlobalRecibo();
  return reservarConsecutivo(
    'consecutivoComprobanteEgreso',
    'prefijoComprobanteEgreso',
    'usarSegundoPrefijoComprobanteEgreso',
    'segundoPrefijoComprobanteEgreso',
    'usarPrefijoComprobanteEgreso',
  );
}

async function siguienteNumFactura(_idSede = null) {
  await asegurarGlobalRecibo();
  return reservarConsecutivo('consecutivoFactura', 'prefijoFactura');
}

async function siguienteNumRecibo(idSede = null) {
  return siguienteNumComprobanteIngreso(idSede);
}

module.exports = {
  CLAVE,
  DEFAULTS,
  claveRecibo,
  normalizar,
  aplicarEncabezadoSede,
  obtenerConfigRecibo,
  sincronizarEncabezadoReciboDesdeSede,
  armarCodigoComprobante,
  siguienteNumComprobanteIngreso,
  siguienteNumComprobanteEgreso,
  siguienteNumFactura,
  siguienteNumRecibo,
};
