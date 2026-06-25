const crypto = require('crypto');
const mongoose = require('mongoose');
const Ingreso = require('../models/Ingreso');
const Liquidacion = require('../models/Liquidacion');
const DatosAlumno = require('../models/DatosAlumno');
const PagoEnLineaIntent = require('../models/PagoEnLineaIntent');
const { models: cat } = require('../models/catalogos');
const { siguienteNumComprobanteIngreso } = require('./configRecibo');
const { parseNumDoc, numDocQuery } = require('../utils/numDoc');
const { refrescarPagoMatricula } = require('./liquidacionMatricula');
const { obtenerSesionVirtualDiaria } = require('./cajaVirtualDiaria');
const { assertPasarelaActiva } = require('./configPasarela');
const {
  esLiquidacionMatriculaVirtual,
  validarPagoTotalMatriculaVirtual,
  num,
} = require('./pagoVirtual');
const {
  resolverTipoIngresoDesdeLiquidacion,
  formaPagoDesdeCatalogo,
} = require('./tipoIngresoResolver');
const {
  ORIGEN_PAGO_PASARELA,
  TIPO_PAGO_EN_LINEA,
  WOMPI_SANDBOX_CHECKOUT,
  WOMPI_PROD_CHECKOUT,
} = require('../constants/pasarela');
const { randomUUID } = require('crypto');

function toDec(n) {
  return mongoose.Types.Decimal128.fromString(String(Number(n) || 0));
}

function estadoLiq(valor, abonado) {
  const s = valor - abonado;
  if (s <= 0.0001) return 'pagado';
  if (abonado > 0) return 'parcial';
  return 'pendiente';
}

function nombreAlumno(a) {
  if (!a) return '';
  return [a.nombre1, a.nombre2, a.apellido1, a.apellido2].filter(Boolean).join(' ').trim();
}

function camposTipoIngreso(tipoDoc) {
  if (!tipoDoc) return { idTipoIngreso: null, tipoIngreso: null };
  const id = tipoDoc.idTipoIngreso ?? tipoDoc.codigo ?? tipoDoc._id;
  const tipo = tipoDoc.tipo ?? tipoDoc.descripcion ?? null;
  return {
    idTipoIngreso: id != null ? String(id) : null,
    tipoIngreso: tipo ? String(tipo) : null,
  };
}

function firmaIntegridadWompi(reference, amountInCents, currency, integritySecret) {
  const text = `${reference}${amountInCents}${currency}${integritySecret}`;
  return crypto.createHash('sha256').update(text).digest('hex');
}

function checkoutBaseUrl(cfg) {
  return cfg?.ambiente === 'production' ? WOMPI_PROD_CHECKOUT : WOMPI_SANDBOX_CHECKOUT;
}

