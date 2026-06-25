const mongoose = require('mongoose');
const Ingreso = require('../models/Ingreso');
const Liquidacion = require('../models/Liquidacion');
const DatosAlumno = require('../models/DatosAlumno');
const { models: cat } = require('../models/catalogos');
const { siguienteNumComprobanteIngreso } = require('../services/configRecibo');
const { parseNumDoc, numDocFromParams, numDocEquals, numDocQuery, numDocQueryNativo } = require('../utils/numDoc');
const { buscarNumDocsAlumno } = require('../utils/busquedaAlumnoNombre');
const { refrescarPagoMatricula, recalcularAbonoLiquidacion, idsLiquidacionDeIngreso } = require('../services/liquidacionMatricula');
const { exigirSesionAbierta } = require('../services/cajaSesion');
const {
  autorizarAnulacionComprobante,
  metadatosAnulacion,
  sufijoAutoriza,
} = require('../services/anulacionComprobante');
const { esComprobanteAnulado } = require('../utils/comprobanteEstado');
const { validarPagoIntangibleIngreso } = require('../utils/referenciaPago');
const upload = require('../middleware/upload');
const {
  validarTipoIngresoCaja,
  esIngresoContrato,
  esAprovisionamientoCaja,
} = require('../services/tipoIngresoCaja');
const {
  resolverTipoIngresoDesdeLiquidacion,
  resolverTipoIngresoIngreso,
  formaPagoDesdeCatalogo,
} = require('../services/tipoIngresoResolver');
const { registrarCreacion, registrarEliminacion } = require('../services/auditoria');
const { esIngresoCaja } = require('../utils/ingresoClasificacion');
const { resolverServiciosAdicionalesPago } = require('../services/serviciosAdicionalesResolver');
const { crearLiquidacionesServiciosAdicionales } = require('../services/serviciosAdicionalesLiquidacion');
const { num: numProg } = require('../services/programaServicio');
const {
  esLiquidacionMatriculaVirtual,
  validarPagoTotalMatriculaVirtual,
} = require('../services/pagoVirtual');

/** Usuarios sintéticos (p. ej. soporte-maestro) no tienen ObjectId en Mongo. */
function idUsuarioObjectIdDesdeReq(req) {
  const s = String(req.user?.sub || '').trim();
  if (/^[a-fA-F0-9]{24}$/.test(s)) return new mongoose.Types.ObjectId(s);
  return null;
}

function parseBodyIngreso(raw) {
  const body = { ...(raw || {}) };
  if (typeof body.items === 'string' && body.items.trim()) {
    try {
      body.items = JSON.parse(body.items);
    } catch {
      body.items = [];
    }
  }
  if (body.valor != null && body.valor !== '') body.valor = Number(body.valor);
  return body;
}

function urlSoporteDesdeReq(req) {
  if (req.file?.filename) return upload.publicUrl('ingresos', req.file.filename);
  return null;
}

function num(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
  return Number(v) || 0;
}
function toDec(n) {
  return mongoose.Types.Decimal128.fromString(String(Number(n) || 0));
}

function estadoLiq(valor, abonado) {
  const s = valor - abonado;
  if (s <= 0.0001) return 'pagado';
  if (abonado > 0) return 'parcial';
  return 'pendiente';
}

function calcularTipoAbono(valorPago, saldoAntes) {
  return valorPago >= saldoAntes - 0.0001 ? 'total' : 'abono';
}

function idsLiquidacionIngreso(row) {
  const ids = new Set();
  if (row?.idLiquidacion) ids.add(String(row.idLiquidacion));
  if (Array.isArray(row?.detalle)) {
    for (const d of row.detalle) {
      if (d?.idLiquidacion) ids.add(String(d.idLiquidacion));
    }
  }
  return [...ids].filter((id) => mongoose.Types.ObjectId.isValid(id));
}

function idsLiquidacionFilas(rows) {
  const ids = new Set();
  for (const r of rows || []) {
    for (const id of idsLiquidacionIngreso(r)) ids.add(id);
  }
  return [...ids];
}

function conceptoIngresoAlumno(row, enriquecido, descrMap) {
  if (enriquecido.esIngresoCaja) return enriquecido.concepto || null;
  if (Array.isArray(enriquecido.detalle) && enriquecido.detalle.length) {
    const descrs = enriquecido.detalle.map((d) => d.descripcion).filter(Boolean);
    if (descrs.length) return descrs.join(', ');
  }
  return descrMap[String(row.idLiquidacion)] || enriquecido.concepto || null;
}

