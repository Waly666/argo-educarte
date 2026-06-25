const mongoose = require('mongoose');
const Ingreso = require('../models/Ingreso');
const Liquidacion = require('../models/Liquidacion');
const DatosAlumno = require('../models/DatosAlumno');
const { parseNumDoc, numDocQuery, numDocEquals } = require('../utils/numDoc');
const { crearMatriculaDesdeBody } = require('./matriculaCreator');
const { refrescarPagoMatricula } = require('./liquidacionMatricula');
const { obtenerConfigMigracion } = require('./configMigracion');
const { tieneAlguno, permisosParaRol } = require('./rolesPermisos');
const { esAdmin } = require('../utils/roles');

const PERMISO_MOVIMIENTOS = 'migracion.movimientos';

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

function nombreAlumno(a) {
  if (!a) return '';
  return [a.nombre1, a.nombre2, a.apellido1, a.apellido2].filter(Boolean).join(' ').trim();
}

async function puedeUsarMigracionMovimientos(usuario) {
  if (!usuario) return { habilitado: false, puedeUsar: false, motivo: 'no_autenticado' };
  const cfg = await obtenerConfigMigracion();
  if (!cfg.movimientosHabilitados) {
    return { habilitado: false, puedeUsar: false, motivo: 'deshabilitado', ...cfg };
  }
  const permisos = await permisosParaRol(usuario.rol);
  const ok = esAdmin(usuario.rol) || tieneAlguno(permisos, [PERMISO_MOVIMIENTOS]);
  return {
    ...cfg,
    habilitado: cfg.movimientosHabilitados,
    puedeUsar: ok,
    motivo: ok ? null : 'sin_permiso',
  };
}

async function assertMigracionMovimientos(usuario) {
  const st = await puedeUsarMigracionMovimientos(usuario);
  if (!st.habilitado) {
    const err = new Error(
      'Los movimientos de migración están deshabilitados. Actívelos en Configuración → Migración.',
    );
    err.status = 403;
    err.code = 'MIGRACION_MOVIMIENTOS_DESHABILITADA';
    throw err;
  }
  if (!st.puedeUsar) {
    const err = new Error('No tiene permiso para registrar movimientos de migración.');
    err.status = 403;
    err.code = 'MIGRACION_SIN_PERMISO';
    throw err;
  }
  return st;
}

async function crearMatriculaHistorica(body, idSede, ctx = {}) {
  await assertMigracionMovimientos(ctx.usuario);
  const fechaMat = body?.fechaMat ? new Date(body.fechaMat) : null;
  if (!fechaMat || Number.isNaN(fechaMat.getTime())) {
    const err = new Error('fechaMat es obligatoria para matrícula histórica');
    err.status = 400;
    throw err;
  }
  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);
  if (fechaMat > hoy) {
    const err = new Error('La fecha de matrícula histórica no puede ser futura');
    err.status = 400;
    throw err;
  }
  return crearMatriculaDesdeBody(body, idSede, {
    ...ctx,
    modoMigracion: true,
    usuario: ctx.usuario,
  });
}