function esHostLocalOPrivado(hostname) {
  const h = String(hostname || '').trim().toLowerCase();
  if (!h || h === 'localhost' || h === '127.0.0.1' || h === '::1') return true;
  const parts = h.split('.').map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/** Wompi (CloudFront) rechaza redirect-url con localhost — responde 403. */
function redirectUrlPermitidaWompi(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (esHostLocalOPrivado(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function armarCheckoutUrl(cfg, intent, signature) {
  const params = new URLSearchParams({
    'public-key': cfg.publicKey,
    currency: 'COP',
    'amount-in-cents': String(intent.montoCentavos),
    reference: intent.reference,
    'signature:integrity': signature,
  });
  const email = String(intent.customerEmail || '').trim();
  if (email) params.set('customer-data:email', email);
  const redirect = redirectUrlPermitidaWompi(intent.redirectUrl || cfg.redirectUrlBase);
  if (redirect) params.set('redirect-url', redirect);
  return `${checkoutBaseUrl(cfg)}?${params.toString()}`;
}

async function crearIntentoPagoEnLinea({ numDoc, idLiquidacion, customerEmail, redirectUrl }) {
  const cfg = await assertPasarelaActiva();
  const nd = parseNumDoc(numDoc);
  if (nd == null) {
    const err = new Error('Documento inválido');
    err.status = 400;
    throw err;
  }

  const liq = await Liquidacion.findById(idLiquidacion);
  if (!liq) {
    const err = new Error('Liquidación no encontrada');
    err.status = 404;
    throw err;
  }
  if (!numDocEqualsSimple(liq.numDoc, nd)) {
    const err = new Error('La liquidación no corresponde al alumno');
    err.status = 400;
    throw err;
  }
  if (!(await esLiquidacionMatriculaVirtual(liq))) {
    const err = new Error('Solo se puede pagar en línea matrículas virtuales.');
    err.status = 400;
    throw err;
  }

  const saldo = num(liq.saldo);
  const val = validarPagoTotalMatriculaVirtual(liq, saldo);
  if (!val.ok) {
    const err = new Error(val.message);
    err.status = 400;
    throw err;
  }

  const pending = await PagoEnLineaIntent.findOne({
    idLiquidacion: liq._id,
    estado: 'pending',
  }).lean();
  if (pending) {
    return reconstruirCheckout(cfg, pending, liq);
  }

  const reference = `ARGO-${randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`;
  const montoCentavos = Math.round(saldo * 100);
  const intent = await PagoEnLineaIntent.create({
    reference,
    numDoc: nd,
    idLiquidacion: liq._id,
    idPrograma: liq.idProg ? String(liq.idProg) : null,
    idMatricula: liq.idMat || liq.idMatricula || null,
    montoCentavos,
    montoCop: Math.round(saldo),
    customerEmail: customerEmail || null,
    redirectUrl: redirectUrl || cfg.redirectUrlBase || null,
    estado: 'pending',
  });

  return reconstruirCheckout(cfg, intent.toObject(), liq);
}

function numDocEqualsSimple(a, b) {
  return String(parseNumDoc(a)) === String(parseNumDoc(b));
}

function reconstruirCheckout(cfg, intent, liq) {
  const amountInCents = intent.montoCentavos;
  const currency = 'COP';
  const signature = firmaIntegridadWompi(intent.reference, amountInCents, currency, cfg.integritySecret);
  const redirectUsada = redirectUrlPermitidaWompi(intent.redirectUrl || cfg.redirectUrlBase);
  return {
    intentId: String(intent._id),
    reference: intent.reference,
    checkoutUrl: armarCheckoutUrl(cfg, intent, signature),
    montoCop: intent.montoCop,
    descripcion: liq.descripcion || 'Matrícula virtual',
    publicKey: cfg.publicKey,
    amountInCents,
    currency,
    signatureIntegrity: signature,
    redirectUrl: redirectUsada,
    redirectOmitidaLocal: !redirectUsada && Boolean(intent.redirectUrl || cfg.redirectUrlBase),
  };
}

async function registrarIngresoPasarela({ intent, wompiTransaction, cfg }) {
  if (intent.estado === 'approved' && intent.idIngreso) {
    const ing = await Ingreso.findById(intent.idIngreso).lean();
    return { ingreso: ing, duplicado: true };
  }

  const liq = await Liquidacion.findById(intent.idLiquidacion);
  if (!liq) {
    const err = new Error('Liquidación no encontrada al confirmar pago');
    err.status = 404;
    throw err;
  }

  const saldo = num(liq.saldo);
  const valor = num(intent.montoCop);
  const val = validarPagoTotalMatriculaVirtual(liq, valor);
  if (!val.ok) {
    const err = new Error(val.message);
    err.status = 400;
    throw err;
  }

  const nuevoAbonado = num(liq.abonado) + valor;
  liq.abonado = toDec(nuevoAbonado);
  liq.saldo = toDec(num(liq.valor) - nuevoAbonado);
  liq.estado = estadoLiq(num(liq.valor), nuevoAbonado);
  await liq.save();

  const sesion = await obtenerSesionVirtualDiaria(new Date());
  const alumno = await DatosAlumno.findOne(numDocQuery(intent.numDoc)).lean();
  const recibiDe = nombreAlumno(alumno) || String(intent.numDoc);
  const tipoIngDoc = await resolverTipoIngresoDesdeLiquidacion(liq._id);
  const tipoIng = camposTipoIngreso(tipoIngDoc);
  const idTipoPago = cfg.idTipoPago || TIPO_PAGO_EN_LINEA;
  const tipoDoc = await cat.catTipoPago
    .findOne({ $or: [{ idTipoPago }, { codigo: idTipoPago }] })
    .lean();
  const formaPago = formaPagoDesdeCatalogo(tipoDoc, idTipoPago) || 'Transferencia';
  const numRecibo = await siguienteNumComprobanteIngreso(cfg.idSedeVirtual);
  const refWompi = wompiTransaction?.id || wompiTransaction?.reference || intent.reference;

  const ing = await Ingreso.create({
    numDoc: intent.numDoc,
    idLiquidacion: liq._id,
    numRecibo,
    valor: toDec(valor),
    tipoAbono: 'total',
    concepto: liq.descripcion || 'Matrícula virtual — pago en línea',
    ...tipoIng,
    ingresoCaja: false,
    recibiDe,
    recibidoDe: recibiDe,
    idTipoPago,
    formaPago,
    numTransferencia: refWompi,
    numComprobante: refWompi,
    idCuentaBancaria: cfg.idCuentaBancaria,
    cuentaRecibe: cfg.idCuentaBancaria,
    observaciones: `Pago en línea Wompi · ref ${intent.reference}`,
    fecha: new Date(),
    idSesion: sesion.idSesion,
    idSede: cfg.idSedeVirtual,
    idUsuario: null,
    userAddReg: 'wompi-webhook',
    origenPasarela: true,
    origenPago: ORIGEN_PAGO_PASARELA,
    wompiTransactionId: wompiTransaction?.id || null,
    pagoEnLineaReference: intent.reference,
  });

  if (liq.idMat || liq.idMatricula) {
    await refrescarPagoMatricula(liq.idMat || liq.idMatricula);
  }

  try {
    const { limpiarAlertaPagoPorNumDoc } = require('./alertaPagoAlumno');
    await limpiarAlertaPagoPorNumDoc(intent.numDoc);
  } catch (_) {
    /* noop */
  }

  try {
    const { intentarCertificadoPagoAuto } = require('./certificadoPagoAuto');
    let rc = await intentarCertificadoPagoAuto({ numDoc: intent.numDoc, liq, saldo: num(liq.saldo) });
    if (!rc?.creado && rc?.motivo === 'virtual_certificado_al_aprobar') {
      const { intentarCertificadoVirtualAprobar } = require('./certificadoVirtualAuto');
      rc = await intentarCertificadoVirtualAprobar({ numDoc: intent.numDoc, idPrograma: liq.idProg });
    }
  } catch (errCert) {
    console.error('[pasarela] certificado auto:', errCert?.message || errCert);
  }

  await PagoEnLineaIntent.updateOne(
    { _id: intent._id },
    {
      $set: {
        estado: 'approved',
        wompiStatus: wompiTransaction?.status || 'APPROVED',
        wompiTransactionId: wompiTransaction?.id || null,
        idIngreso: ing._id,
        rawWebhook: wompiTransaction || null,
      },
    },
  );

  return { ingreso: ing.toObject(), duplicado: false };
}

module.exports = {
  firmaIntegridadWompi,
  redirectUrlPermitidaWompi,
  crearIntentoPagoEnLinea,
  registrarIngresoPasarela,
};
