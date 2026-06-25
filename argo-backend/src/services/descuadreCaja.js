const mongoose = require('mongoose');
const CajaDescuadre = require('../models/CajaDescuadre');
const CajaSesion = require('../models/CajaSesion');
const Empleado = require('../models/Empleado');
const Ingreso = require('../models/Ingreso');
const NovedadNomina = require('../models/NovedadNomina');
const PeriodoNomina = require('../models/PeriodoNomina');
const { models: cat } = require('../models/catalogos');
const { num, toDec } = require('../utils/coerceTypes');
const { maxNumericId, insertarCatalogo } = require('./programaServicio');
const { resolverPeriodoNomina } = require('./nominaAnticipo');
const { siguienteNumComprobanteIngreso } = require('./configRecibo');
const {
  esAprovisionamientoCaja,
  esOtrosIngresos,
  esTipoIngresoCajaDoc,
} = require('./tipoIngresoCaja');
const { formaPagoDesdeCatalogo } = require('./tipoIngresoResolver');
const { esAdmin } = require('../utils/roles');

const UMBRAL_COP = 1;

function planoDescuadre(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    ...o,
    efectivoEsperado: num(o.efectivoEsperado),
    efectivoContado: num(o.efectivoContado),
    diferencia: num(o.diferencia),
    montoDebe: num(o.montoDebe),
  };
}

function tieneDescuadreSignificativo(diferencia) {
  return diferencia != null && Number.isFinite(diferencia) && Math.abs(diferencia) >= UMBRAL_COP;
}

/** Faltante: contado menor que esperado → cajero debe */
function montoDebeCajero(diferencia) {
  const d = Number(diferencia) || 0;
  return d < -UMBRAL_COP ? Math.round(Math.abs(d)) : 0;
}

async function buscarEmpleadoPorUsuario(idUsuario) {
  if (!idUsuario) return null;
  const oid = mongoose.Types.ObjectId.isValid(idUsuario) ? new mongoose.Types.ObjectId(idUsuario) : null;
  if (!oid) return null;
  return Empleado.findOne({ idUsuario: oid }).lean();
}

async function resolverTipoIngresoCuadre() {
  const rows = await cat.tipoIngreso.find({}).lean();
  const reposicion = rows.find((t) => {
    const txt = `${t.tipo || ''} ${t.descripcion || ''}`.toUpperCase();
    return txt.includes('REPOSICION') && txt.includes('CAJA');
  });
  if (reposicion) return reposicion;
  return (
    rows.find((t) => esAprovisionamientoCaja(t)) ||
    rows.find((t) => esOtrosIngresos(t)) ||
    rows.find((t) => esTipoIngresoCajaDoc(t)) ||
    null
  );
}

async function resolverTipoPagoEfectivo() {
  const rows = await cat.catTipoPago.find({}).lean();
  const hit = rows.find((t) => {
    const txt = `${t.descripcion || ''} ${t.nombre || ''} ${t.codigo || ''}`.toLowerCase();
    return txt.includes('efect') || String(t.codigo || '').toUpperCase() === 'EF';
  });
  return hit || { idTipoPago: '1', descripcion: 'Efectivo' };
}

