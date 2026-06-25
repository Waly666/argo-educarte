const mongoose = require('mongoose');
const Liquidacion = require('../models/Liquidacion');
const DatosAlumno = require('../models/DatosAlumno');
const Cliente = require('../models/Cliente');
const FacturaElectronica = require('../models/FacturaElectronica');
const { models: cat } = require('../models/catalogos');
const { numDocQuery } = require('../utils/numDoc');
const { obtenerConfigFacturacionInterno } = require('./configFacturacion');
const { armarPayloadFactus, nombreAlumno, condicionIvaServicio } = require('./facturaPayload');
const { buildCustomerFactus, validarCustomerFactus } = require('./facturaCustomer');
const { emitirFactura } = require('./facturaProveedor');
const {
  ESTADO_VALIDADA,
  ESTADO_RECHAZADA,
  ESTADO_ANULADA,
  ADQUIRENTE_ALUMNO,
  ADQUIRENTE_CLIENTE,
  MODO_EMISION_MANUAL,
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

function planoLiq(doc) {
  const o = doc?.toObject ? doc.toObject() : doc;
  const valor = num(o.valor);
  const abonado = num(o.abonado);
  const saldo = num(o.saldo) || Math.max(0, valor - abonado);
  return { ...o, valor, abonado, saldo };
}

async function buscarServicio(idServ) {
  const raw = String(idServ ?? '').trim();
  if (!raw) return null;
  const n = Number(raw);
  const or = [{ idServ: raw }];
  if (Number.isFinite(n)) or.push({ idServ: n });
  return cat.servicios.findOne({ $or: or }).lean();
}

function servicioRequiereFactura(serv) {
  const v = String(serv?.facturar ?? 'NO').trim().toUpperCase();
  return v === 'SI' || v === 'S' || v === 'TRUE' || v === '1';
}

async function facturaActivaDeLiquidacion(idLiquidacion) {
  const id = String(idLiquidacion || '').trim();
  if (!id) return null;
  return FacturaElectronica.findOne({
    'items.idLiquidacion': id,
    estado: { $ne: ESTADO_ANULADA },
  }).lean();
}

/** Liquidaciones facturables de un alumno: facturar=SI, con abono, sin FE activa. */
async function listarElegiblesPorAlumno(numDoc) {
  const docs = await Liquidacion.find(numDocQuery(numDoc)).sort({ fechaCreacion: -1, createdAt: -1 }).lean();
  const out = [];
  for (const d of docs) {
    const liq = planoLiq(d);
    if (!(liq.abonado > 0.0001)) continue; // requiere al menos un abono
    const servicio = await buscarServicio(liq.idServ);
    if (!servicioRequiereFactura(servicio)) continue;
    const ya = await facturaActivaDeLiquidacion(liq._id);
    if (ya) continue;
    out.push({
      _id: liq._id,
      numDoc: liq.numDoc,
      idServ: liq.idServ,
      idProg: liq.idProg,
      descripcion: liq.descripcion || servicio?.descrServicio || '',
      valor: liq.valor,
      abonado: liq.abonado,
      saldo: liq.saldo,
      porcentajeIva: num(servicio?.iva),
      condicionIva: condicionIvaServicio(servicio),
      servicioDescr: servicio?.descrServicio || '',
    });
  }
  return out;
}

function planoFactura(doc) {
  const o = doc?.toObject ? doc.toObject() : doc;
  return {
    ...o,
    base: num(o.base),
    valorIva: num(o.valorIva),
    valorTotal: num(o.valorTotal),
    reteIvaValor: num(o.reteIvaValor),
    items: (o.items || []).map((it) => ({
      ...it,
      valorLiquidacion: num(it.valorLiquidacion),
      base: num(it.base),
      valorIva: num(it.valorIva),
      total: num(it.total),
    })),
  };
}

/** Facturas ya emitidas para un alumno (incluye facturación a tercero/empresa). */
async function listarFacturasPorAlumno(numDoc) {
  const filtro = numDocQuery(numDoc);
  if (!filtro) {
    const err = new Error('Documento de alumno inválido');
    err.status = 400;
    throw err;
  }
  const docs = await FacturaElectronica.find(filtro)
    .sort({ emitidaAt: -1, createdAt: -1 })
    .lean();
  return docs.map(planoFactura);
}

async function listarFacturas({ idSede = null, skip = 0, limit = 200, q = '' } = {}) {
  const filtro = {};
  if (idSede) filtro.idSede = String(idSede).trim();
  const busq = String(q || '').trim();
  if (busq) {
    const re = new RegExp(busq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filtro.$or = [{ numeroFactura: re }, { referenceCode: re }, { cufe: re }, { 'adquirente.nombre': re }];
    const n = Number(busq);
    if (Number.isFinite(n)) filtro.$or.push({ numDoc: n });
  }

  const [total, docs] = await Promise.all([
    FacturaElectronica.countDocuments(filtro),
    FacturaElectronica.find(filtro).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);
  return { total, items: docs.map(planoFactura) };
}

async function resumenFacturacion({ idSede = null } = {}) {
  const filtroSede = idSede ? { idSede: String(idSede).trim() } : {};
  const cfg = await obtenerConfigFacturacionInterno();
  const [emitidas, validadas, rechazadas, modoDev] = await Promise.all([
    FacturaElectronica.countDocuments({ ...filtroSede, estado: { $ne: ESTADO_ANULADA } }),
    FacturaElectronica.countDocuments({ ...filtroSede, estado: ESTADO_VALIDADA }),
    FacturaElectronica.countDocuments({ ...filtroSede, estado: ESTADO_RECHAZADA }),
    FacturaElectronica.countDocuments({ ...filtroSede, modoDesarrollo: true }),
  ]);
  return {
    emitidas,
    validadas,
    rechazadas,
    modoDesarrollo: modoDev,
    proveedor: cfg.proveedor,
    modoEmision: cfg.modoEmision || MODO_EMISION_MANUAL,
    listoParaFactus: cfg.proveedor === 'factus' && cfg.activo,
  };
}

async function resolverAdquirente({ tipo, idCliente, numDoc }) {
  const alumno = await DatosAlumno.findOne(numDocQuery(numDoc)).lean();
  if (!alumno) {
    const err = new Error('Alumno no encontrado');
    err.status = 404;
    throw err;
  }
  if (tipo === ADQUIRENTE_CLIENTE) {
    if (!idCliente) {
      const err = new Error('Debe seleccionar el cliente al facturar a un tercero');
      err.status = 400;
      throw err;
    }
    const cli = await Cliente.findById(idCliente).lean();
    if (!cli) {
      const err = new Error('Cliente no encontrado');
      err.status = 404;
      throw err;
    }
    return { tipo: ADQUIRENTE_CLIENTE, cliente: cli, alumno };
  }
  return { tipo: ADQUIRENTE_ALUMNO, alumno };
}

function snapshotAdquirente(adq) {
  if (adq.tipo === ADQUIRENTE_CLIENTE) {
    const c = adq.cliente;
    const snap = {
      tipo: ADQUIRENTE_CLIENTE,
      idCliente: c._id,
      identificationDocumentCode: c.identificationDocumentCode || '31',
      identificacion: String(c.identificacion || ''),
      dv: c.dv || '',
      legalOrganizationCode: c.legalOrganizationCode || '1',
      tributeCode: c.tributeCode || 'ZZ',
      responsabilidadFiscal: c.responsabilidadFiscal || 'R-99-PN',
      nombre: c.razonSocial || c.nombres || '',
      razonSocial: c.razonSocial || '',
      nombres: c.nombres || '',
      direccion: c.direccion || '',
      correo: c.correo || '',
      telefono: c.telefono || '',
      municipioCodigo: c.municipioCodigo || '',
      granContribuyente: !!c.granContribuyente,
      autoretenedor: !!c.autoretenedor,
      agenteRetenedorIva: !!c.agenteRetenedorIva,
      porcentajeReteIva: Number(c.porcentajeReteIva) || 0,
      porcentajeReteFuente: Number(c.porcentajeReteFuente) || 0,
    };
    if (adq.alumno) {
      snap.participanteNombre = nombreAlumno(adq.alumno);
      snap.participanteNumDoc = adq.alumno.numDoc != null ? Number(adq.alumno.numDoc) : null;
    }
    return snap;
  }
  const a = adq.alumno;
  return {
    tipo: ADQUIRENTE_ALUMNO,
    identificacion: String(a.numDoc || ''),
    nombre: nombreAlumno(a),
    nombres: nombreAlumno(a),
    direccion: a.direccion || '',
    correo: a.correo || '',
    telefono: a.celular || '',
    municipioCodigo: a.codMunicipio || '',
  };
}

/** Carga y valida las liquidaciones seleccionadas (mismo alumno, facturables, con abono, sin FE). */
async function cargarItems(numDoc, idLiquidaciones) {
  if (!Array.isArray(idLiquidaciones) || !idLiquidaciones.length) {
    const err = new Error('Seleccione al menos un ítem (liquidación) a facturar');
    err.status = 400;
    throw err;
  }
  const itemsCtx = [];
  let totalAbonado = 0;
  for (const id of idLiquidaciones) {
    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      const err = new Error('Liquidación inválida en la selección');
      err.status = 400;
      throw err;
    }
    const liq = planoLiq(await Liquidacion.findById(id));
    if (!liq) {
      const err = new Error('Liquidación no encontrada');
      err.status = 404;
      throw err;
    }
    if (numDoc != null && String(liq.numDoc) !== String(numDoc)) {
      const err = new Error('Todas las liquidaciones deben ser del mismo alumno');
      err.status = 400;
      throw err;
    }
    if (!(liq.abonado > 0.0001)) {
      const err = new Error('Solo se factura una liquidación con al menos un abono');
      err.status = 409;
      err.code = 'SIN_ABONO';
      throw err;
    }
    const ya = await facturaActivaDeLiquidacion(liq._id);
    if (ya) {
      const err = new Error(`La liquidación "${liq.descripcion || liq._id}" ya está facturada`);
      err.status = 409;
      err.code = 'YA_FACTURADA';
      throw err;
    }
    const servicio = await buscarServicio(liq.idServ);
    if (!servicioRequiereFactura(servicio)) {
      const err = new Error(`El servicio "${liq.descripcion || ''}" no es facturable (facturar ≠ SI)`);
      err.status = 409;
      err.code = 'NO_FACTURABLE';
      throw err;
    }
    itemsCtx.push({ liquidacion: liq, servicio });
    totalAbonado = num(totalAbonado) + liq.abonado;
  }
  return { itemsCtx, totalAbonado };
}

async function previewFactura({ numDoc, idLiquidaciones, tipoAdquirente = ADQUIRENTE_ALUMNO, idCliente = null }) {
  const cfg = await obtenerConfigFacturacionInterno();
  const { itemsCtx, totalAbonado } = await cargarItems(numDoc, idLiquidaciones);
  const adquirente = await resolverAdquirente({ tipo: tipoAdquirente, idCliente, numDoc });
  const customerFactus = await buildCustomerFactus(adquirente);
  validarCustomerFactus(customerFactus, adquirente);
  const armado = armarPayloadFactus({
    itemsCtx,
    adquirente,
    configFacturacion: cfg,
    numDoc,
    totalAbonado,
    customerFactus,
  });
  return { ...armado, adquirente: snapshotAdquirente(adquirente) };
}

async function emitirFacturaMulti({
  numDoc,
  idLiquidaciones,
  tipoAdquirente = ADQUIRENTE_ALUMNO,
  idCliente = null,
  idSede = null,
  idUsuario = null,
  userAddReg = null,
}) {
  const cfg = await obtenerConfigFacturacionInterno();
  const { itemsCtx, totalAbonado } = await cargarItems(numDoc, idLiquidaciones);
  const adquirente = await resolverAdquirente({ tipo: tipoAdquirente, idCliente, numDoc });

  const customerFactus = await buildCustomerFactus(adquirente);
  validarCustomerFactus(customerFactus, adquirente);

  const { payload, detalle, totales, reteIva } = armarPayloadFactus({
    itemsCtx,
    adquirente,
    configFacturacion: cfg,
    numDoc,
    totalAbonado,
    customerFactus,
  });

  const resultado = await emitirFactura({ payload, montos: { valorTotal: totales.total }, config: cfg });
  if (resultado.estado === ESTADO_RECHAZADA) {
    const err = new Error(resultado.error || 'Factus rechazó la emisión');
    err.status = 422;
    err.code = 'FACTUS_RECHAZADA';
    err.details = resultado.erroresValidacion || resultado.respuestaProveedor;
    throw err;
  }

  const sedeFactura = idSede || itemsCtx[0]?.liquidacion?.idSede || null;
  const doc = await FacturaElectronica.create({
    numDoc,
    idSede: sedeFactura,
    referenceCode: payload.reference_code,
    adquirente: snapshotAdquirente(adquirente),
    items: detalle.map((d) => ({
      idLiquidacion: d.idLiquidacion,
      idServ: d.idServ,
      idProg: d.idProg,
      descripcion: d.descripcion,
      condicionIva: d.condicionIva,
      porcentajeIva: d.porcentajeIva,
      valorLiquidacion: toDec(d.valorLiquidacion),
      base: toDec(d.base),
      valorIva: toDec(d.valorIva),
      total: toDec(d.total),
    })),
    proveedor: resultado.proveedor,
    ambiente: cfg.ambiente,
    modoDesarrollo: !!resultado.modoDesarrollo,
    estado: resultado.estado,
    numeroFactura: resultado.numeroFactura || '',
    prefijo: resultado.prefijo || '',
    cufe: resultado.cufe || '',
    formaPago: totales.formaPago,
    base: toDec(totales.base),
    valorIva: toDec(totales.valorIva),
    valorTotal: toDec(totales.total),
    reteIvaAplica: reteIva.aplica,
    reteIvaPorcentaje: reteIva.porcentaje,
    reteIvaValor: toDec(reteIva.valor),
    payloadEnviado: payload,
    respuestaProveedor: resultado.respuestaProveedor,
    erroresValidacion: resultado.erroresValidacion || null,
    urlPdf: resultado.urlPdf || '',
    urlQr: resultado.urlQr || '',
    urlPublica: resultado.urlPdf || '',
    emitidaAt: new Date(),
    validadaAt: resultado.validadaAt || null,
    idUsuario,
    userAddReg,
  });

  return planoFactura(doc);
}

async function obtenerFactura(id) {
  const doc = await FacturaElectronica.findById(id).lean();
  if (!doc) {
    const err = new Error('Factura no encontrada');
    err.status = 404;
    throw err;
  }
  return planoFactura(doc);
}

module.exports = {
  listarElegiblesPorAlumno,
  listarFacturasPorAlumno,
  listarFacturas,
  resumenFacturacion,
  previewFactura,
  emitirFacturaMulti,
  obtenerFactura,
  servicioRequiereFactura,
};