async function filtroIngresosAlumno(numDoc) {
  const clauses = [];
  const porDoc = numDocQueryNativo(numDoc);
  if (porDoc?.$or) clauses.push(...porDoc.$or);
  else if (porDoc) clauses.push(porDoc);

  const liqIds = await Liquidacion.find(numDocQuery(numDoc) || { numDoc: -1 })
    .select('_id')
    .lean()
    .then((rows) => rows.map((l) => l._id).filter(Boolean));

  if (liqIds.length) {
    clauses.push({ idLiquidacion: { $in: liqIds } });
    clauses.push({ 'detalle.idLiquidacion': { $in: liqIds } });
  }

  if (!clauses.length) return { numDoc: -1 };
  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}


function tipoAbonoDescr(tipo) {
  if (tipo === 'total') return 'Total';
  if (tipo === 'abono') return 'Abono';
  return null;
}

function esTipoPagoEfectivo(tipoDoc, idTipoPago) {
  const fp = formaPagoDesdeCatalogo(tipoDoc, idTipoPago);
  return fp === 'Efectivo';
}

function descrCuentaBancaria(c) {
  if (!c) return null;
  const parts = [(c.banco || '').trim(), (c.tipo || '').trim(), c.numCuenta ?? ''].filter(Boolean);
  return parts.join(' — ');
}

function nombreAlumno(a) {
  if (!a) return '';
  return [a.nombre1, a.nombre2, a.apellido1, a.apellido2].filter(Boolean).join(' ').trim();
}

async function resolverCuentaBancaria(idCuentaBancaria) {
  if (!idCuentaBancaria) return null;
  const n = Number(idCuentaBancaria);
  return cat.cuentasBancarias
    .findOne({
      $or: [
        { idCuentaBancaria },
        ...(Number.isFinite(n) ? [{ idCuentaBancaria: n }, { idCuenta: n }] : []),
        { idCuenta: idCuentaBancaria },
        { numCuenta: idCuentaBancaria },
        ...(Number.isFinite(n) ? [{ numCuenta: n }] : []),
      ],
    })
    .lean();
}

async function resolverBanco(idBanco) {
  if (!idBanco) return null;
  return cat.bancos
    .findOne({
      $or: [
        { idBanco },
        { idbanco: idBanco },
        { idbanco: Number(idBanco) },
        { codigo: idBanco },
      ],
    })
    .lean();
}

async function armarCamposPago(body, tipoDoc, idTipoPago) {
  const esEfectivo = esTipoPagoEfectivo(tipoDoc, idTipoPago);
  const idCuentaBancaria = body.idCuentaBancaria || null;
  const cuenta = esEfectivo ? null : await resolverCuentaBancaria(idCuentaBancaria);
  const banco = body.idBanco ? await resolverBanco(body.idBanco) : null;
  const numTransferencia = String(body.numTransferencia || body.numComprobante || '').trim() || null;
  const formaPago = body.formaPago || formaPagoDesdeCatalogo(tipoDoc, idTipoPago);
  const bancoEmisor =
    body.bancoEmisor ||
    banco?.descripcion ||
    banco?.nombre ||
    banco?.banco ||
    (cuenta?.banco ? String(cuenta.banco).trim() : null);

  return {
    esEfectivo,
    formaPago,
    numTransferencia,
    numComprobante: numTransferencia,
    fechaTransferencia: body.fechaTransferencia ? String(body.fechaTransferencia).trim() : null,
    bancoEmisor: esEfectivo ? null : bancoEmisor,
    idBanco: body.idBanco || null,
    idCuentaBancaria: esEfectivo ? null : idCuentaBancaria,
    cuentaRecibe: esEfectivo ? null : idCuentaBancaria || descrCuentaBancaria(cuenta),
    cuentaBancariaDescr: descrCuentaBancaria(cuenta),
  };
}

function camposTipoIngreso(tipoDoc) {
  if (!tipoDoc) return { idTipoIngreso: null, tipoIngreso: null };
  return {
    idTipoIngreso: tipoDoc.idTipoIngreso != null ? String(tipoDoc.idTipoIngreso) : null,
    tipoIngreso: tipoDoc.tipo || null,
  };
}