async function crearRegistroDescuadre({
  sesion,
  resumen,
  diferencia,
  efectivoContado,
  supervisor,
}) {
  const montoDebe = montoDebeCajero(diferencia);
  const empleado = await buscarEmpleadoPorUsuario(sesion.idUsuario);
  const sid = Number(sesion.idSesion);
  const now = new Date();

  const campos = {
    idUsuarioCajero: String(sesion.idUsuario || ''),
    usuarioCajero: sesion.usuario || null,
    empleadoId: empleado?.idEmpleado ?? null,
    efectivoEsperado: toDec(resumen.efectivoEsperado),
    efectivoContado: toDec(efectivoContado),
    diferencia: toDec(diferencia),
    montoDebe: toDec(montoDebe),
    autorizadoPor: supervisor?.autorizadoPor || null,
    nombreAutoriza: supervisor?.nombreAutoriza || null,
    autorizadoEn: supervisor?.autorizadoEn || now,
    fechaCierre: sesion.fechaCierre || now,
  };

  const existente = await CajaDescuadre.findOne({ idSesion: sid }).lean();
  let idDescuadre;

  if (existente) {
    idDescuadre = existente.idDescuadre;
    const estadoFinal =
      existente.estado === 'resuelto' || existente.estado === 'descontado_nomina'
        ? existente.estado
        : 'pendiente';
    await CajaDescuadre.updateOne(
      { idSesion: sid },
      {
        $set: {
          ...campos,
          estado: estadoFinal,
        },
      },
    );
  } else {
    idDescuadre = await maxNumericId(CajaDescuadre, 'idDescuadre');
    await insertarCatalogo(CajaDescuadre, {
      idDescuadre,
      idSesion: sid,
      ...campos,
      estado: 'pendiente',
    });
  }

  const descuadreDoc = await CajaDescuadre.findOne({ idDescuadre }).lean();
  const estadoSesion = descuadreDoc?.estado === 'pendiente' ? 'pendiente' : descuadreDoc?.estado || 'pendiente';

  await CajaSesion.updateOne(
    { idSesion: sid },
    {
      $set: {
        descuadreEstado: estadoSesion,
        descuadreMontoDebe: toDec(montoDebe),
        descuadreDiferencia: toDec(diferencia),
        idDescuadre,
        sinEmpleadoNomina: montoDebe > 0 && !empleado,
      },
    },
  );

  return planoDescuadre(descuadreDoc);
}

async function registrarIngresoCuadreDescuadre({
  idSesion,
  valor,
  idTipoPago,
  observaciones,
  user,
  idUsuario,
  rol,
}) {
  const sid = Number(idSesion);
  const sesion = await CajaSesion.findOne({ idSesion: sid, estado: 'cerrada' }).lean();
  if (!sesion) {
    const err = new Error('Sesión cerrada no encontrada');
    err.status = 404;
    throw err;
  }

  if (!esAdmin(rol) && String(sesion.idUsuario) !== String(idUsuario)) {
    const err = new Error('Solo puede cuadrar descuadres de sus propios cierres');
    err.status = 403;
    throw err;
  }

  const desc = await CajaDescuadre.findOne({ idSesion: sid, estado: 'pendiente' }).lean();
  if (!desc) {
    const err = new Error('Esta sesión no tiene un descuadre pendiente por cuadrar');
    err.status = 409;
    throw err;
  }

  const ingresoCuadrePrevio = await Ingreso.findOne({
    idSesion: sid,
    cuadreDescuadre: true,
  }).lean();
  if (ingresoCuadrePrevio) {
    const err = new Error(
      `Ya hay una reposición registrada (recibo ${ingresoCuadrePrevio.numRecibo || '—'}). Anúlela primero si fue un error.`,
    );
    err.status = 409;
    err.code = 'INGRESO_CUADRE_YA_EXISTE';
    throw err;
  }

  const v = Math.round(Number(valor) || 0);
  if (!(v > 0)) {
    const err = new Error('Indique un valor válido');
    err.status = 400;
    throw err;
  }

  const montoDebe = num(desc.montoDebe) || montoDebeCajero(num(desc.diferencia));
  if (v > montoDebe) {
    const err = new Error(`El valor no puede superar el faltante (${montoDebe.toLocaleString('es-CO')} COP)`);
    err.status = 400;
    throw err;
  }

  const tipoDoc = await cat.catTipoPago
    .findOne({ $or: [{ idTipoPago: idTipoPago || '1' }, { codigo: idTipoPago || '1' }] })
    .lean();
  const pagoEfectivo = idTipoPago
    ? formaPagoDesdeCatalogo(tipoDoc, idTipoPago) === 'Efectivo'
    : true;
  if (!pagoEfectivo) {
    const err = new Error('El ingreso de cuadre debe registrarse en efectivo');
    err.status = 400;
    throw err;
  }

  const tipoIngDoc = await resolverTipoIngresoCuadre();
  if (!tipoIngDoc) {
    const err = new Error('No hay tipo de ingreso de caja configurado (aprovisionamiento u otros)');
    err.status = 500;
    throw err;
  }

  const tipoPago = tipoDoc || (await resolverTipoPagoEfectivo());
  const idTipoPagoUse = String(tipoPago.idTipoPago ?? tipoPago.codigo ?? '1');
  const numRecibo = await siguienteNumComprobanteIngreso(sesion.idSede);
  const now = new Date();
  const tipoLabel = tipoIngDoc.tipo || tipoIngDoc.descripcion || 'REPOSICION CAJA';
  const concepto = `Reposición caja — sesión #${sid}`;

  const ing = await Ingreso.create({
    numRecibo,
    valor: toDec(v),
    idTipoIngreso: String(tipoIngDoc.idTipoIngreso ?? ''),
    tipoIngreso: tipoLabel,
    ingresoCaja: true,
    cuadreDescuadre: true,
    idSesionCuadre: sid,
    concepto,
    recibiDe: sesion.usuario || 'Cajero',
    recibidoDe: sesion.usuario || 'Cajero',
    idTipoPago: idTipoPagoUse,
    formaPago: 'Efectivo',
    observaciones: observaciones || `Reposición de efectivo para descuadre sesión #${sid}`,
    fecha: now,
    idSesion: sid,
    idSede: sesion.idSede || null,
    idUsuario: idUsuario ? String(idUsuario) : null,
    userAddReg: user || 'sistema',
  });

  const contadoPrev = num(sesion.efectivoContado);
  await CajaSesion.updateOne(
    { idSesion: sid },
    { $set: { efectivoContado: toDec(contadoPrev + v) } },
  );

  const verif = await sincronizarDescuadreSesion(sid);
  return {
    ingreso: { ...ing.toObject(), valor: v },
    descuadre: await obtenerPorSesion(sid),
    resuelto: verif?.resuelto === true,
  };
}

