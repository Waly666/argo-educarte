const { models: cat } = require('../models/catalogos');
const Matricula = require('../models/Matricula');
const {
  MODALIDAD_VIRTUAL,
  MODALIDAD_PRESENCIAL,
  MODALIDAD_MIXTA,
} = require('../constants/modalidadPrograma');
const { MOMENTO_MATRICULA, MOMENTO_PAGO } = require('../constants/serviciosAdicionales');
const { esTarifaVirtual, TARIFA_VIRTUAL } = require('../constants/tarifa');
const { obtenerConfigServiciosAdicionales } = require('./configServiciosAdicionales');
const { buscarPrograma, num, inferirTipoServ } = require('./programaServicio');
const { resolverModalidadPrograma } = require('./programaModalidad');
const { cargarIndiceTipCap, resolverIdTipCapCanonico } = require('./tipoCapacitacionMatch');

let cacheConfig = null;
let cacheEn = 0;
const TTL_MS = 30_000;

function invalidarCacheServiciosAdicionales() {
  cacheConfig = null;
  cacheEn = 0;
}

async function cargarConfig() {
  const now = Date.now();
  if (cacheConfig && now - cacheEn < TTL_MS) return cacheConfig;
  cacheConfig = await obtenerConfigServiciosAdicionales();
  cacheEn = now;
  return cacheConfig;
}

function servicioSinPrograma(s) {
  const ip = s?.idProg;
  return ip == null || String(ip).trim() === '';
}

function idProgramaStr(prog) {
  return String(prog?.idPrograma ?? prog?.idProg ?? '').trim();
}

function modalidadesActivasDesdeTarifa(tarifa, modInfo) {
  if (esTarifaVirtual(tarifa)) return [MODALIDAD_VIRTUAL];
  const mods = modInfo?.modalidades || [];
  if (mods.includes(MODALIDAD_MIXTA)) return [MODALIDAD_PRESENCIAL, MODALIDAD_MIXTA];
  if (mods.includes(MODALIDAD_PRESENCIAL)) return [MODALIDAD_PRESENCIAL];
  return [MODALIDAD_PRESENCIAL];
}

function coincideModalidad(regla, modalidadesActivas) {
  const filt = regla.modalidades || [];
  if (!filt.length) return true;
  return modalidadesActivas.some((m) => filt.includes(m));
}

function coincideTarifa(regla, tarifa) {
  const filt = regla.tarifasMatricula || [];
  if (!filt.length) return true;
  return filt.includes(Number(tarifa));
}

async function coincideTipCap(regla, prog) {
  const filt = regla.idTipCaps || [];
  if (!filt.length) return true;
  const indice = await cargarIndiceTipCap();
  const canon = resolverIdTipCapCanonico(prog?.idTipCap, indice);
  return filt.some((id) => {
    const c = resolverIdTipCapCanonico(id, indice);
    return c === canon || String(id).trim() === String(prog?.idTipCap ?? '').trim();
  });
}

function coincidePrefijoCodigo(regla, prog) {
  const prefijos = regla.prefijosCodigo || [];
  if (!prefijos.length) return true;
  const cod = String(prog?.codigoProg || '').trim().toUpperCase();
  return prefijos.some((p) => cod.startsWith(String(p).toUpperCase()));
}

function coincidePrograma(regla, prog) {
  const ids = regla.idProgramas || [];
  if (!ids.length) return true;
  const idP = idProgramaStr(prog);
  return ids.some((id) => String(id).trim() === idP);
}

function coincideTipoPago(regla, idTipoPago) {
  const filt = regla.idTiposPago || [];
  if (!filt.length) return false;
  const id = String(idTipoPago ?? '').trim();
  return filt.some((t) => String(t).trim() === id);
}

async function cargarServicio(idServ) {
  const id = String(idServ).trim();
  const n = Number(id);
  return cat.servicios
    .findOne({
      $or: [{ idServ: id }, ...(Number.isFinite(n) ? [{ idServ: n }] : [])],
    })
    .lean();
}

function valorServicioAdicional(serv) {
  return num(serv?.tarifa1);
}