async function enriquecer(p) {
  const tipo = await cat.catTipoPago
    .findOne({ $or: [{ idTipoPago: p.idTipoPago }, { codigo: p.idTipoPago }] })
    .lean();
  const tipoIngDoc = await resolverTipoIngresoIngreso(p);
  const banco = p.idBanco || p.bancoEmisor ? await resolverBanco(p.idBanco || p.bancoEmisor) : null;
  const cuenta = await resolverCuentaBancaria(p.idCuentaBancaria || p.cuentaRecibe);
  const formaPago = p.formaPago || formaPagoDesdeCatalogo(tipo, p.idTipoPago);
  const recibiDe = p.recibiDe || p.recibidoDe || null;

  const detalle = Array.isArray(p.detalle)
    ? p.detalle.map((d) => ({
        idLiquidacion: d.idLiquidacion ? String(d.idLiquidacion) : null,
        descripcion: d.descripcion || '',
        valor: num(d.valor),
        tipoAbono: d.tipoAbono || null,
        tipoAbonoDescr: tipoAbonoDescr(d.tipoAbono),
      }))
    : undefined;

  return {
    ...p,
    valor: num(p.valor),
    detalle,
    tipoPagoDescr: tipo?.descripcion || tipo?.nombre || p.idTipoPago,
    formaPago,
    bancoDescr: p.bancoEmisor || banco?.descripcion || banco?.nombre || banco?.banco || null,
    bancoEmisor: p.bancoEmisor || banco?.descripcion || banco?.nombre || banco?.banco || null,
    cuentaBancariaDescr: descrCuentaBancaria(cuenta) || p.cuentaRecibe || null,
    cuentaRecibe: p.cuentaRecibe || p.idCuentaBancaria || descrCuentaBancaria(cuenta),
    numTransferencia: p.numTransferencia || p.numComprobante || null,
    urlSoporte: p.urlSoporte || null,
    tipoAbonoDescr: tipoAbonoDescr(p.tipoAbono),
    idTipoIngreso: p.idTipoIngreso || (tipoIngDoc?.idTipoIngreso != null ? String(tipoIngDoc.idTipoIngreso) : null),
    tipoIngreso: p.tipoIngreso || tipoIngDoc?.tipo || null,
    tipoIngresoDescr: p.tipoIngreso || tipoIngDoc?.tipo || null,
    recibiDe,
    recibidoDe: recibiDe,
    cuadreDescuadre: !!p.cuadreDescuadre,
    idSesion: p.idSesion ?? null,
    esIngresoCaja: esIngresoCaja(p),
    esMigracion:
      p.origenMigracion === true ||
      String(p.tipoIngreso || '').toUpperCase() === 'MIGRACION' ||
      String(p.idTipoPago || '').toUpperCase() === 'MIGRACION',
    estado: p.estado || (p.anulado ? 'ANULADO' : 'ACTIVO'),
    anulado: esComprobanteAnulado(p),
    anuladoEn: p.anuladoEn || null,
    anuladoPor: p.anuladoPor || null,
    valorAnulado: p.valorAnulado != null ? num(p.valorAnulado) : null,
    motivoAnulacion: p.motivoAnulacion || null,
  };
}

exports.crear = async (req, res, next) => {
  try {
    req.body = parseBodyIngreso(req.body);
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const esCobroAlumno =
      !!body.idLiquidacion ||
      (items.length > 0 && items.some((it) => it?.idLiquidacion));
    if (esCobroAlumno) return exports.crearAlumno(req, res, next);
    if (body.idTipoIngreso) return exports.crearCaja(req, res, next);
    return res.status(400).json({
      message: 'Indique idLiquidacion o items (cobro de alumno) o idTipoIngreso (ingreso de caja)',
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message, code: e.code });
    next(e);
  }
};