async function obtenerPorSesion(idSesion) {
  const d = await CajaDescuadre.findOne({ idSesion: Number(idSesion) }).lean();
  return planoDescuadre(d);
}

/** Recalcula diferencia/debe con los movimientos actuales (sin botón manual en UI). */
async function sincronizarDescuadreSesion(idSesion) {
  return verificarDescuadreResuelto(idSesion);
}

async function verificarDescuadreResuelto(idSesion) {
  const desc = await CajaDescuadre.findOne({
    idSesion: Number(idSesion),
    estado: 'pendiente',
  });
  if (!desc) return null;

  const sesion = await CajaSesion.findOne({ idSesion: Number(idSesion) }).lean();
  if (!sesion || sesion.estado !== 'cerrada') return null;

  const contado = num(sesion.efectivoContado);
  if (!Number.isFinite(contado)) return null;

  const { calcularResumenSesion } = require('./cajaSesion');
  const resumen = await calcularResumenSesion(sesion);
  const nuevaDif = contado - resumen.efectivoEsperado;

  if (!tieneDescuadreSignificativo(nuevaDif)) {
    const now = new Date();
    await CajaDescuadre.updateOne(
      { idDescuadre: desc.idDescuadre },
      {
        $set: {
          estado: 'resuelto',
          diferencia: toDec(nuevaDif),
          montoDebe: toDec(0),
          efectivoEsperado: toDec(resumen.efectivoEsperado),
          fechaResolucion: now,
          notaResolucion: 'Cuadre corregido tras ajuste de movimientos de la sesión',
          resueltoPor: 'sistema',
        },
      },
    );
    await CajaSesion.updateOne(
      { idSesion: Number(idSesion) },
      {
        $set: {
          descuadreEstado: 'resuelto',
          descuadreMontoDebe: toDec(0),
          descuadreDiferencia: toDec(nuevaDif),
        },
      },
    );
    if (desc.idNovedadNomina) {
      await NovedadNomina.deleteOne({
        idNovedad: desc.idNovedadNomina,
        codigoConcepto: 'DESCUADRE_CAJA',
        autoGenerada: true,
      });
    }
    return { resuelto: true, idSesion: Number(idSesion) };
  }

  const nuevoDebe = montoDebeCajero(nuevaDif);
  await CajaDescuadre.updateOne(
    { idDescuadre: desc.idDescuadre },
    {
      $set: {
        diferencia: toDec(nuevaDif),
        montoDebe: toDec(nuevoDebe),
        efectivoEsperado: toDec(resumen.efectivoEsperado),
      },
    },
  );
  await CajaSesion.updateOne(
    { idSesion: Number(idSesion) },
    {
      $set: {
        descuadreMontoDebe: toDec(nuevoDebe),
        descuadreDiferencia: toDec(nuevaDif),
      },
    },
  );
  return { resuelto: false, idSesion: Number(idSesion), diferencia: nuevaDif, montoDebe: nuevoDebe };
}

