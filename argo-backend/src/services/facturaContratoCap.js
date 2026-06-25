const mongoose = require('mongoose');
const Contratacion = require('../models/Contratacion');
const Cliente = require('../models/Cliente');
const FacturaElectronica = require('../models/FacturaElectronica');
const { roundMoney } = require('../utils/coerceTypes');
const { obtenerConfigFacturacionInterno } = require('./configFacturacion');
const { reglaPorTipo } = require('./configContratoCap');
const { buildCustomerFactus, validarCustomerFactus } = require('./facturaCustomer');
const {
  desglosarItem,
  taxesItem,
  totalFactusDesdeItems,
  referenceCodeFactura,
} = require('./facturaPayload');
const { emitirFactura } = require('./facturaProveedor');
const { esTipoContratoCapValido } = require('../constants/tipoContratoCap');
const {
  ESTADO_RECHAZADA,
  ESTADO_ANULADA,
  ADQUIRENTE_CLIENTE,
  FORMA_PAGO_CONTADO,
} = require('../constants/facturacionElectronica');

const ORIGEN_CONTRATO_CAP = 'contrato_cap';

function num(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
  return Number(v) || 0;
}

function toDec(n) {
  return mongoose.Types.Decimal128.fromString(String(Number(n) || 0));
}

async function facturaActivaDeContrato(idContrato) {
  return FacturaElectronica.findOne({
    idContrato: String(idContrato),
    estado: { $ne: ESTADO_ANULADA },
  }).lean();
}

async function cargarContratoFacturable(idContrato) {
  const c = await Contratacion.findById(idContrato).lean();
  if (!c) {
    const err = new Error('Contrato no encontrado');
    err.status = 404;
    throw err;
  }
  if (!c.idClienteFacturacion) {
    const err = new Error(
      'Vincule un cliente de facturación al contrato. Créelo en Configuración → Clientes si no existe.',
    );
    err.status = 400;
    err.code = 'CONTRATO_SIN_CLIENTE';
    throw err;
  }
  const valor = roundMoney(num(c.valorContrato));
  if (!(valor > 0)) {
    const err = new Error('Indique el valor del contrato (mayor a cero) antes de facturar');
    err.status = 400;
    err.code = 'CONTRATO_SIN_VALOR';
    throw err;
  }
  const objeto = String(c.objetoContrato || c.objeto || '').trim();
  if (!objeto) {
    const err = new Error('El contrato debe tener objeto / descripción para la línea de la factura');
    err.status = 400;
    err.code = 'CONTRATO_SIN_OBJETO';
    throw err;
  }
  const ya = await facturaActivaDeContrato(c._id);
  if (ya) {
    const err = new Error(
      `Este contrato ya tiene factura ${ya.numeroFactura || ya.referenceCode}. Solo se permite una factura por contrato.`,
    );
    err.status = 409;
    err.code = 'CONTRATO_YA_FACTURADO';
    err.details = { idFactura: String(ya._id), numeroFactura: ya.numeroFactura || '' };
    throw err;
  }
  const cliente = await Cliente.findById(c.idClienteFacturacion).lean();
  if (!cliente || cliente.activo === false) {
    const err = new Error('Cliente de facturación no encontrado o inactivo');
    err.status = 404;
    err.code = 'CLIENTE_INACTIVO';
    throw err;
  }
  if (!esTipoContratoCapValido(cliente.tipoContratoCap)) {
    const err = new Error(
      'El cliente de facturación no tiene tipo de contratante. Edítelo en Configuración → Clientes.',
    );
    err.status = 400;
    err.code = 'CLIENTE_SIN_TIPO';
    throw err;
  }
  const regla = await reglaPorTipo(cliente.tipoContratoCap);
  return { contrato: c, cliente, regla, valor, objeto };
}