exports.crearAlumno = async (req, res, next) => {
  try {
    const body = req.body || {};
    const { numDoc: numDocRaw, idTipoPago, observaciones, fecha } = body;
    const numDoc = parseNumDoc(numDocRaw);
    if (numDoc == null || !idTipoPago) {
      return res.status(400).json({ message: 'numDoc e idTipoPago son obligatorios' });
    }

    // Soporta pago de varios ítems (`items:[{idLiquidacion,valor}]`) o el clásico de un solo ítem.
    const itemsRaw =
      Array.isArray(body.items) && body.items.length
        ? body.items
        : [{ idLiquidacion: body.idLiquidacion, valor: body.valor }];

    const pedidos = [];
    const vistos = new Set();
    for (const it of itemsRaw) {
      const idLiq = it?.idLiquidacion ? String(it.idLiquidacion) : '';
      const vit = Number(it?.valor);
      if (!idLiq || !(vit > 0)) {
        return res.status(400).json({ message: 'Cada ítem requiere idLiquidacion y un valor mayor a 0' });
      }
      if (vistos.has(idLiq)) {
        return res.status(400).json({ message: 'Hay ítems repetidos en el pago' });
      }
      vistos.add(idLiq);
      pedidos.push({ idLiquidacion: idLiq, valor: vit });
    }

    const liqRefs = [];
    for (const p of pedidos) {
      const liq = await Liquidacion.findById(p.idLiquidacion).lean();
      if (liq) liqRefs.push(liq);
    }

    const extrasPago = await resolverServiciosAdicionalesPago({
      numDoc,
      idTipoPago,
      liquidaciones: liqRefs,
    });

    const serviciosAdicionalesCreados = [];
    if (extrasPago.length && liqRefs.length) {
      const ref = liqRefs[0];
      const alumnoRef = await DatosAlumno.findOne(numDocQuery(numDoc)).lean();
      const extrasLiq = await crearLiquidacionesServiciosAdicionales({
        items: extrasPago,
        numDoc,
        idSede: req.idSede,
        idMatricula: ref.idMat || ref.idMatricula,
        idProg: ref.idProg,
        idAlumno: ref.idAlumno || alumnoRef?._id,
      });
      for (const liq of extrasLiq) {
        const v = numProg(liq.valor);
        pedidos.push({ idLiquidacion: String(liq._id), valor: v });
        serviciosAdicionalesCreados.push({
          idLiquidacion: String(liq._id),
          descripcion: liq.descripcion,
          valor: v,
        });
      }
    }

    const tipoDoc = await cat.catTipoPago
      .findOne({ $or: [{ idTipoPago }, { codigo: idTipoPago }] })
      .lean();
    const pago = await armarCamposPago(body, tipoDoc, idTipoPago);
    if (!pago.esEfectivo && !pago.idCuentaBancaria) {
      return res.status(400).json({
        message: 'Indique la cuenta bancaria de la empresa donde ingresa el pago (transferencia, cheque, Nequi, etc.)',
      });
    }
    const urlSoporte = urlSoporteDesdeReq(req);
    const intangibleVal = validarPagoIntangibleIngreso(pago, urlSoporte);
    if (!intangibleVal.ok) return res.status(intangibleVal.status).json({ message: intangibleVal.message });

    // Cargar y validar todas las liquidaciones antes de tocar nada.
    const liqDocs = [];
    for (const p of pedidos) {
      const liq = await Liquidacion.findById(p.idLiquidacion);
      if (!liq) return res.status(404).json({ message: 'Item de liquidación no encontrado' });
      if (!numDocEquals(liq.numDoc, numDoc)) {
        return res.status(400).json({ message: 'Liquidación no corresponde al alumno' });
      }
      const saldoActual = num(liq.saldo);
      if (p.valor > saldoActual + 0.0001) {
        return res.status(400).json({
          message: `El pago de «${liq.descripcion || 'ítem'}» excede el saldo (${saldoActual})`,
        });
      }
      if (await esLiquidacionMatriculaVirtual(liq)) {
        const valVirtual = validarPagoTotalMatriculaVirtual(liq, p.valor);
        if (!valVirtual.ok) {
          return res.status(400).json({ message: valVirtual.message });
        }
      }
      liqDocs.push({ liq, valor: p.valor, saldoActual });
    }

    const esMulti = liqDocs.length > 1;
    const total = liqDocs.reduce((a, x) => a + x.valor, 0);
    const alumno = await DatosAlumno.findOne(numDocQuery(numDoc)).lean();
    const recibiDe = body.recibiDe || body.recibidoDe || nombreAlumno(alumno) || String(numDoc);

    const tipoIngDoc = await resolverTipoIngresoDesdeLiquidacion(liqDocs[0].liq._id);
    const tipoIng = camposTipoIngreso(tipoIngDoc);

    // Aplicar el abono a cada liquidación (con rollback si falla la creación).
    const aplicadas = [];
    const detalle = [];
    for (const x of liqDocs) {
      const { liq, valor: vit, saldoActual } = x;
      const nuevoAbonado = num(liq.abonado) + vit;
      liq.abonado = toDec(nuevoAbonado);
      liq.saldo = toDec(num(liq.valor) - nuevoAbonado);
      liq.estado = estadoLiq(num(liq.valor), nuevoAbonado);
      await liq.save();
      aplicadas.push({ liq, valor: vit });
      detalle.push({
        idLiquidacion: liq._id,
        descripcion: liq.descripcion || '',
        valor: toDec(vit),
        tipoAbono: calcularTipoAbono(vit, saldoActual),
      });
    }

    const numRecibo = await siguienteNumComprobanteIngreso(req.idSede);
    const sesion = await exigirSesionAbierta(req.user?.sub, req.idSede);
    const username = req.user?.username || req.user?.sub || null;
    const tipoAbonoGeneral = detalle.every((d) => d.tipoAbono === 'total') ? 'total' : 'abono';
    const concepto = esMulti
      ? `Varios servicios (${detalle.length})`
      : liqDocs[0].liq.descripcion || null;

    let ing;
    try {
      ing = await Ingreso.create({
        numDoc,
        idLiquidacion: esMulti ? null : liqDocs[0].liq._id,
        detalle: esMulti ? detalle : undefined,
        numRecibo,
        valor: toDec(total),
        tipoAbono: tipoAbonoGeneral,
        concepto,
        ...tipoIng,
        ingresoCaja: false,
        recibiDe,
        recibidoDe: recibiDe,
        idTipoPago,
        formaPago: pago.formaPago,
        numTransferencia: pago.numTransferencia,
        numComprobante: pago.numComprobante,
        fechaTransferencia: pago.fechaTransferencia,
        bancoEmisor: pago.bancoEmisor,
        idBanco: pago.idBanco,
        idCuentaBancaria: pago.idCuentaBancaria,
        cuentaRecibe: pago.cuentaRecibe,
        urlSoporte,
        observaciones,
        fecha: fecha ? new Date(fecha) : new Date(),
        idSesion: sesion.idSesion,
        idSede: req.idSede,
        idUsuario: idUsuarioObjectIdDesdeReq(req),
        userAddReg: username,
      });
    } catch (errIngreso) {
      for (const a of aplicadas) {
        const { liq } = a;
        const ab = Math.max(0, num(liq.abonado) - a.valor);
        liq.abonado = toDec(ab);
        liq.saldo = toDec(num(liq.valor) - ab);
        liq.estado = estadoLiq(num(liq.valor), ab);
        await liq.save();
      }
      throw errIngreso;
    }

    for (const a of aplicadas) {
      if (a.liq.idMat) await refrescarPagoMatricula(a.liq.idMat);
    }

    try {
      const { limpiarAlertaPagoPorNumDoc } = require('../services/alertaPagoAlumno');
      await limpiarAlertaPagoPorNumDoc(numDoc);
    } catch (errAlertaPago) {
      console.error('[alertaPago] limpiar tras abono:', errAlertaPago?.message || errAlertaPago);
    }

    for (const a of aplicadas) {
      try {
        const { onPrimerAbonoIngreso } = require('../services/programacionCeaAuto');
        const r = await onPrimerAbonoIngreso({ numDoc, liq: a.liq, req });
        if (r && !r.skipped && r.clases) {
          console.info(`[programacionCeaAuto] ${r.clases} clase(s) CREADO para numDoc ${numDoc}`);
        }
      } catch (errAuto) {
        console.error('[programacionCeaAuto] primer abono:', errAuto?.stack || errAuto?.message || errAuto);
      }
    }

    // Certificado automático por cada ítem que quedó en saldo 0 (se evalúa por ítem, no por saldo general).
    const certificadosAuto = [];
    for (const a of aplicadas) {
      const saldoItem = num(a.liq.saldo);
      if (saldoItem > 0.0001) continue;
      try {
        const { intentarCertificadoPagoAuto } = require('../services/certificadoPagoAuto');
        let rc = await intentarCertificadoPagoAuto({ numDoc, liq: a.liq, saldo: saldoItem });
        if (!rc?.creado && rc?.motivo === 'virtual_certificado_al_aprobar') {
          const { intentarCertificadoVirtualAprobar } = require('../services/certificadoVirtualAuto');
          rc = await intentarCertificadoVirtualAprobar({ numDoc, idPrograma: a.liq.idProg });
        }
        if (rc?.creado) {
          certificadosAuto.push(rc.certificado);
          console.info(`[certificadoAuto] Certificado ${rc.certificado?.codigoCert} emitido para numDoc ${numDoc}`);
        }
      } catch (errCert) {
        console.error('[certificadoPagoAuto]', errCert?.stack || errCert?.message || errCert);
      }
    }

    const enriquecido = await enriquecer(ing.toObject());
    registrarCreacion(req, 'ingreso', ing, {
      resumen: `Ingreso ${tipoIng.tipoIngreso || 'alumno'} recibo #${numRecibo} por ${total}${
        esMulti ? ` (${detalle.length} servicios)` : ''
      }`,
    });
    res.status(201).json({
      ...enriquecido,
      numRecibo,
      certificadoAuto: certificadosAuto[0] || null,
      certificadosAuto,
      serviciosAdicionales: serviciosAdicionalesCreados,
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message, code: e.code });
    next(e);
  }
};

