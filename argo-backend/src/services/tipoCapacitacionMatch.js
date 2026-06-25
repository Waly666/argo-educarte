const { models: cat } = require('../models/catalogos');

let indiceCache = null;
let indiceCargadoEn = 0;
const TTL_MS = 60_000;

function normalizarTextoCap(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Índice catTipoCapacitacion: id numérico, etiquetas y alias de programas legacy.
 */
async function cargarIndiceTipCap() {
  const now = Date.now();
  if (indiceCache && now - indiceCargadoEn < TTL_MS) return indiceCache;

  const rows = await cat.catTipoCapacitacion.find({}).lean();
  const byCanon = new Map();
  const byLabel = new Map();

  for (const r of rows) {
    const idRaw = r.idTipCap ?? r.id;
    if (idRaw == null || idRaw === '') continue;
    const idStr = String(idRaw).trim();
    const canon = idStr.match(/^(\d+)/) ? idStr.match(/^(\d+)/)[1] : idStr;
    const label = String(r.tipoCap || r.descripcion || r.nombre || '').trim();

    byCanon.set(idStr, canon);
    byCanon.set(canon, canon);
    if (label) {
      byLabel.set(normalizarTextoCap(label), canon);
    }
    if (!/^\d+$/.test(idStr)) {
      byLabel.set(normalizarTextoCap(idStr), canon);
    }
  }

  indiceCache = { rows, byCanon, byLabel, normalizarTextoCap };
  indiceCargadoEn = now;
  return indiceCache;
}

function resolverIdTipCapCanonico(idTipCap, indice) {
  const raw = String(idTipCap ?? '').trim();
  if (!raw) return '';

  if (indice.byCanon.has(raw)) return indice.byCanon.get(raw);

  const pref = raw.match(/^(\d+)/);
  if (pref && indice.byCanon.has(pref[1])) return indice.byCanon.get(pref[1]);

  const norm = indice.normalizarTextoCap(raw);
  if (indice.byLabel.has(norm)) return indice.byLabel.get(norm);

  for (const r of indice.rows) {
    const label = String(r.tipoCap || r.descripcion || r.nombre || '').trim();
    if (!label) continue;
    const nl = indice.normalizarTextoCap(label);
    if (norm === nl) {
      const idRaw = r.idTipCap ?? r.id;
      const idStr = String(idRaw).trim();
      return idStr.match(/^(\d+)/) ? idStr.match(/^(\d+)/)[1] : idStr;
    }
  }

  return pref ? pref[1] : raw;
}

function idsTipCapIguales(a, b) {
  const sa = String(a ?? '').trim();
  const sb = String(b ?? '').trim();
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  const na = Number(sa);
  const nb = Number(sb);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

function filaCatalogoPorIdTipCap(filtroId, indice) {
  const f = String(filtroId ?? '').trim();
  if (!f) return null;
  return indice.rows.find((r) => idsTipCapIguales(r.idTipCap ?? r.id, f)) || null;
}

function etiquetasTipCapEquivalentes(almacenado, etiquetaCatalogo, indice) {
  const fs = String(almacenado ?? '').trim();
  const et = String(etiquetaCatalogo ?? '').trim();
  if (!fs || !et) return false;
  const norm = indice.normalizarTextoCap;
  if (norm(fs) === norm(et)) return true;
  const sinPref = et.replace(/^\d+\)\s*/, '').trim();
  return !!(sinPref && norm(fs) === norm(sinPref));
}

/** Coincidencia estricta: campo idTipCap del programa vs valor del catálogo (sin prefijo numérico fuzzy). */
function programaCoincideIdTipCap(prog, filtroId, indice) {
  const f = String(filtroId ?? '').trim();
  if (!f) return true;
  const almacenado = prog?.idTipCap;
  if (almacenado == null || almacenado === '') return false;
  if (idsTipCapIguales(almacenado, f)) return true;

  const fila = filaCatalogoPorIdTipCap(f, indice);
  if (!fila) return false;
  const etiqueta = String(fila.tipoCap || fila.descripcion || fila.nombre || '').trim();
  return etiquetasTipCapEquivalentes(almacenado, etiqueta, indice);
}

function filaCatalogoPorValorTipCap(valor, indice) {
  const v = String(valor ?? '').trim();
  if (!v) return null;
  const directa = indice.rows.find((r) => idsTipCapIguales(r.idTipCap ?? r.id, v));
  if (directa) return directa;
  return (
    indice.rows.find((r) => {
      const etiqueta = String(r.tipoCap || r.descripcion || r.nombre || '').trim();
      return etiqueta && etiquetasTipCapEquivalentes(v, etiqueta, indice);
    }) || null
  );
}

function matchIdTipCap(a, b, indice) {
  const sa = String(a ?? '').trim();
  const sb = String(b ?? '').trim();
  if (!sa || !sb) return false;
  if (sa === sb) return true;

  const ca = resolverIdTipCapCanonico(sa, indice);
  const cb = resolverIdTipCapCanonico(sb, indice);
  if (ca && cb && ca === cb) return true;

  const na = sa.match(/^(\d+)/);
  const nb = sb.match(/^(\d+)/);
  return !!(na && nb && na[1] === nb[1]);
}

function findRequisitoPorCap(config, idTipCap, indice) {
  const canon = resolverIdTipCapCanonico(idTipCap, indice);
  return (config.requisitosPorCap || []).find((r) => matchIdTipCap(r.idTipCap, canon, indice));
}

function invalidarCacheTipCap() {
  indiceCache = null;
  indiceCargadoEn = 0;
}

module.exports = {
  cargarIndiceTipCap,
  resolverIdTipCapCanonico,
  matchIdTipCap,
  idsTipCapIguales,
  filaCatalogoPorIdTipCap,
  filaCatalogoPorValorTipCap,
  programaCoincideIdTipCap,
  findRequisitoPorCap,
  normalizarTextoCap,
  invalidarCacheTipCap,
};
