const Config = require('../models/Config');
const { models } = require('../models/catalogos');
const { ensureConfigDocument } = require('./configEnsure');

const CLAVE = 'requisitosDocumentosVehiculos';
const DEFAULT_DIAS_AVISO = 30;
const claseModel = models.claseVehiculo;
const itemDocModel = models.itemDocumentosVehiculo;

let cacheIndiceClases = null;

function slugCodigo(nombre, id) {
  const n = String(nombre || '').trim().toUpperCase();
  if (/SOAT/.test(n)) return 'SOAT';
  if (/TECNOME|REVISI/.test(n)) return 'TECNOMECANICA';
  if (/BIOMETR/.test(n)) return 'BIOMETRICO';
  if (/TRANSITO/.test(n)) return 'LIC_TRANSITO';
  if (/PROPIEDAD/.test(n)) return 'TARJ_PROP';
  if (/SERVICIO/.test(n)) return 'TARJ_SERV';
  return `DOC_${id}`;
}

function nextId(list) {
  let max = 0;
  for (const t of list || []) {
    const n = parseInt(String(t.id), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return String(max + 1);
}

function normBool(v) {
  if (v === true || v === 1 || v === '1' || v === 'true' || v === 'si' || v === 'Sí') return true;
  if (v === false || v === 0 || v === '0' || v === 'false' || v === 'no' || v === 'No') return false;
  return null;
}

function inferirControlaVencimiento(codigo, nombre) {
  const t = `${codigo || ''} ${nombre || ''}`.toUpperCase();
  if (/PROPIEDAD|TARJ_PROP|TARJETA DE PROPIEDAD/.test(t)) return false;
  if (/SERVICIO|TARJ_SERV|TARJETA DE SERVICIO/.test(t)) return false;
  return true;
}

function normalizeDiasAviso(v, fallback = DEFAULT_DIAS_AVISO) {
  const n = parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 365);
}

function normalizeTiposDocumento(raw) {
  const src = Array.isArray(raw) ? raw : [];
  const out = [];
  const usedIds = new Set();
  for (const t of src) {
    let id = String(t.id ?? '').trim();
    if (!id || usedIds.has(id)) id = nextId(out);
    usedIds.add(id);
    const codigo = String(t.codigo || slugCodigo(t.nombre, id))
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^\w]/g, '_')
      .slice(0, 40);
    out.push({
      id,
      codigo: codigo || slugCodigo(t.nombre, id),
      nombre: String(t.nombre || '').trim() || `Documento ${id}`,
      descripcion: String(t.descripcion || '').trim(),
      activo: t.activo !== false,
      controlaVencimiento:
        normBool(t.controlaVencimiento) ??
        inferirControlaVencimiento(codigo || slugCodigo(t.nombre, id), t.nombre),
      diasAvisoVencimiento:
        t.diasAvisoVencimiento != null && String(t.diasAvisoVencimiento).trim() !== ''
          ? normalizeDiasAviso(t.diasAvisoVencimiento, null)
          : null,
    });
  }
  return out;
}

function normalizeRequisitosPorClase(raw, tiposDocumento) {
  const validDocIds = new Set(tiposDocumento.map((t) => t.id));
  const src = Array.isArray(raw) ? raw : [];
  return src
    .map((r) => ({
      idClase: String(r.idClase ?? '').trim(),
      idDocumentos: [...new Set((r.idDocumentos || []).map((d) => String(d).trim()))].filter((d) =>
        validDocIds.has(d),
      ),
    }))
    .filter((r) => r.idClase);
}

async function tiposDesdeCatalogo() {
  const rows = await itemDocModel.find({}).sort({ idDocVehi: 1 }).lean();
  return rows
    .filter((r) => r.idDocVehi != null && r.idDocVehi !== '')
    .map((r) => {
      const codigo = slugCodigo(r.documentoVehi, r.idDocVehi);
      const nombre = String(r.documentoVehi || '').trim() || `Documento ${r.idDocVehi}`;
      return {
        id: String(r.idDocVehi),
        codigo,
        nombre,
        descripcion: String(r.descripcionDocVehi || '').trim(),
        activo: true,
        controlaVencimiento:
          normBool(r.controlaVencimiento) ?? inferirControlaVencimiento(codigo, nombre),
        diasAvisoVencimiento: null,
      };
    });
}