exports.crearCaja = async (req, res, next) => {
  try {
    const body = req.body || {};
    const {
      idTipoIngreso,
      valor,
      idTipoPago,
      observaciones,
      fecha,
      concepto,
      recibidoDe,
      recibiDe,
      documentoTercero,
      tipoPersona,
    } = body;

    if (!idTipoIngreso || valor == null || !idTipoPago) {
      return res.status(400).json({ message: 'idTipoIngreso, valor e idTipoPago son obligatorios' });
    }

    const valTipo = await validarTipoIngresoCaja(idTipoIngreso);
    if (!valTipo.ok) return res.status(valTipo.status).json({ message: valTipo.message });

    const v = Number(valor);
    if (!(v > 0)) return res.status(400).json({ message: 'Valor inválido' });

    const conceptoTxt = String(concepto || '').trim();
    if (!conceptoTxt) return res.status(400).json({ message: 'El concepto es obligatorio' });

    const recibidoTxt = String(recibiDe || recibidoDe || '').trim();
    const docTercero = String(documentoTercero || '').trim();
    const tipoPers = String(tipoPersona || '').trim().toLowerCase();

    if (esIngresoContrato(valTipo.tipo)) {
      if (!recibidoTxt) return res.status(400).json({ message: 'Indique el nombre del contratante (recibido de)' });
      if (!docTercero) return res.status(400).json({ message: 'Indique NIT o documento del contratante' });
      if (!['natural', 'juridica'].includes(tipoPers)) {
        return res.status(400).json({ message: 'Indique si el contratante es persona natural o jurídica' });
      }
    } else if (esAprovisionamientoCaja(valTipo.tipo)) {
      if (!recibidoTxt) return res.status(400).json({ message: 'Indique quién aporta el dinero a la caja' });
    } else if (!recibidoTxt) {
      return res.status(400).json({ message: 'Indique de quién se recibe el ingreso' });
    }

    const tipoDoc = await cat.catTipoPago
      .findOne({ $or: [{ idTipoPago }, { codigo: idTipoPago }] })
      .lean();
    const pago = await armarCamposPago(body, tipoDoc, idTipoPago);
    if (!pago.esEfectivo && !pago.idCuentaBancaria) {
      return res.status(400).json({
        message: 'Indique la cuenta bancaria de la empresa donde ingresa el pago (transferencia, cheque, Nequi, etc.)',
      });
    }
    const urlSoporte = urlSoporteDesdeReq(req);
    const intangibleVal = validarPagoIntangibleIngreso(pago, urlSoporte);
    if (!intangibleVal.ok) return res.status(intangibleVal.status).json({ message: intangibleVal.message });

    const tipoIng = camposTipoIngreso(valTipo.tipo);
    const numRecibo = await siguienteNumComprobanteIngreso(req.idSede);
    const sesion = await exigirSesionAbierta(req.user?.sub, req.idSede);
    const username = req.user?.username || req.user?.sub || null;

    const ing = await Ingreso.create({
      numDoc: docTercero ? parseNumDoc(docTercero) : null,
      idLiquidacion: null,
      numRecibo,
      valor: toDec(v),
      ...tipoIng,
      ingresoCaja: true,
      concepto: conceptoTxt,
      recibiDe: recibidoTxt || 'Aportante caja',
      recibidoDe: recibidoTxt || 'Aportante caja',
      documentoTercero: docTercero || null,
      tipoPersona: ['natural', 'juridica'].includes(tipoPers) ? tipoPers : null,
      idTipoPago,
      formaPago: pago.formaPago,
      numTransferencia: pago.numTransferencia,
      numComprobante: pago.numComprobante,
      fechaTransferencia: pago.fechaTransferencia,
      bancoEmisor: pago.bancoEmisor,
      idBanco: pago.idBanco,
      idCuentaBancaria: pago.idCuentaBancaria,
      cuentaRecibe: pago.cuentaRecibe,
      urlSoporte,
      observaciones,
      fecha: fecha ? new Date(fecha) : new Date(),
      idSesion: sesion.idSesion,
      idSede: req.idSede,
      idUsuario: idUsuarioObjectIdDesdeReq(req),
      userAddReg: username,
    });

    const enriquecido = await enriquecer(ing.toObject());
    registrarCreacion(req, 'ingreso', ing, {
      resumen: `Ingreso caja ${tipoIng.tipoIngreso || idTipoIngreso} recibo #${numRecibo} por ${v}`,
    });
    res.status(201).json({ ...enriquecido, numRecibo });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message, code: e.code });
    next(e);
  }
};