async function evaluarRegla(regla, ctx) {
  if (!regla.activo) return null;
  if (regla.momento !== ctx.momento) return null;

  const prog = ctx.prog;
  if (!prog) return null;

  const modInfo = ctx.modInfo || resolverModalidadPrograma(prog, ctx.serviciosProg || []);
  const modalidadesActivas = modalidadesActivasDesdeTarifa(ctx.tarifa, modInfo);

  if (!coincideModalidad(regla, modalidadesActivas)) return null;
  if (ctx.momento === MOMENTO_MATRICULA && !coincideTarifa(regla, ctx.tarifa)) return null;
  if (!(await coincideTipCap(regla, prog))) return null;
  if (!coincidePrefijoCodigo(regla, prog)) return null;
  if (!coincidePrograma(regla, prog)) return null;
  if (ctx.momento === MOMENTO_PAGO && !coincideTipoPago(regla, ctx.idTipoPago)) return null;

  const servicio = await cargarServicio(regla.idServ);
  if (!servicio || !servicioSinPrograma(servicio)) return null;

  const valor = valorServicioAdicional(servicio);
  if (valor <= 0) return null;

  return {
    reglaId: regla.id,
    idServ: servicio.idServ,
    servicio,
    valor,
    repartirSemestres: regla.repartirSemestres === true,
    descripcion: String(servicio.descrServicio || servicio.descripcion || 'Servicio adicional').trim(),
  };
}

/**
 * @param {{ momento, prog, tarifa?, serviciosProg?, idTipoPago?, modoMigracion? }} ctx
 */
async function resolverServiciosAdicionales(ctx) {
  if (ctx.modoMigracion === true) return [];

  const cfg = await cargarConfig();
  const items = [];
  const vistos = new Set();

  for (const regla of cfg.reglas || []) {
    const hit = await evaluarRegla(regla, ctx);
    if (!hit) continue;
    const key = String(hit.idServ);
    if (vistos.has(key)) continue;
    vistos.add(key);
    items.push(hit);
  }

  return items;
}

async function resolverServiciosAdicionalesMatricula(prog, { tarifa, serviciosProg, modoMigracion }) {
  return resolverServiciosAdicionales({
    momento: MOMENTO_MATRICULA,
    prog,
    tarifa,
    serviciosProg,
    modoMigracion,
  });
}

async function resolverServiciosAdicionalesPago({
  numDoc,
  idTipoPago,
  liquidaciones,
  modoMigracion,
}) {
  if (modoMigracion) return [];
  if (!liquidaciones?.length || !idTipoPago) return [];

  const liq = liquidaciones[0];
  let prog = null;
  let tarifa = TARIFA_VIRTUAL;

  if (liq.idProg) {
    prog = await buscarPrograma(liq.idProg);
  }
  if (liq.idMat || liq.idMatricula) {
    const mat = await Matricula.findById(liq.idMat || liq.idMatricula).lean();
    if (mat?.tarifa != null) tarifa = Number(mat.tarifa) || tarifa;
    if (!prog && mat?.idPrograma) prog = await buscarPrograma(mat.idPrograma);
  }
  if (!prog && liq.idProg) prog = await buscarPrograma(liq.idProg);
  if (!prog) return [];

  return resolverServiciosAdicionales({
    momento: MOMENTO_PAGO,
    prog,
    tarifa,
    idTipoPago,
    modoMigracion,
  });
}

/** Suma de ítems que no se reparten en semestres (matrícula). */
function sumaExtrasMatricula(items) {
  return (items || [])
    .filter((i) => !i.repartirSemestres)
    .reduce((acc, i) => acc + num(i.valor), 0);
}

function sumaTotalExtras(items) {
  return (items || []).reduce((acc, i) => acc + num(i.valor), 0);
}

module.exports = {
  invalidarCacheServiciosAdicionales,
  resolverServiciosAdicionales,
  resolverServiciosAdicionalesMatricula,
  resolverServiciosAdicionalesPago,
  sumaExtrasMatricula,
  sumaTotalExtras,
  modalidadesActivasDesdeTarifa,
  servicioSinPrograma,
  valorServicioAdicional,
};
