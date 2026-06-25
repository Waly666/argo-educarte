const mongoose = require('mongoose');
const FacturaElectronica = require('../models/FacturaElectronica');
const NotaCredito = require('../models/NotaCredito');
const { roundMoney } = require('../utils/coerceTypes');
const { obtenerConfigFacturacionInterno } = require('./configFacturacion');
const { emitirNotaCredito } = require('./facturaProveedor');
const {
  ESTADO_VALIDADA,
  ESTADO_RECHAZADA,
  ESTADO_ANULADA,
  NC_ANULACION,
  CONCEPTOS_NOTA_CREDITO,
  NOTA_CREDITO_TOTAL,
  NOTA_CREDITO_PARCIAL,
} = require('../constants/facturacionElectronica');

function num(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
  return Number(v) || 0;
}

function toDec(n) {
  return mongoose.Types.Decimal128.fromString(String(Number(n) || 0));
}

function taxesItem(condicionIva, porcentajeIva) {
  if (condicionIva === 'excluido') return [{ is_excluded: true }];
  if (condicionIva === 'exento') return [{ code: '01', rate: '0.00' }];
  return [{ code: '01', rate: (Number(porcentajeIva) || 0).toFixed(2) }];
}

function customerDesdeSnapshot(adq = {}) {
  const docCode = adq.identificationDocumentCode || (adq.tipo === 'cliente' ? '31' : '13');
  const esJuridica = String(adq.legalOrganizationCode || (docCode === '31' ? '1' : '2')) === '1';
  const c = {
    identification_document_code: docCode,
    identification: String(adq.identificacion || ''),
    legal_organization_code: esJuridica ? '1' : '2',
    tribute_code: adq.tributeCode || 'ZZ',
  };
  if (adq.dv) c.dv = String(adq.dv);
  if (esJuridica) c.company = adq.razonSocial || adq.nombre || 'Cliente';
  else c.names = adq.nombres || adq.nombre || 'Cliente';
  if (adq.direccion) c.address = adq.direccion;
  if (adq.correo) c.email = adq.correo;
  if (adq.telefono) c.phone = adq.telefono;
  if (adq.municipioCodigo) c.municipality_code = adq.municipioCodigo;
  return c;
}

function planoNota(doc) {
  const o = doc?.toObject ? doc.toObject() : doc;
  return {
    ...o,
    base: num(o.base),
    valorIva: num(o.valorIva),
    valorTotal: num(o.valorTotal),
    items: (o.items || []).map((it) => ({
      ...it,
      base: num(it.base),
      valorIva: num(it.valorIva),
      total: num(it.total),
    })),
  };
}

async function cargarFactura(idFactura) {
  if (!mongoose.Types.ObjectId.isValid(String(idFactura))) {
    const err = new Error('Factura inválida');
    err.status = 400;
    throw err;
  }
  const factura = await FacturaElectronica.findById(idFactura).lean();
  if (!factura) {
    const err = new Error('Factura no encontrada');
    err.status = 404;
    throw err;
  }
  if (factura.estado === ESTADO_ANULADA) {
    const err = new Error('La factura ya está anulada');
    err.status = 409;
    err.code = 'YA_ANULADA';
    throw err;
  }
  return factura;
}

/**
 * Selecciona los ítems de la nota crédito.
 * - total: todos los ítems de la factura.
 * - parcial: solo los idLiquidacion indicados (deben existir en la factura).
 */
function seleccionarItems(factura, tipo, idLiquidaciones) {
  const itemsFactura = factura.items || [];
  if (tipo === NOTA_CREDITO_PARCIAL) {
    const set = new Set((idLiquidaciones || []).map((x) => String(x)));
    const elegidos = itemsFactura.filter((it) => set.has(String(it.idLiquidacion)));
    if (!elegidos.length) {
      const err = new Error('Seleccione al menos un ítem de la factura para la devolución parcial');
      err.status = 400;
      throw err;
    }
    return elegidos;
  }
  return itemsFactura;
}

function construir({ factura, tipo, conceptoCorreccion, itemsSel, motivo, config }) {
  const items = [];
  const detalle = [];
  let base = 0;
  let valorIva = 0;
  let total = 0;

  for (const it of itemsSel) {
    const b = roundMoney(num(it.base));
    const iva = roundMoney(num(it.valorIva));
    const t = roundMoney(num(it.total));
    items.push({
      code_reference: String(it.idServ || it.idLiquidacion || 'SERV'),
      name: String(it.descripcion || 'Servicio CEA').trim(),
      quantity: '1.00',
      discount_rate: '0.00',
      price: b.toFixed(2),
      unit_measure_code: '94',
      standard_code: '999',
      taxes: taxesItem(it.condicionIva, num(it.porcentajeIva)),
    });
    detalle.push({
      idLiquidacion: it.idLiquidacion || null,
      idServ: it.idServ || null,
      descripcion: it.descripcion || '',
      condicionIva: it.condicionIva || 'gravado',
      porcentajeIva: num(it.porcentajeIva),
      base: b,
      valorIva: iva,
      total: t,
    });
    base = roundMoney(base + b);
    valorIva = roundMoney(valorIva + iva);
    total = roundMoney(total + t);
  }

  const referenceCode = `ARGO-NC-${factura.numDoc || 'X'}-${Date.now()}`;
  const payload = {
    reference_code: referenceCode,
    correction_concept_code: conceptoCorreccion,
    customer: customerDesdeSnapshot(factura.adquirente || {}),
    billing_reference: {
      number: factura.numeroFactura || '',
      cufe: factura.cufe || '',
      reference_code: factura.referenceCode || '',
      issue_date: factura.emitidaAt ? new Date(factura.emitidaAt).toISOString().slice(0, 10) : undefined,
    },
    items,
  };
  if (motivo) payload.observation = String(motivo).trim();
  if (config?.numberingRangeId) payload.numbering_range_id = config.numberingRangeId;

  return { referenceCode, payload, detalle, totales: { base, valorIva, total } };
}