exports.listarPorAlumno = async (req, res, next) => {
  try {
    const numDoc = numDocFromParams(req.params.numDoc);
    if (numDoc == null) return res.status(400).json({ message: 'numDoc inválido' });
    const filtro = await filtroIngresosAlumno(numDoc);
    const rows = await Ingreso.find(filtro).sort({ fecha: -1, createdAt: -1 }).lean();
    res.json(await listarIngresosEnriquecidos(rows));
  } catch (e) {
    next(e);
  }
};

async function listarIngresosEnriquecidos(rows) {
  const liqIds = idsLiquidacionFilas(rows);
  const liqs = liqIds.length
    ? await Liquidacion.find({ _id: { $in: liqIds } }).select('descripcion').lean()
    : [];
  const descrMap = Object.fromEntries(liqs.map((l) => [String(l._id), l.descripcion || '']));
  const numDocs = [...new Set(rows.map((r) => r.numDoc).filter((n) => n != null))];
  const alumnos = numDocs.length
    ? await DatosAlumno.find({ numDoc: { $in: numDocs } }).lean()
    : [];
  const alumnoMap = Object.fromEntries(alumnos.map((a) => [String(a.numDoc), a]));
  const out = [];
  for (const r of rows) {
    const e = await enriquecer(r);
    const esCaja = e.esIngresoCaja;
    const alumno = alumnoMap[String(r.numDoc)];
    const alumnoNombre = nombreAlumno(alumno) || null;
    const concepto = conceptoIngresoAlumno(r, e, descrMap);
    out.push({
      ...e,
      alumnoNombre,
      liquidacionDescr: concepto,
      pagadorDescr: esCaja ? e.recibiDe || e.recibidoDe : alumnoNombre || e.recibiDe || null,
      conceptoLabel: concepto,
    });
  }
  return out;
}