function mergeTiposConCatalogo(tiposConfig, tiposCatalogo) {
  const catalogoById = new Map((tiposCatalogo || []).map((t) => [t.id, t]));
  const vistos = new Set();
  const out = [];

  for (const t of tiposConfig || []) {
    const cat = catalogoById.get(t.id);
    vistos.add(t.id);
    out.push({
      ...(cat || {}),
      ...t,
      id: t.id,
      codigo: t.codigo || cat?.codigo || slugCodigo(t.nombre, t.id),
      nombre: cat?.nombre || t.nombre,
      descripcion: cat?.descripcion ?? t.descripcion ?? '',
      controlaVencimiento:
        normBool(t.controlaVencimiento) ??
        normBool(cat?.controlaVencimiento) ??
        inferirControlaVencimiento(t.codigo, t.nombre),
      diasAvisoVencimiento: t.diasAvisoVencimiento ?? cat?.diasAvisoVencimiento ?? null,
      activo: t.activo !== false,
    });
  }

  for (const cat of tiposCatalogo || []) {
    if (vistos.has(cat.id)) continue;
    out.push(cat);
  }

  return out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

async function syncControlaVencimientoEnCatalogo(tiposDocumento) {
  for (const t of tiposDocumento || []) {
    const id = String(t.id ?? '').trim();
    if (!id) continue;
    await itemDocModel.updateOne(
      { idDocVehi: id },
      { $set: { controlaVencimiento: t.controlaVencimiento !== false } },
    );
  }
}

async function syncControlaVencimientoDesdeCatalogo(idDocVehi, controlaVencimiento) {
  const id = String(idDocVehi ?? '').trim();
  if (!id) return;
  const found = await Config.findOne({ clave: CLAVE }).lean();
  if (!found) return;
  const tipos = normalizeTiposDocumento(found.tiposDocumento);
  const idx = tipos.findIndex((t) => t.id === id);
  if (idx < 0) return;
  tipos[idx] = { ...tipos[idx], controlaVencimiento: controlaVencimiento !== false };
  await Config.updateOne({ clave: CLAVE }, { $set: { tiposDocumento: tipos } });
}

async function buildDefaultRequisitosPorClase(tiposDocumento) {
  const clases = await claseModel.find({}).sort({ idClase: 1 }).lean();
  const allIds = tiposDocumento.map((t) => t.id);
  return clases
    .map((c) => ({
      idClase: String(c.idClase ?? '').trim(),
      idDocumentos: [...allIds],
    }))
    .filter((r) => r.idClase);
}

async function obtenerConfigRequisitosDocumentosVehiculos() {
  const tiposCatalogo = await tiposDesdeCatalogo();
  let found = await Config.findOne({ clave: CLAVE }).lean();

  if (!found) {
    const tiposDocumento = tiposCatalogo.length ? tiposCatalogo : [];
    const requisitosPorClase = tiposDocumento.length ? await buildDefaultRequisitosPorClase(tiposDocumento) : [];
    found = await ensureConfigDocument(CLAVE, {
      tiposDocumento,
      requisitosPorClase,
      diasAvisoVencimiento: DEFAULT_DIAS_AVISO,
    });
  }

  let tiposDocumento = normalizeTiposDocumento(found.tiposDocumento);
  if (!tiposDocumento.length && tiposCatalogo.length) {
    tiposDocumento = tiposCatalogo;
  } else if (tiposCatalogo.length) {
    tiposDocumento = mergeTiposConCatalogo(tiposDocumento, tiposCatalogo);
  }

  let requisitosPorClase = normalizeRequisitosPorClase(found.requisitosPorClase, tiposDocumento);
  if (!requisitosPorClase.length && tiposDocumento.length) {
    requisitosPorClase = await buildDefaultRequisitosPorClase(tiposDocumento);
  }

  return {
    clave: CLAVE,
    tiposDocumento,
    requisitosPorClase,
    diasAvisoVencimiento: normalizeDiasAviso(found.diasAvisoVencimiento, DEFAULT_DIAS_AVISO),
  };
}

async function guardarConfigRequisitosDocumentosVehiculos(body) {
  const tiposDocumento = normalizeTiposDocumento(body?.tiposDocumento);
  const requisitosPorClase = normalizeRequisitosPorClase(body?.requisitosPorClase, tiposDocumento);
  const diasAvisoVencimiento = normalizeDiasAviso(body?.diasAvisoVencimiento, DEFAULT_DIAS_AVISO);
  const dto = { clave: CLAVE, tiposDocumento, requisitosPorClase, diasAvisoVencimiento };
  const updated = await Config.findOneAndUpdate({ clave: CLAVE }, dto, { new: true, upsert: true }).lean();
  invalidarCacheClases();
  await syncControlaVencimientoEnCatalogo(tiposDocumento);
  return {
    clave: CLAVE,
    tiposDocumento: normalizeTiposDocumento(updated.tiposDocumento),
    requisitosPorClase: normalizeRequisitosPorClase(updated.requisitosPorClase, tiposDocumento),
    diasAvisoVencimiento: normalizeDiasAviso(updated.diasAvisoVencimiento, DEFAULT_DIAS_AVISO),
  };
}

function diasAvisoParaTipo(config, tipoMeta) {
  const perTipo = tipoMeta?.diasAvisoVencimiento;
  if (perTipo != null && Number(perTipo) > 0) return normalizeDiasAviso(perTipo, null);
  return normalizeDiasAviso(config?.diasAvisoVencimiento, DEFAULT_DIAS_AVISO);
}

function invalidarCacheClases() {
  cacheIndiceClases = null;
}

async function cargarIndiceClases() {
  if (cacheIndiceClases) return cacheIndiceClases;
  const rows = await claseModel.find({}).lean();
  const byId = new Map();
  const byDesc = new Map();
  const labels = new Map();

  for (const r of rows) {
    const id = String(r.idClase ?? '').trim();
    const desc = String(r.descripcion || '').trim().toUpperCase();
    const label = String(r.descripcion || id).trim();
    if (id) {
      byId.set(id, r);
      labels.set(id, label);
      const m = id.match(/^(\d+)/);
      if (m) {
        byId.set(m[1], r);
        if (!labels.has(m[1])) labels.set(m[1], label);
      }
    }
    if (desc) byDesc.set(desc, id);
  }

  cacheIndiceClases = { byId, byDesc, labels, rows };
  return cacheIndiceClases;
}

function matchIdClase(a, b) {
  const sa = String(a ?? '').trim();
  const sb = String(b ?? '').trim();
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  const na = sa.match(/^(\d+)/);
  const nb = sb.match(/^(\d+)/);
  return !!(na && nb && na[1] === nb[1]);
}

function resolverIdClaseVehiculo(vehiculo, indice) {
  const idx = indice || cacheIndiceClases;
  if (!idx) return '';

  const idRaw = vehiculo?.idClase;
  if (idRaw != null && idRaw !== '') {
    const k = String(idRaw).trim();
    if (idx.byId.has(k)) return k;
    const m = k.match(/^(\d+)/);
    if (m && idx.byId.has(m[1])) return m[1];
  }

  const desc = String(vehiculo?.claseVehiculo || '').trim().toUpperCase();
  if (desc && idx.byDesc.has(desc)) return idx.byDesc.get(desc);

  return '';
}

function findRequisitoPorClase(config, idClaseRaw, indice) {
  const idCanon = resolverIdClaseVehiculo({ idClase: idClaseRaw, claseVehiculo: '' }, indice) || String(idClaseRaw ?? '').trim();
  if (!idCanon) return null;
  return (config.requisitosPorClase || []).find((r) => matchIdClase(r.idClase, idCanon)) || null;
}

function etiquetaClase(idClase, indice) {
  const k = String(idClase ?? '').trim();
  if (indice?.labels?.has(k)) return indice.labels.get(k);
  const m = k.match(/^(\d+)/);
  if (m && indice?.labels?.has(m[1])) return indice.labels.get(m[1]);
  return k;
}

function tipoDocumentoPorId(config, id) {
  return (config.tiposDocumento || []).find((t) => t.id === String(id) && t.activo !== false);
}

module.exports = {
  CLAVE,
  DEFAULT_DIAS_AVISO,
  obtenerConfigRequisitosDocumentosVehiculos,
  guardarConfigRequisitosDocumentosVehiculos,
  normalizeTiposDocumento,
  normalizeRequisitosPorClase,
  normalizeDiasAviso,
  cargarIndiceClases,
  invalidarCacheClases,
  resolverIdClaseVehiculo,
  findRequisitoPorClase,
  matchIdClase,
  etiquetaClase,
  tipoDocumentoPorId,
  diasAvisoParaTipo,
  tiposDesdeCatalogo,
  buildDefaultRequisitosPorClase,
  mergeTiposConCatalogo,
  syncControlaVencimientoDesdeCatalogo,
};
