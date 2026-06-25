const Ingreso = require('../models/Ingreso');
const Liquidacion = require('../models/Liquidacion');
const Certificado = require('../models/Certificado');
const { parseNumDoc, numDocQuery } = require('../utils/numDoc');
const { armarRecibo } = require('../controllers/reciboController');
const { generarHtmlIngreso } = require('./comprobanteHtml');
const { buscarLiquidacionVirtual } = require('./aulaVirtualMatricula');

function num(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
  return Number(v) || 0;
}

function mapReciboResumen(ing) {
  if (!ing) return null;
  return {
    idIngreso: String(ing._id),
    numRecibo: ing.numRecibo || null,
    fecha: ing.fecha || ing.createdAt || null,
    valor: num(ing.valor),
  };
}

async function verificarLiquidacionAlumno(numDoc, idLiquidacion) {
  const nd = parseNumDoc(numDoc);
  if (nd == null || !idLiquidacion) return null;
  const liq = await Liquidacion.findById(idLiquidacion).lean();
  if (!liq || Number(liq.numDoc) !== nd) return null;
  return liq;
}

async function buscarIngresoPorLiquidacion(numDoc, idLiquidacion) {
  const liq = await verificarLiquidacionAlumno(numDoc, idLiquidacion);
  if (!liq) return null;

  return Ingreso.findOne({
    $or: [{ idLiquidacion: liq._id }, { 'detalle.idLiquidacion': liq._id }],
  })
    .sort({ fecha: -1, createdAt: -1 })
    .lean();
}

async function verificarIngresoAlumno(numDoc, idIngreso) {
  const nd = parseNumDoc(numDoc);
  if (nd == null || !idIngreso) {
    const err = new Error('Solicitud inválida');
    err.status = 400;
    throw err;
  }

  const ing = await Ingreso.findById(idIngreso).lean();
  if (!ing) {
    const err = new Error('Recibo no encontrado');
    err.status = 404;
    throw err;
  }

  if (Number(ing.numDoc) === nd) return ing;

  const liqIds = [];
  if (ing.idLiquidacion) liqIds.push(ing.idLiquidacion);
  if (Array.isArray(ing.detalle)) {
    for (const d of ing.detalle) {
      if (d.idLiquidacion) liqIds.push(d.idLiquidacion);
    }
  }

  if (liqIds.length) {
    const propias = await Liquidacion.countDocuments({
      _id: { $in: liqIds },
      ...numDocQuery(nd),
    });
    if (propias > 0) return ing;
  }

  const err = new Error('No tiene permiso para ver este recibo');
  err.status = 403;
  throw err;
}

async function reciboResumenPorLiquidacion(numDoc, idLiquidacion) {
  const ing = await buscarIngresoPorLiquidacion(numDoc, idLiquidacion);
  return mapReciboResumen(ing);
}

async function reciboResumenPorPrograma(numDoc, idPrograma) {
  const liq = await buscarLiquidacionVirtual(numDoc, idPrograma);
  if (!liq) return null;
  return reciboResumenPorLiquidacion(numDoc, liq._id);
}

async function reciboResumenPorCertificado(numDoc, certId) {
  const nd = parseNumDoc(numDoc);
  if (nd == null || !certId) return null;
  const cert = await Certificado.findById(certId).lean();
  if (!cert || cert.estado === 'anulado' || Number(cert.numDoc) !== nd) return null;
  if (!cert.idLiquidacion) return null;
  return reciboResumenPorLiquidacion(numDoc, cert.idLiquidacion);
}

async function htmlReciboPortal(numDoc, idIngreso) {
  await verificarIngresoAlumno(numDoc, idIngreso);
  const data = await armarRecibo(idIngreso);
  if (!data) {
    const err = new Error('Recibo no encontrado');
    err.status = 404;
    throw err;
  }
  return generarHtmlIngreso(data);
}

module.exports = {
  mapReciboResumen,
  buscarIngresoPorLiquidacion,
  verificarIngresoAlumno,
  reciboResumenPorLiquidacion,
  reciboResumenPorPrograma,
  reciboResumenPorCertificado,
  htmlReciboPortal,
};