/**
 * Antes de liquidar nómina: recalcula descuadres pendientes del mes y genera
 * una deducción consolidada por empleado (solo lo aún no cuadrado).
 */
async function generarNovedadesDescuadrePorPeriodo(idPeriodo, user = 'sistema') {
  const periodo = await resolverPeriodoNomina(idPeriodo);
  const desde = new Date(periodo.fechaInicio);
  const hasta = new Date(periodo.fechaFin);
  hasta.setHours(23, 59, 59, 999);

  const pendientesMes = await CajaDescuadre.find({
    estado: 'pendiente',
    fechaCierre: { $gte: desde, $lte: hasta },
  }).lean();

  for (const d of pendientesMes) {
    await verificarDescuadreResuelto(d.idSesion);
  }

  await NovedadNomina.deleteMany({
    idPeriodo: periodo.idPeriodo,
    codigoConcepto: 'DESCUADRE_CAJA',
    autoGenerada: true,
  });

  await CajaDescuadre.updateMany(
    { idPeriodoNomina: periodo.idPeriodo, estado: 'en_nomina' },
    {
      $set: { estado: 'pendiente' },
      $unset: { idNovedadNomina: '', idPeriodoNomina: '' },
    },
  );

  const activos = await CajaDescuadre.find({
    estado: 'pendiente',
    fechaCierre: { $gte: desde, $lte: hasta },
  }).lean();

  const porEmpleado = new Map();
  for (const d of activos) {
    const debe = num(d.montoDebe) || montoDebeCajero(num(d.diferencia));
    if (!(debe > 0) || !d.empleadoId) continue;
    if (!porEmpleado.has(d.empleadoId)) {
      porEmpleado.set(d.empleadoId, { empleadoId: d.empleadoId, total: 0, sesiones: [], ids: [] });
    }
    const agg = porEmpleado.get(d.empleadoId);
    agg.total += debe;
    agg.sesiones.push(d.idSesion);
    agg.ids.push(d.idDescuadre);
  }

  const now = new Date();
  let novedadesCreadas = 0;
  const detalle = [];

  for (const [, agg] of porEmpleado) {
    const empleado = await Empleado.findOne({ idEmpleado: agg.empleadoId }).lean();
    if (!empleado) continue;

    const nombre = [empleado.nombre1, empleado.apellido1].filter(Boolean).join(' ').trim();
    const idNovedad = await maxNumericId(NovedadNomina, 'idNovedad');
    const desc = `Descuadres caja ${periodo.nombre} — sesiones #${agg.sesiones.join(', #')} — ${nombre} — total ${agg.total.toLocaleString('es-CO')}`;

    await insertarCatalogo(NovedadNomina, {
      idNovedad,
      empleadoId: agg.empleadoId,
      idPeriodo: periodo.idPeriodo,
      tipoNovedad: 'DESCUADRE_CAJA',
      codigoConcepto: 'DESCUADRE_CAJA',
      naturaleza: 'deduccion',
      descripcion: desc,
      valor: toDec(agg.total),
      fecha: now,
      autoGenerada: true,
      idsSesionesOrigen: agg.sesiones.map(String),
      estado: 'activo',
      createdAt: now,
      updatedAt: now,
      userAddReg: user,
      userChangeRecord: user,
    });

    await CajaDescuadre.updateMany(
      { idDescuadre: { $in: agg.ids } },
      {
        $set: {
          estado: 'en_nomina',
          idNovedadNomina: idNovedad,
          idPeriodoNomina: periodo.idPeriodo,
        },
      },
    );

    novedadesCreadas += 1;
    detalle.push({ empleadoId: agg.empleadoId, nombre, total: agg.total, sesiones: agg.sesiones, idNovedad });
  }

  if (periodo.estado === 'abierto') {
    await PeriodoNomina.updateOne(
      { idPeriodo: periodo.idPeriodo },
      { $set: { estado: 'novedades', updatedAt: now, userChangeRecord: user } },
    );
  }

  return {
    idPeriodo: periodo.idPeriodo,
    periodo: periodo.nombre,
    descuadresRevisados: pendientesMes.length,
    descuadresPendientes: activos.length,
    novedadesDescuadre: novedadesCreadas,
    detalle,
  };
}

