const QRCode = require('qrcode');
const Egreso = require('../models/Egreso');
const Empleado = require('../models/Empleado');
const Vehiculo = require('../models/Vehiculo');
const { obtenerConfigRecibo, siguienteNumComprobanteEgreso } = require('../services/configRecibo');
const { numeroDocumentoQuery, nombreCompletoEmpleado } = require('../utils/empleadoDoc');
const { normalizarPlaca } = require('../constants/vehiculo');
const { models: cat } = require('../models/catalogos');
const { generarHtmlEgreso } = require('../services/comprobanteHtml');

function num(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
  return Number(v) || 0;
}

async function resolverTipoEgreso(tipoEgreso) {
  if (!tipoEgreso) return null;
  const n = Number(tipoEgreso);
  return cat.tipoEgreso
    .findOne({
      $or: [
        { idTipoEgreso: tipoEgreso },
        ...(Number.isFinite(n) ? [{ idTipoEgreso: n }] : []),
        { tipo: new RegExp(String(tipoEgreso).trim(), 'i') },
      ],
    })
    .lean();
}

async function resolverCuentaOrigen(cuentaOrigen) {
  if (!cuentaOrigen) return null;
  const n = Number(cuentaOrigen);
  return cat.cuentasBancarias
    .findOne({
      $or: [
        { idCuentaBancaria: cuentaOrigen },
        ...(Number.isFinite(n) ? [{ idCuentaBancaria: n }] : []),
      ],
    })
    .lean();
}

async function resolverBancoDestino(bancoDestino) {
  if (!bancoDestino) return null;
  const n = Number(bancoDestino);
  return cat.bancos
    .findOne({
      $or: [
        { idBanco: bancoDestino },
        { idbanco: bancoDestino },
        ...(Number.isFinite(n) ? [{ idBanco: n }, { idbanco: n }] : []),
      ],
    })
    .lean();
}

async function enriquecerEgreso(raw) {
  const e = raw;
  const tipo = await resolverTipoEgreso(e.tipoEgreso);
  const cuenta = await resolverCuentaOrigen(e.cuentaOrigen);
  const banco = await resolverBancoDestino(e.bancoDestino);
  let emp = null;
  if (e.numeroDocumento) {
    const q = numeroDocumentoQuery(e.numeroDocumento);
    emp = q ? await Empleado.findOne(q).lean() : null;
  }
  const veh = e.placa ? await Vehiculo.findOne({ placa: normalizarPlaca(e.placa) }).lean() : null;
  return {
    idEgreso: String(e._id),
    numRecibo: e.numRecibo || null,
    fechaEgreso: e.fechaEgreso,
    valorEgreso: num(e.valorEgreso),
    pagueA: e.pagueA || nombreCompletoEmpleado(emp) || null,
    numeroDocumento: e.numeroDocumento ?? null,
    empleadoNombre: nombreCompletoEmpleado(emp),
    empleadoCargo: emp?.cargoNombre || null,
    concepto: e.concepto,
    tipoEgresoDescr: tipo?.tipo || null,
    placa: e.placa || null,
    vehiculoMarca: veh?.nombreMarca || null,
    vehiculoLinea: veh?.nombreLinea || null,
    vehiculoClase: veh?.claseVehiculo || null,
    formaPago: e.formaPago || null,
    numTransferencia: e.numTransferencia || null,
    fechaTransferencia: e.fechaTransferencia || null,
    cuentaOrigenDescr: cuenta ? `${cuenta.banco || ''} ${cuenta.numCuenta || ''}`.trim() : null,
    cuentaDestino: e.cuentaDestino || null,
    bancoDestinoDescr: banco?.banco || banco?.descripcion || banco?.nombre || null,
    urlSoporte: e.urlSoporte || null,
    anticipoNomina: e.anticipoNomina || null,
    idPeriodo: e.idPeriodo ?? null,
    userAddReg: e.userAddReg,
    autorizadoPor: e.autorizadoPor || null,
    nombreAutoriza: e.nombreAutoriza || null,
    autorizadoEn: e.autorizadoEn || null,
    estado: e.estado || (e.anulado ? 'ANULADO' : null),
    anulado: e.anulado === true || String(e.estado || '').trim().toUpperCase() === 'ANULADO',
    anuladoEn: e.anuladoEn || null,
    anuladoPor: e.anuladoPor || null,
    valorAnulado: e.valorAnulado != null ? num(e.valorAnulado) : null,
    motivoAnulacion: e.motivoAnulacion || null,
  };
}

async function ensureNumRecibo(egresoDoc) {
  if (egresoDoc.numRecibo) return egresoDoc.numRecibo;
  const num = await siguienteNumComprobanteEgreso(egresoDoc.idSede);
  await Egreso.updateOne({ _id: egresoDoc._id }, { $set: { numRecibo: num } });
  return num;
}

async function armarReciboEgreso(id) {
  const eg = await Egreso.findById(id).lean();
  if (!eg) return null;

  const config = await obtenerConfigRecibo(eg.idSede);
  const egreso = await enriquecerEgreso(eg);
  const numeroRecibo = await ensureNumRecibo(eg);
  egreso.numRecibo = numeroRecibo;

  const prefEg = (config.prefijoComprobanteEgreso || 'CE').trim();
  const numeroComprobante = numeroRecibo || `${prefEg}-${String(eg._id).slice(-8).toUpperCase()}`;

  const qrTexto = JSON.stringify({
    comprobante: numeroComprobante,
    egresoId: String(eg._id),
    beneficiario: egreso.pagueA,
    documento: egreso.numeroDocumento,
    valor: egreso.valorEgreso,
    fecha: egreso.fechaEgreso || eg.fechaAudi,
    nit: config.nit || '',
  });

  let qrDataUrl = null;
  if (config.mostrarQr !== false) {
    try {
      qrDataUrl = await QRCode.toDataURL(qrTexto, { width: 140, margin: 1, errorCorrectionLevel: 'M' });
    } catch {
      qrDataUrl = null;
    }
  }

  const tituloEgreso =
    (config.mensajeEncabezadoEgreso || 'COMPROBANTE DE EGRESO').trim() || 'COMPROBANTE DE EGRESO';
  const pieEgreso =
    config.mensajePieEgreso ||
    config.mensajePie ||
    'Constancia de pago. El beneficiario debe firmar o adjuntar factura/voucher como soporte.';

  return {
    config: { ...config, mensajeEncabezadoEgreso: tituloEgreso, mensajePieEgreso: pieEgreso },
    egreso,
    numeroRecibo: numeroComprobante,
    qrDataUrl,
    qrTexto,
  };
}

exports.datos = async (req, res, next) => {
  try {
    const data = await armarReciboEgreso(req.params.id);
    if (!data) return res.status(404).json({ message: 'Egreso no encontrado' });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

exports.html = async (req, res, next) => {
  try {
    const data = await armarReciboEgreso(req.params.id);
    if (!data) return res.status(404).send('Egreso no encontrado');

    const html = generarHtmlEgreso(data);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    next(e);
  }
};
