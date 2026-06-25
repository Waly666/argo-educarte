const { models: cat } = require('../models/catalogos');
const Liquidacion = require('../models/Liquidacion');
const { esTipoIngresoCajaDoc, resolverTipoIngreso } = require('./tipoIngresoCaja');

/** tipoServ (catálogo servicios) → nombre en catálogo tipoIngreso */
const TIPO_SERV_A_NOMBRE = {
  CUR: 'CURSOS',
  DIP: 'DIPLOMADOS',
  TEC: 'TECNICOS',
  SEG: 'SEGURO',
  CEA: 'CEA',
  CRC: 'CRC',
  ASE: 'ASESORIA',
  TRM: 'TRAMITES',
  DET: 'DERECHOS TRANSITO',
  RUNT: 'DERECHOS RUNT',
  FNSV: 'DERECHOS FNSV',
};

function normalizar(txt) {
  return String(txt ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

async function buscarServicio(idServ) {
  const raw = String(idServ ?? '').trim();
  if (!raw) return null;
  const n = Number(raw);
  return cat.servicios
    .findOne({
      $or: [{ idServ: raw }, ...(Number.isFinite(n) ? [{ idServ: n }] : [])],
    })
    .lean();
}

async function buscarTipoIngresoPorNombre(nombre) {
  const buscado = normalizar(nombre);
  if (!buscado) return null;
  const rows = await cat.tipoIngreso.find({}).lean();
  return (
    rows.find((r) => normalizar(r.tipo) === buscado) ||
    rows.find((r) => normalizar(r.tipo).includes(buscado) || buscado.includes(normalizar(r.tipo))) ||
    null
  );
}

async function resolverTipoIngresoDesdeIdServ(idServ) {
  const serv = await buscarServicio(idServ);
  if (!serv) return null;
  const cod = String(serv.tipoServ || '').trim().toUpperCase();
  const nombre = TIPO_SERV_A_NOMBRE[cod] || serv.descrServicio || cod;
  const tipoDoc = await buscarTipoIngresoPorNombre(nombre);
  if (tipoDoc) return tipoDoc;
  if (cod) return { idTipoIngreso: null, tipo: nombre };
  return null;
}

async function resolverTipoIngresoDesdeLiquidacion(idLiquidacion) {
  if (!idLiquidacion) return null;
  const liq = await Liquidacion.findById(idLiquidacion).select('idServ descripcion').lean();
  if (!liq?.idServ) return null;
  return resolverTipoIngresoDesdeIdServ(liq.idServ);
}

async function resolverTipoIngresoIngreso(ing) {
  if (ing.idTipoIngreso) {
    const t = await resolverTipoIngreso(ing.idTipoIngreso);
    if (t) return t;
  }
  if (ing.tipoIngreso) {
    const t = await buscarTipoIngresoPorNombre(ing.tipoIngreso);
    if (t) return t;
    return { idTipoIngreso: ing.idTipoIngreso || null, tipo: ing.tipoIngreso };
  }
  if (ing.idLiquidacion) {
    return resolverTipoIngresoDesdeLiquidacion(ing.idLiquidacion);
  }
  return null;
}

function formaPagoDesdeCatalogo(tipoDoc, idTipoPago) {
  const txt = `${tipoDoc?.descripcion || ''} ${tipoDoc?.codigo || ''} ${idTipoPago || ''}`.toLowerCase();
  if (txt.includes('efect') || txt === 'ef' || String(idTipoPago) === '1') return 'Efectivo';
  if (txt.includes('cheq')) return 'Cheque';
  if (txt.includes('nequi') || txt.includes('davi')) return 'Nequi / Daviplata';
  if (txt.includes('débit') || txt.includes('debit') || txt.includes(' td')) return 'Tarjeta debito';
  if (txt.includes('créd') || txt.includes('credi') || txt.includes(' tc')) return 'Tarjeta de Credito';
  if (txt.includes('transf') || txt.includes('consign') || txt.includes('pse')) return 'Transferencia';
  return tipoDoc?.descripcion ? String(tipoDoc.descripcion).trim() : 'Efectivo';
}

module.exports = {
  TIPO_SERV_A_NOMBRE,
  resolverTipoIngresoDesdeIdServ,
  resolverTipoIngresoDesdeLiquidacion,
  resolverTipoIngresoIngreso,
  formaPagoDesdeCatalogo,
  buscarTipoIngresoPorNombre,
  esTipoIngresoCajaDoc,
};