function rangoFechaQuery(desde, hasta, campo = 'fecha') {
  const f = {};
  if (desde) {
    const d = new Date(String(desde).trim());
    if (!Number.isNaN(d.getTime())) f.$gte = d;
  }
  if (hasta) {
    const h = new Date(String(hasta).trim());
    if (!Number.isNaN(h.getTime())) {
      h.setHours(23, 59, 59, 999);
      f.$lte = h;
    }
  }
  return Object.keys(f).length ? { [campo]: f } : null;
}

exports.listarTodos = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const docRaw = String(req.query.numDoc || req.query.doc || '').trim();
    const idSesionQ = req.query.idSesion;
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const limit = Math.min(2000, Math.max(1, Number(req.query.limit) || 500));
    const and = [];

    const rango = rangoFechaQuery(req.query.desde, req.query.hasta, 'fecha');
    if (rango) and.push(rango);

    if (req.idSede) and.push({ idSede: req.idSede });

    if (idSesionQ != null && idSesionQ !== '') {
      const sid = Number(idSesionQ);
      if (Number.isFinite(sid)) and.push({ idSesion: sid });
    }

    const ndDoc = docRaw ? parseNumDoc(docRaw) : null;
    if (ndDoc != null) {
      and.push(numDocQuery(ndDoc));
    } else if (q) {
      const ndQ = parseNumDoc(q);
      if (ndQ != null && /^\d+$/.test(q.replace(/\D/g, ''))) {
        and.push(numDocQuery(ndQ));
      } else if (q.length >= 2) {
        const numDocs = await buscarNumDocsAlumno(DatosAlumno, q);
        const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(esc, 'i');
        const liqs = await Liquidacion.find({ descripcion: re }).select('_id').limit(300).lean();
        const liqIds = liqs.map((l) => l._id);
        const or = [
          { numRecibo: re },
          { concepto: re },
          { recibiDe: re },
          { recibidoDe: re },
          { observaciones: re },
          { tipoIngreso: re },
          { documentoTercero: re },
          { numTransferencia: re },
          { numComprobante: re },
        ];
        if (numDocs.length) or.push({ numDoc: { $in: numDocs } });
        if (liqIds.length) or.push({ idLiquidacion: { $in: liqIds } });
        and.push({ $or: or });
      }
    }

    const filter = and.length ? { $and: and } : {};
    const [total, rows] = await Promise.all([
      Ingreso.countDocuments(filter),
      Ingreso.find(filter).sort({ fecha: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    const items = await listarIngresosEnriquecidos(rows);
    const totalValor = items.reduce((a, i) => a + num(i.valor), 0);
    res.json({ items, total, skip, limit, totalValor });
  } catch (e) {
    next(e);
  }
};

exports.listarPorSesion = async (req, res, next) => {
  try {
    const idSesion = Number(req.params.idSesion);
    if (!Number.isFinite(idSesion)) return res.status(400).json({ message: 'idSesion inválido' });
    const rows = await Ingreso.find({ idSesion }).sort({ fecha: -1, createdAt: -1 }).lean();
    res.json(await listarIngresosEnriquecidos(rows));
  } catch (e) {
    next(e);
  }
};

exports.listarPorLiquidacion = async (req, res, next) => {
  try {
    const idLiq = req.params.idLiquidacion;
    const rows = await Ingreso.find({ idLiquidacion: idLiq }).sort({ fecha: -1 }).lean();
    res.json(await listarIngresosEnriquecidos(rows));
  } catch (e) {
    next(e);
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    const ing = await Ingreso.findById(req.params.id);
    if (!ing) return res.status(404).json({ message: 'Ingreso no encontrado' });
    if (esComprobanteAnulado(ing)) {
      return res.status(409).json({ message: 'Este ingreso ya está anulado.' });
    }
    const antesIngreso = ing.toObject();

    const auth = await autorizarAnulacionComprobante(
      req,
      ing.idSesion,
      'Anular ingresos requiere autorización de un administrador.',
    );
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.message, code: auth.code });
    }
    const supervisor = auth.supervisor;

    const v =
      num(antesIngreso.valor) ||
      num(antesIngreso.valorAnulado) ||
      (Array.isArray(antesIngreso.detalle) && antesIngreso.detalle.length
        ? antesIngreso.detalle.reduce((a, d) => a + num(d.valor), 0)
        : 0);
    const liqIds = idsLiquidacionDeIngreso(antesIngreso);

    // No se borra: pasa a estado ANULADO con valores en cero, conservando el
    // consecutivo (numRecibo) y los datos de origen para auditoría.
    const motivo = String(req.body?.motivo || req.body?.motivoAnulacion || '').trim() || null;
    ing.set(metadatosAnulacion(req, supervisor, { valorOriginal: v, motivo }));
    ing.valor = toDec(0);
    if (Array.isArray(ing.detalle) && ing.detalle.length) {
      ing.detalle = ing.detalle.map((d) => {
        const plano = typeof d.toObject === 'function' ? d.toObject() : d;
        return { ...plano, valor: toDec(0) };
      });
    }
    ing.tipoAbono = undefined;
    ing.userChangeRecord = req.user?.username || 'sistema';
    ing.fechaMod = new Date();
    await ing.save();

    // Restaura saldo en cada servicio/ítem: recalcula abonado solo con ingresos
    // vigentes (anulados aportan 0) para que el servicio quede cobrable de nuevo.
    const mats = new Set();
    for (const idLiq of liqIds) {
      const r = await recalcularAbonoLiquidacion(idLiq);
      if (r?.idMat) mats.add(String(r.idMat));
    }
    for (const idMat of mats) {
      await refrescarPagoMatricula(idMat);
    }

    try {
      const { revertirCertificadosPorAnulacionIngreso } = require('../services/certificadoPagoAuto');
      await revertirCertificadosPorAnulacionIngreso({
        idsLiquidacion: liqIds,
        req,
        supervisor,
        numDoc: ing.numDoc,
      });
    } catch (errCert) {
      console.error('[certificadoPagoAuto] revertir por anulación ingreso:', errCert?.message || errCert);
    }

    if (ing.cuadreDescuadre && ing.idSesion) {
      const CajaSesion = require('../models/CajaSesion');
      const { toDec } = require('../utils/coerceTypes');
      const ses = await CajaSesion.findOne({ idSesion: Number(ing.idSesion) }).lean();
      if (ses?.efectivoContado != null) {
        const nuevoContado = Math.max(0, num(ses.efectivoContado) - v);
        await CajaSesion.updateOne(
          { idSesion: Number(ing.idSesion) },
          { $set: { efectivoContado: toDec(nuevoContado) } },
        );
      }
    }

    if (ing.idSesion) {
      const { sincronizarDescuadreSesion } = require('../services/descuadreCaja');
      await sincronizarDescuadreSesion(ing.idSesion).catch(() => null);
    }
    registrarEliminacion(req, 'ingreso', antesIngreso, {
      resumen: `Anulación ingreso ${antesIngreso.numRecibo || req.params.id}${sufijoAutoriza(supervisor)}`,
    });
    res.json({ ok: true, estado: 'ANULADO' });
  } catch (e) {
    next(e);
  }
};