async function registrarPagoMigracion(body, idSede, ctx = {}) {
  await assertMigracionMovimientos(ctx.usuario);
  const cfg = await obtenerConfigMigracion();

  const {
    numDoc: numDocRaw,
    idLiquidacion,
    items,
    valor,
    numRecibo: numReciboRaw,
    fecha,
    formaPago,
    observaciones,
    concepto,
  } = body || {};

  const numDoc = parseNumDoc(numDocRaw);
  if (numDoc == null) {
    const err = new Error('numDoc inválido');
    err.status = 400;
    throw err;
  }

  const itemsRaw =
    Array.isArray(items) && items.length
      ? items
      : idLiquidacion
        ? [{ idLiquidacion, valor }]
        : [];

  const pedidos = [];
  const vistos = new Set();
  for (const it of itemsRaw) {
    const idLiq = it?.idLiquidacion ? String(it.idLiquidacion) : '';
    const vit = Number(it?.valor);
    if (!idLiq || !(vit > 0)) {
      const err = new Error('Cada ítem requiere idLiquidacion y un valor mayor a 0');
      err.status = 400;
      throw err;
    }
    if (vistos.has(idLiq)) {
      const err = new Error('Hay ítems repetidos en el pago');
      err.status = 400;
      throw err;
    }
    vistos.add(idLiq);
    pedidos.push({ idLiquidacion: idLiq, valor: vit });
  }
  if (!pedidos.length) {
    const err = new Error('Indique al menos una liquidación a pagar');
    err.status = 400;
    throw err;
  }

  const liqDocs = [];
  for (const p of pedidos) {
    const liq = await Liquidacion.findById(p.idLiquidacion);
    if (!liq) {
      const err = new Error('Ítem de liquidación no encontrado');
      err.status = 404;
      throw err;
    }
    if (!numDocEquals(liq.numDoc, numDoc)) {
      const err = new Error('La liquidación no corresponde al alumno');
      err.status = 400;
      throw err;
    }
    const saldoActual = num(liq.saldo);
    if (p.valor > saldoActual + 0.0001) {
      const err = new Error(
        `El pago de «${liq.descripcion || 'ítem'}» excede el saldo (${saldoActual})`,
      );
      err.status = 400;
      throw err;
    }
    liqDocs.push({ liq, valor: p.valor, saldoActual });
  }

  const esMulti = liqDocs.length > 1;
  const total = liqDocs.reduce((a, x) => a + x.valor, 0);
  const alumno = await DatosAlumno.findOne(numDocQuery(numDoc)).lean();
  const recibiDe = body.recibiDe || body.recibidoDe || nombreAlumno(alumno) || String(numDoc);

  let numRecibo = String(numReciboRaw || '').trim();
  if (!numRecibo) {
    const sec = Date.now().toString(36).toUpperCase();
    numRecibo = `${cfg.prefijoRecibo}${sec}`;
  }

  const dup = await Ingreso.countDocuments({ numRecibo });
  if (dup > 0) {
    const err = new Error(`Ya existe un ingreso con el recibo ${numRecibo}`);
    err.status = 409;
    throw err;
  }

  const fechaPago = fecha ? new Date(fecha) : null;
  if (!fechaPago || Number.isNaN(fechaPago.getTime())) {
    const err = new Error('fecha del pago es obligatoria');
    err.status = 400;
    throw err;
  }
  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);
  if (fechaPago > hoy) {
    const err = new Error('La fecha del pago histórico no puede ser futura');
    err.status = 400;
    throw err;
  }

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

  const username = ctx.usuario?.username || ctx.usuario?.sub || 'sistema';
  const tipoAbonoGeneral = detalle.every((d) => d.tipoAbono === 'total') ? 'total' : 'abono';
  const conceptoFinal = concepto || (esMulti ? `Migración (${detalle.length} servicios)` : liqDocs[0].liq.descripcion || 'Pago migrado');

  let ing;
  try {
    ing = await Ingreso.create({
      numDoc,
      idLiquidacion: esMulti ? null : liqDocs[0].liq._id,
      detalle: esMulti ? detalle : undefined,
      numRecibo,
      valor: toDec(total),
      tipoAbono: tipoAbonoGeneral,
      concepto: conceptoFinal,
      idTipoPago: 'MIGRACION',
      idTipoIngreso: 'MIGRACION',
      tipoIngreso: 'MIGRACION',
      ingresoCaja: false,
      recibiDe,
      recibidoDe: recibiDe,
      formaPago: formaPago || undefined,
      observaciones: observaciones || 'Recibo de migración del sistema anterior',
      fecha: fechaPago,
      idSesion: null,
      idSede,
      idUsuario: ctx.usuario?.sub ? String(ctx.usuario.sub) : null,
      userAddReg: username,
      origenMigracion: true,
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
    if (a.liq.idMat || a.liq.idMatricula) {
      await refrescarPagoMatricula(a.liq.idMat || a.liq.idMatricula);
    }
  }

  return {
    ingreso: ing.toObject(),
    numRecibo,
    total,
    liquidaciones: aplicadas.map((a) => ({
      id: String(a.liq._id),
      descripcion: a.liq.descripcion,
      abonado: num(a.liq.abonado),
      saldo: num(a.liq.saldo),
      estado: a.liq.estado,
    })),
  };
}

/**
 * Aplica un ingreso migrado (Excel) a liquidaciones pendientes del alumno (FIFO).
 * Devuelve el ingreso actualizado con idLiquidacion/detalle.
 */
async function vincularPagoMigradoALiquidaciones(ingresoId) {
  const ing = await Ingreso.findById(ingresoId);
  if (!ing || ing.idLiquidacion || (Array.isArray(ing.detalle) && ing.detalle.length)) {
    return ing;
  }
  const numDoc = parseNumDoc(ing.numDoc);
  if (numDoc == null) return ing;

  let restante = num(ing.valor);
  if (!(restante > 0)) return ing;

  const liqs = await Liquidacion.find({
    ...numDocQuery(numDoc),
    saldo: { $gt: 0 },
  })
    .sort({ fechaCreacion: 1, createdAt: 1 })
    .lean();

  if (!liqs.length) return ing;

  const detalle = [];
  const mats = new Set();

  for (const l of liqs) {
    if (restante <= 0.0001) break;
    const saldo = num(l.saldo);
    if (saldo <= 0) continue;
    const aplicar = Math.min(restante, saldo);
    const liqDoc = await Liquidacion.findById(l._id);
    if (!liqDoc) continue;

    const nuevoAbonado = num(liqDoc.abonado) + aplicar;
    liqDoc.abonado = toDec(nuevoAbonado);
    liqDoc.saldo = toDec(num(liqDoc.valor) - nuevoAbonado);
    liqDoc.estado = estadoLiq(num(liqDoc.valor), nuevoAbonado);
    await liqDoc.save();

    detalle.push({
      idLiquidacion: liqDoc._id,
      descripcion: liqDoc.descripcion || '',
      valor: toDec(aplicar),
      tipoAbono: calcularTipoAbono(aplicar, saldo),
    });
    restante -= aplicar;
    if (liqDoc.idMat) mats.add(String(liqDoc.idMat));
    else if (liqDoc.idMatricula) mats.add(String(liqDoc.idMatricula));
  }

  if (!detalle.length) return ing;

  ing.idLiquidacion = detalle.length === 1 ? detalle[0].idLiquidacion : null;
  ing.detalle = detalle.length > 1 ? detalle : undefined;
  if (detalle.length === 1) {
    ing.idLiquidacion = detalle[0].idLiquidacion;
    ing.detalle = undefined;
  }
  await ing.save();

  for (const idMat of mats) {
    await refrescarPagoMatricula(idMat);
  }

  return ing;
}

module.exports = {
  PERMISO_MOVIMIENTOS,
  puedeUsarMigracionMovimientos,
  assertMigracionMovimientos,
  crearMatriculaHistorica,
  registrarPagoMigracion,
  vincularPagoMigradoALiquidaciones,
};