async function marcarDescuadresPagadosEnPeriodo(idPeriodo) {
  const now = new Date();
  await CajaDescuadre.updateMany(
    { idPeriodoNomina: Number(idPeriodo), estado: 'en_nomina' },
    { $set: { estado: 'descontado_nomina', fechaResolucion: now, notaResolucion: 'Descontado en pago de nómina' } },
  );
}

async function listarDescuadres(opts = {}) {
  const filter = {};
  if (opts.estado) filter.estado = String(opts.estado);
  if (opts.idUsuario) filter.idUsuarioCajero = String(opts.idUsuario);
  if (opts.desde || opts.hasta) {
    filter.fechaCierre = {};
    if (opts.desde) filter.fechaCierre.$gte = new Date(opts.desde);
    if (opts.hasta) {
      const h = new Date(opts.hasta);
      h.setHours(23, 59, 59, 999);
      filter.fechaCierre.$lte = h;
    }
  }
  const rows = await CajaDescuadre.find(filter)
    .sort({ fechaCierre: -1 })
    .limit(Math.min(opts.limit || 100, 500))
    .lean();

  for (const r of rows) {
    if (r.estado === 'pendiente') {
      await sincronizarDescuadreSesion(r.idSesion).catch(() => null);
    }
  }

  if (rows.some((r) => r.estado === 'pendiente')) {
    const refreshed = await CajaDescuadre.find({
      _id: { $in: rows.map((r) => r._id) },
    })
      .sort({ fechaCierre: -1 })
      .lean();
    return refreshed.map(planoDescuadre);
  }

  return rows.map(planoDescuadre);
}

async function resumenMensual(mes) {
  const [y, m] = String(mes || '').split('-').map(Number);
  if (!y || !m) {
    const err = new Error('Indique mes en formato YYYY-MM');
    err.status = 400;
    throw err;
  }
  const desde = new Date(y, m - 1, 1);
  const hasta = new Date(y, m, 0, 23, 59, 59, 999);

  const rows = await CajaDescuadre.find({
    fechaCierre: { $gte: desde, $lte: hasta },
    $or: [{ montoDebe: { $gt: 0 } }, { diferencia: { $lt: 0 } }],
  }).lean();

  const porCajero = new Map();
  for (const r of rows) {
    const key = String(r.idUsuarioCajero || r.usuarioCajero || '—');
    if (!porCajero.has(key)) {
      porCajero.set(key, {
        idUsuarioCajero: r.idUsuarioCajero,
        usuarioCajero: r.usuarioCajero,
        empleadoId: r.empleadoId,
        cantidadDescuadres: 0,
        pendientes: 0,
        totalDebe: 0,
        totalPendiente: 0,
      });
    }
    const agg = porCajero.get(key);
    agg.cantidadDescuadres += 1;
    const debe = num(r.montoDebe) || montoDebeCajero(num(r.diferencia));
    agg.totalDebe += debe;
    if (r.estado === 'pendiente' || r.estado === 'en_nomina') {
      agg.pendientes += 1;
      agg.totalPendiente += debe;
    }
  }

  return {
    mes: `${y}-${String(m).padStart(2, '0')}`,
    desde,
    hasta,
    totalRegistros: rows.length,
    cajeros: [...porCajero.values()],
  };
}

module.exports = {
  UMBRAL_COP,
  tieneDescuadreSignificativo,
  montoDebeCajero,
  crearRegistroDescuadre,
  registrarIngresoCuadreDescuadre,
  obtenerPorSesion,
  verificarDescuadreResuelto,
  sincronizarDescuadreSesion,
  generarNovedadesDescuadrePorPeriodo,
  marcarDescuadresPagadosEnPeriodo,
  listarDescuadres,
  resumenMensual,
};
