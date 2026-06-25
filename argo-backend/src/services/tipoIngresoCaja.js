const { models: cat } = require('../models/catalogos');

const CLAVES_TIPO_CAJA = ['INGRESO CONTRATO', 'APROVISIONAMIENTO DE CAJA', 'OTROS INGRESOS'];

function normalizarTipo(txt) {
  return String(txt ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function esTipoIngresoCajaDoc(tipoDoc) {
  if (!tipoDoc) return false;
  const t = normalizarTipo(tipoDoc.tipo || tipoDoc.descripcion || tipoDoc);
  return CLAVES_TIPO_CAJA.some((k) => t === normalizarTipo(k) || t.includes(normalizarTipo(k)));
}

async function resolverTipoIngreso(idTipoIngreso) {
  if (idTipoIngreso == null || idTipoIngreso === '') return null;
  const asString = String(idTipoIngreso).trim();
  const n = Number(asString);
  return cat.tipoIngreso
    .findOne({
      $or: [
        { idTipoIngreso: asString },
        ...(Number.isFinite(n) ? [{ idTipoIngreso: n }] : []),
      ],
    })
    .lean();
}

async function validarTipoIngresoCaja(idTipoIngreso) {
  const tipo = await resolverTipoIngreso(idTipoIngreso);
  if (!tipo) return { ok: false, status: 400, message: 'Tipo de ingreso no encontrado' };
  if (!esTipoIngresoCajaDoc(tipo)) {
    return {
      ok: false,
      status: 400,
      message: 'Este tipo de ingreso no está habilitado para ingresos directos de caja',
    };
  }
  return { ok: true, tipo };
}

function esIngresoContrato(tipoDoc) {
  return normalizarTipo(tipoDoc?.tipo).includes('CONTRATO');
}

function esAprovisionamientoCaja(tipoDoc) {
  return normalizarTipo(tipoDoc?.tipo).includes('APROVISION');
}

function esOtrosIngresos(tipoDoc) {
  const t = normalizarTipo(tipoDoc?.tipo);
  return t.includes('OTROS INGRESO') || t === normalizarTipo('OTROS INGRESOS');
}

module.exports = {
  CLAVES_TIPO_CAJA,
  normalizarTipo,
  esTipoIngresoCajaDoc,
  resolverTipoIngreso,
  validarTipoIngresoCaja,
  esIngresoContrato,
  esAprovisionamientoCaja,
  esOtrosIngresos,
};
