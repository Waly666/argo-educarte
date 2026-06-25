const Config = require('../models/Config');
const {
  TIPOS_CONTRATO_CAP,
  TIPO_CONTRATO_CAP_LABELS,
} = require('../constants/tipoContratoCap');
const { CONDICIONES_IVA } = require('../constants/facturacionElectronica');

const CLAVE = 'contratosCapFiscal';

function reglaVacia(tipo) {
  return {
    tipo,
    label: TIPO_CONTRATO_CAP_LABELS[tipo] || tipo,
    condicionIva: 'gravado',
    porcentajeIva: 19,
    descuentoPorcentaje: 0,
    reteIvaPorcentaje: 0,
    reteFuentePorcentaje: 0,
    reteIcaPorcentaje: 0,
    responsabilidadFiscal: 'R-99-PN',
    notas: '',
  };
}

function defaults() {
  return TIPOS_CONTRATO_CAP.map(reglaVacia);
}

function normalizarRegla(raw, tipo) {
  const r = { ...reglaVacia(tipo), ...(raw || {}), tipo };
  const c = String(r.condicionIva || 'gravado').trim().toLowerCase();
  r.condicionIva = CONDICIONES_IVA.includes(c) ? c : 'gravado';
  r.porcentajeIva = Math.max(0, Math.min(100, Number(r.porcentajeIva) || 0));
  r.descuentoPorcentaje = Math.max(0, Math.min(100, Number(r.descuentoPorcentaje) || 0));
  r.reteIvaPorcentaje = Math.max(0, Math.min(100, Number(r.reteIvaPorcentaje) || 0));
  r.reteFuentePorcentaje = Math.max(0, Math.min(100, Number(r.reteFuentePorcentaje) || 0));
  r.reteIcaPorcentaje = Math.max(0, Math.min(100, Number(r.reteIcaPorcentaje) || 0));
  r.responsabilidadFiscal = String(r.responsabilidadFiscal || 'R-99-PN').trim();
  r.notas = String(r.notas || '').trim();
  r.label = TIPO_CONTRATO_CAP_LABELS[tipo] || r.label || tipo;
  return r;
}

async function obtenerConfigContratoCap() {
  const doc = await Config.findOne({ clave: CLAVE }).lean();
  const mapa = new Map();
  for (const row of doc?.reglas || []) {
    if (row?.tipo) mapa.set(row.tipo, normalizarRegla(row, row.tipo));
  }
  return TIPOS_CONTRATO_CAP.map((t) => mapa.get(t) || reglaVacia(t));
}

async function reglaPorTipo(tipo) {
  const t = String(tipo || '').trim();
  const reglas = await obtenerConfigContratoCap();
  return reglas.find((r) => r.tipo === t) || reglaVacia(t);
}

async function actualizarConfigContratoCap(body, user) {
  const lista = Array.isArray(body?.reglas) ? body.reglas : [];
  const reglas = TIPOS_CONTRATO_CAP.map((tipo) => {
    const src = lista.find((x) => x?.tipo === tipo) || {};
    return normalizarRegla(src, tipo);
  });
  await Config.findOneAndUpdate(
    { clave: CLAVE },
    { $set: { clave: CLAVE, reglas, userChangeRecord: user || '' } },
    { upsert: true, new: true },
  );
  return reglas;
}

module.exports = {
  CLAVE,
  defaults,
  obtenerConfigContratoCap,
  reglaPorTipo,
  actualizarConfigContratoCap,
};