function armarItemContrato({ contrato, regla, valor, objeto }) {
  const pctIva = regla.condicionIva === 'gravado' ? regla.porcentajeIva : 0;
  const m = desglosarItem(valor, regla.condicionIva, pctIva);
  const desc = Math.max(0, Math.min(100, Number(regla.descuentoPorcentaje) || 0));
  const nombre = String(objeto).slice(0, 250);
  const cod = String(contrato.codContrato || contrato._id || 'CONTRATO').trim();
  const item = {
    code_reference: `CAP-CONTRATO-${cod}`.slice(0, 40),
    name: nombre,
    quantity: '1.00',
    discount_rate: desc.toFixed(2),
    price: m.base.toFixed(2),
    unit_measure_code: '94',
    standard_code: '999',
    taxes: taxesItem(regla.condicionIva, m.porcentajeIva),
  };
  const totalFactus = totalFactusDesdeItems([item]);
  const base = roundMoney(m.base * (1 - desc / 100));
  const valorIvaFactus = roundMoney(totalFactus - base);
  return {
    item,
    detalle: {
      descripcion: nombre,
      condicionIva: regla.condicionIva,
      porcentajeIva: m.porcentajeIva,
      valorLiquidacion: valor,
      base,
      valorIva: valorIvaFactus,
      total: totalFactus,
      descuentoPorcentaje: desc,
    },
    totales: { base, valorIva: valorIvaFactus, total: totalFactus },
  };
}

function calcularRetenciones(regla, totales, cliente = {}) {
  let reteIvaPct = 0;
  if (cliente.agenteRetenedorIva) {
    reteIvaPct = Number(cliente.porcentajeReteIva) || Number(regla.reteIvaPorcentaje) || 0;
  }

  let reteFuentePct = 0;
  if (cliente.autoretenedor) {
    reteFuentePct = Number(cliente.porcentajeReteFuente) || Number(regla.reteFuentePorcentaje) || 0;
  }

  const reteIcaPct = Number(regla.reteIcaPorcentaje) || 0;
  return {
    reteIva: {
      aplica: reteIvaPct > 0 && totales.valorIva > 0,
      porcentaje: reteIvaPct,
      valor: reteIvaPct > 0 ? roundMoney(totales.valorIva * (reteIvaPct / 100)) : 0,
      origen: cliente.agenteRetenedorIva ? 'cliente' : null,
    },
    reteFuente: {
      aplica: reteFuentePct > 0 && totales.base > 0,
      porcentaje: reteFuentePct,
      valor: reteFuentePct > 0 ? roundMoney(totales.base * (reteFuentePct / 100)) : 0,
      origen: cliente.autoretenedor ? 'cliente' : null,
    },
    reteIca: {
      aplica: reteIcaPct > 0,
      porcentaje: reteIcaPct,
      valor: reteIcaPct > 0 ? roundMoney(totales.base * (reteIcaPct / 100)) : 0,
      origen: 'regla',
    },
  };
}

async function armarFacturaContrato(idContrato) {
  const cfg = await obtenerConfigFacturacionInterno();
  const { contrato, cliente, regla, valor, objeto } = await cargarContratoFacturable(idContrato);
  const adquirente = { tipo: ADQUIRENTE_CLIENTE, cliente };
  const customerFactus = await buildCustomerFactus(adquirente);
  validarCustomerFactus(customerFactus, adquirente);

  const { item, detalle, totales } = armarItemContrato({ contrato, regla, valor, objeto });
  const retenciones = calcularRetenciones(regla, totales, cliente);

  const payload = {
    reference_code: referenceCodeFactura(`C-${contrato.codContrato || contrato._id}`),
    document: '01',
    operation_type: '10',
    send_email: cfg.sendEmail !== false,
    observation: `Contrato capacitación ${contrato.codContrato || ''}. ${regla.label || cliente.tipoContratoCap}.`.trim(),
    payment_details: [
      {
        payment_form: FORMA_PAGO_CONTADO,
        payment_method_code: '10',
        amount: totales.total.toFixed(2),
      },
    ],
    cash_rounding_amount: '0.00',
    customer: customerFactus,
    items: [item],
  };
  if (cfg.numberingRangeId) payload.numbering_range_id = cfg.numberingRangeId;

  return {
    contrato,
    cliente,
    regla,
    retenciones,
    payload,
    detalle,
    totales: { ...totales, formaPago: FORMA_PAGO_CONTADO, esCredito: false },
    adquirente: {
      tipo: ADQUIRENTE_CLIENTE,
      nombre: cliente.razonSocial || cliente.nombres || '',
      identificacion: cliente.identificacion,
      idCliente: cliente._id,
      tipoContratoCap: cliente.tipoContratoCap || '',
      granContribuyente: !!cliente.granContribuyente,
      autoretenedor: !!cliente.autoretenedor,
      agenteRetenedorIva: !!cliente.agenteRetenedorIva,
      porcentajeReteIva: Number(cliente.porcentajeReteIva) || 0,
      porcentajeReteFuente: Number(cliente.porcentajeReteFuente) || 0,
    },
  };
}