async function previewNotaCredito({ idFactura, tipo = NOTA_CREDITO_TOTAL, conceptoCorreccion = NC_ANULACION, idLiquidaciones = [], motivo = '' }) {
  const cfg = await obtenerConfigFacturacionInterno();
  const factura = await cargarFactura(idFactura);
  const tipoOk = tipo === NOTA_CREDITO_PARCIAL ? NOTA_CREDITO_PARCIAL : NOTA_CREDITO_TOTAL;
  const itemsSel = seleccionarItems(factura, tipoOk, idLiquidaciones);
  const { detalle, totales } = construir({ factura, tipo: tipoOk, conceptoCorreccion, itemsSel, motivo, config: cfg });
  return { tipo: tipoOk, conceptoCorreccion, detalle, totales };
}

async function emitirNota({
  idFactura,
  tipo = NOTA_CREDITO_TOTAL,
  conceptoCorreccion = NC_ANULACION,
  idLiquidaciones = [],
  motivo = '',
  idSede = null,
  idUsuario = null,
  userAddReg = null,
}) {
  const cfg = await obtenerConfigFacturacionInterno();
  const factura = await cargarFactura(idFactura);
  const tipoOk = tipo === NOTA_CREDITO_PARCIAL ? NOTA_CREDITO_PARCIAL : NOTA_CREDITO_TOTAL;
  const concepto = CONCEPTOS_NOTA_CREDITO.includes(String(conceptoCorreccion))
    ? String(conceptoCorreccion)
    : tipoOk === NOTA_CREDITO_TOTAL
      ? NC_ANULACION
      : '1';

  const itemsSel = seleccionarItems(factura, tipoOk, idLiquidaciones);
  const { referenceCode, payload, detalle, totales } = construir({
    factura,
    tipo: tipoOk,
    conceptoCorreccion: concepto,
    itemsSel,
    motivo,
    config: cfg,
  });

  const resultado = await emitirNotaCredito({ payload, montos: { valorTotal: totales.total }, config: cfg });
  if (resultado.estado === ESTADO_RECHAZADA) {
    const err = new Error(resultado.error || 'Factus rechazó la nota crédito');
    err.status = 422;
    err.code = 'FACTUS_NC_RECHAZADA';
    err.details = resultado.erroresValidacion;
    throw err;
  }

  const doc = await NotaCredito.create({
    idFactura: factura._id,
    referenceCode,
    numDoc: factura.numDoc,
    idSede: idSede || factura.idSede || null,
    conceptoCorreccion: concepto,
    tipo: tipoOk,
    motivo: String(motivo || '').trim(),
    adquirente: factura.adquirente || null,
    items: detalle.map((d) => ({
      idLiquidacion: d.idLiquidacion,
      idServ: d.idServ,
      descripcion: d.descripcion,
      condicionIva: d.condicionIva,
      porcentajeIva: d.porcentajeIva,
      base: toDec(d.base),
      valorIva: toDec(d.valorIva),
      total: toDec(d.total),
    })),
    facturaNumero: factura.numeroFactura || '',
    facturaCufe: factura.cufe || '',
    facturaReferenceCode: factura.referenceCode || '',
    proveedor: resultado.proveedor,
    ambiente: cfg.ambiente,
    modoDesarrollo: !!resultado.modoDesarrollo,
    estado: resultado.estado,
    numeroNota: resultado.numeroNota || '',
    prefijo: resultado.prefijo || '',
    cude: resultado.cude || '',
    base: toDec(totales.base),
    valorIva: toDec(totales.valorIva),
    valorTotal: toDec(totales.total),
    payloadEnviado: payload,
    respuestaProveedor: resultado.respuestaProveedor,
    erroresValidacion: resultado.erroresValidacion || null,
    urlPdf: resultado.urlPdf || '',
    urlQr: resultado.urlQr || '',
    emitidaAt: new Date(),
    validadaAt: resultado.validadaAt || null,
    idUsuario,
    userAddReg,
  });

  // Anulación total → la factura queda anulada y sus liquidaciones vuelven a ser facturables.
  if (tipoOk === NOTA_CREDITO_TOTAL) {
    await FacturaElectronica.updateOne({ _id: factura._id }, { $set: { estado: ESTADO_ANULADA } });
  }

  return planoNota(doc);
}

async function listarNotasDeFactura(idFactura) {
  const rows = await NotaCredito.find({ idFactura }).sort({ createdAt: -1 }).lean();
  return rows.map(planoNota);
}

async function listarNotas({ idSede = null, skip = 0, limit = 200 } = {}) {
  const filtro = {};
  if (idSede) filtro.idSede = String(idSede).trim();
  const [total, docs] = await Promise.all([
    NotaCredito.countDocuments(filtro),
    NotaCredito.find(filtro).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);
  return { total, items: docs.map(planoNota) };
}

module.exports = {
  previewNotaCredito,
  emitirNota,
  listarNotasDeFactura,
  listarNotas,
};