async function previewFacturaContrato(idContrato) {
  return armarFacturaContrato(idContrato);
}

async function emitirFacturaContrato(idContrato, { idSede = null, idUsuario = null, userAddReg = null } = {}) {
  const armado = await armarFacturaContrato(idContrato);
  const cfg = await obtenerConfigFacturacionInterno();
  const { contrato, payload, detalle, totales, retenciones, regla, adquirente, cliente } = armado;

  const resultado = await emitirFactura({ payload, montos: { valorTotal: totales.total }, config: cfg });
  if (resultado.estado === ESTADO_RECHAZADA) {
    const err = new Error(resultado.error || 'Factus rechazó la emisión');
    err.status = 422;
    err.code = 'FACTUS_RECHAZADA';
    err.details = resultado.erroresValidacion || resultado.respuestaProveedor;
    throw err;
  }

  const doc = await FacturaElectronica.create({
    numDoc: null,
    idContrato: contrato._id,
    origenFactura: ORIGEN_CONTRATO_CAP,
    idSede: idSede || null,
    referenceCode: payload.reference_code,
    adquirente: {
      tipo: ADQUIRENTE_CLIENTE,
      idCliente: cliente._id,
      identificationDocumentCode: cliente.identificationDocumentCode || '31',
      identificacion: String(cliente.identificacion || ''),
      dv: cliente.dv || '',
      legalOrganizationCode: cliente.legalOrganizationCode || '1',
      tributeCode: cliente.tributeCode || 'ZZ',
      responsabilidadFiscal: cliente.responsabilidadFiscal || regla.responsabilidadFiscal || 'R-99-PN',
      nombre: cliente.razonSocial || cliente.nombres || '',
      razonSocial: cliente.razonSocial || '',
      nombres: cliente.nombres || '',
      direccion: cliente.direccion || '',
      correo: cliente.correo || '',
      telefono: cliente.telefono || '',
      municipioCodigo: cliente.municipioCodigo || '',
      tipoContratoCap: cliente.tipoContratoCap || '',
      granContribuyente: !!cliente.granContribuyente,
      autoretenedor: !!cliente.autoretenedor,
      agenteRetenedorIva: !!cliente.agenteRetenedorIva,
      porcentajeReteIva: Number(cliente.porcentajeReteIva) || 0,
      porcentajeReteFuente: Number(cliente.porcentajeReteFuente) || 0,
    },
    items: [
      {
        descripcion: detalle.descripcion,
        condicionIva: detalle.condicionIva,
        porcentajeIva: detalle.porcentajeIva,
        valorLiquidacion: toDec(detalle.valorLiquidacion),
        base: toDec(detalle.base),
        valorIva: toDec(detalle.valorIva),
        total: toDec(detalle.total),
      },
    ],
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
    reteIvaAplica: retenciones.reteIva.aplica,
    reteIvaPorcentaje: retenciones.reteIva.porcentaje,
    reteIvaValor: toDec(retenciones.reteIva.valor),
    tipoContratoCap: cliente.tipoContratoCap,
    retencionesContrato: retenciones,
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
    observaciones: `Contrato ${contrato.codContrato || ''}`,
  });

  await Contratacion.updateOne(
    { _id: contrato._id },
    {
      $set: {
        idFacturaElectronica: doc._id,
        facturadoAt: new Date(),
      },
    },
  );

  const o = doc.toObject();
  return {
    ...o,
    base: num(o.base),
    valorIva: num(o.valorIva),
    valorTotal: num(o.valorTotal),
    adquirente,
  };
}

async function estadoFacturaContrato(idContrato) {
  const factura = await facturaActivaDeContrato(idContrato);
  return {
    facturado: !!factura,
    factura: factura
      ? {
          _id: String(factura._id),
          numeroFactura: factura.numeroFactura || '',
          estado: factura.estado,
          valorTotal: num(factura.valorTotal),
          emitidaAt: factura.emitidaAt,
        }
      : null,
  };
}

module.exports = {
  ORIGEN_CONTRATO_CAP,
  previewFacturaContrato,
  emitirFacturaContrato,
  estadoFacturaContrato,
};
