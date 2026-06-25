const mongoose = require('mongoose');
const CajaSesion = require('../models/CajaSesion');
const CajaCierreGeneral = require('../models/CajaCierreGeneral');
const Ingreso = require('../models/Ingreso');
const Egreso = require('../models/Egreso');
const Usuario = require('../models/Usuario');
const { models: cat } = require('../models/catalogos');
const { num, toDec } = require('../utils/coerceTypes');
const { maxNumericId } = require('./programaServicio');
const { esAdmin } = require('../utils/roles');
const { esRetiroCajaTipo } = require('./tipoEgresoNomina');
const { formaPagoDesdeCatalogo } = require('./tipoIngresoResolver');
const { normalizarIdSede } = require('./sedeContext');
const { esSesionCajaVirtual } = require('./cajaVirtualDiaria');

function filtroIdSede(idSede) {
  const sid = normalizarIdSede(idSede);
  return sid ? { idSede: sid } : {};
}

function planoSesion(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    ...o,
    saldoInicial: num(o.saldoInicial),
    saldoFinal: o.saldoFinal != null ? num(o.saldoFinal) : null,
    efectivoContado: o.efectivoContado != null ? num(o.efectivoContado) : null,
    diferencia: o.diferencia != null ? num(o.diferencia) : null,
    descuadreEstado: o.descuadreEstado || null,
    descuadreMontoDebe: o.descuadreMontoDebe != null ? num(o.descuadreMontoDebe) : null,
    descuadreDiferencia: o.descuadreDiferencia != null ? num(o.descuadreDiferencia) : null,
    idDescuadre: o.idDescuadre ?? null,
    sinEmpleadoNomina: !!o.sinEmpleadoNomina,
  };
}

function clasificarEgresos(egresos, porTipoEgreso) {
  let totalGastos = 0;
  let totalRetiros = 0;
  for (const eg of egresos) {
    const v = num(eg.valorEgreso);
    const key = String(eg.tipoEgreso ?? '');
    const n = Number(key);
    const tipoDoc =
      porTipoEgreso.get(key) ||
      (Number.isFinite(n) ? porTipoEgreso.get(String(n)) : null) ||
      null;
    if (esRetiroCajaTipo(tipoDoc)) {
      totalRetiros += v;
    } else {
      totalGastos += v;
    }
  }
  return { totalGastos, totalRetiros };
}

function mapaTiposEgreso(tipos) {
  const porId = new Map();
  for (const t of tipos) {
    for (const k of [t.idTipoEgreso, t._id].filter((x) => x != null && x !== '').map(String)) {
      porId.set(k, t);
    }
    const n = Number(t.idTipoEgreso);
    if (Number.isFinite(n)) porId.set(String(n), t);
  }
  return porId;
}

function mapaTiposPago(tipos) {
  const porId = new Map();
  for (const t of tipos) {
    for (const k of [t.idTipoPago, t.codigo].filter(Boolean).map(String)) {
      porId.set(k, t);
    }
  }
  return porId;
}

function tipoPagoDoc(ing, porTipoPago) {
  const id = String(ing?.idTipoPago ?? '').trim();
  if (!id) return null;
  return porTipoPago.get(id) || null;
}

/** Forma de pago: prioriza catálogo idTipoPago (Nequi ≠ Transferencia). */
function resolverFormaPagoIngreso(ing, porTipoPago) {
  const tipo = tipoPagoDoc(ing, porTipoPago);
  const id = String(ing?.idTipoPago ?? '').trim();
  if (tipo) {
    const desc = String(tipo.descripcion || tipo.nombre || '').trim();
    if (desc) return desc;
    return formaPagoDesdeCatalogo(tipo, id);
  }
  const guardada = ing?.formaPago && String(ing.formaPago).trim();
  if (guardada) return guardada;
  return formaPagoDesdeCatalogo(null, id);
}

function resolverEtiquetaTipoPagoIngreso(ing, porTipoPago) {
  const tipo = tipoPagoDoc(ing, porTipoPago);
  const id = String(ing?.idTipoPago ?? '').trim();
  if (tipo) return tipo.descripcion || tipo.nombre || id;
  return ing?.tipoPagoDescr || id || '—';
}

function esIngresoEfectivo(ing, porTipoPago) {
  const fp = resolverFormaPagoIngreso(ing, porTipoPago);
  if (esFormaPagoEfectivo(fp)) return true;
  const id = String(ing.idTipoPago ?? '');
  const tipo = tipoPagoDoc(ing, porTipoPago);
  const txt = `${tipo?.descripcion || ''} ${tipo?.nombre || ''} ${tipo?.codigo || ''} ${id}`.toLowerCase();
  return txt.includes('efect') || txt === 'ef' || id === '1';
}

function esFormaPagoEfectivo(forma) {
  const s = String(forma ?? '')
    .trim()
    .toLowerCase();
  return !s || s.includes('efect') || s === 'ef' || s === 'efectivo' || s === 'cash';
}

function esEgresoEfectivo(eg) {
  const fp = String(eg.formaPago || '').trim().toLowerCase();
  if (!fp) return true;
  return fp === 'efectivo' || fp.includes('efect');
}

async function sesionAbiertaUsuario(idUsuario, idSede) {
  if (!idUsuario) return null;
  const filter = { estado: 'abierta', idUsuario: String(idUsuario), ...filtroIdSede(idSede) };
  return CajaSesion.findOne(filter).sort({ fechaApertura: -1 }).lean();
}

async function listarSesionesAbiertas(idSede) {
  const filter = { estado: 'abierta', ...filtroIdSede(idSede) };
  const rows = await CajaSesion.find(filter).sort({ fechaApertura: -1 }).lean();
  return rows.map(planoSesion);
}

async function abrirSesion({ saldoInicial, observaciones, usuario, idUsuario, user, rol, idSede }) {
  if (!idUsuario) {
    const err = new Error('Usuario no identificado para abrir caja');
    err.status = 400;
    throw err;
  }
  const sid = normalizarIdSede(idSede);
  if (!sid) {
    const err = new Error('Debe seleccionar la sede para abrir caja');
    err.status = 428;
    err.code = 'SEDE_REQUERIDA';
    throw err;
  }

  const abiertaPropia = await sesionAbiertaUsuario(idUsuario, sid);
  if (abiertaPropia) {
    const err = new Error(
      `Ya tiene su caja abierta (sesión #${abiertaPropia.idSesion}). Ciérrela antes de abrir otra.`,
    );
    err.status = 409;
    throw err;
  }

  const idSesion = await maxNumericId(CajaSesion, 'idSesion');
  const now = new Date();
  const doc = {
    idSesion,
    idSede: sid,
    estado: 'abierta',
    usuario: usuario || user || 'sistema',
    idUsuario: String(idUsuario),
    rolCajero: rol ? String(rol) : null,
    nombreCaja: usuario || user || `Caja ${idUsuario}`,
    fechaApertura: now,
    saldoInicial: toDec(saldoInicial ?? 0),
    observacionesApertura: observaciones || null,
    fechaAudi: now,
    fechaMod: now,
    userAddReg: user || 'sistema',
    userChangeRecord: user || 'sistema',
  };
  const creada = await CajaSesion.create(doc);
  return planoSesion(creada);
}

async function agregarMovimientosSesion(idSesion) {
  const sid = Number(idSesion);
  const [ingresos, egresos] = await Promise.all([
    Ingreso.find({ idSesion: sid }).lean(),
    Egreso.find({ idSesion: sid }).lean(),
  ]);
  return { ingresos, egresos };
}

async function agruparIngresosPorTipo(ingresos) {
  const map = new Map();
  for (const ing of ingresos) {
    const key = String(ing.idTipoPago ?? 'sin_tipo');
    const prev = map.get(key) || { idTipoPago: key, cantidad: 0, total: 0 };
    prev.cantidad += 1;
    prev.total += num(ing.valor);
    map.set(key, prev);
  }
  const tipos = await cat.catTipoPago.find({}).lean();
  const porId = Object.fromEntries(tipos.map((t) => [String(t.idTipoPago ?? t.codigo), t]));
  return [...map.values()].map((row) => {
    const t = porId[row.idTipoPago];
    return {
      idTipoPago: row.idTipoPago,
      descripcion: t?.descripcion || t?.nombre || row.idTipoPago,
      cantidad: row.cantidad,
      total: row.total,
    };
  });
}

async function agruparEgresosPorFormaPago(egresos) {
  const map = new Map();
  for (const eg of egresos) {
    const key = String(eg.formaPago || 'Efectivo').trim() || 'Efectivo';
    const prev = map.get(key) || { formaPago: key, cantidad: 0, total: 0 };
    prev.cantidad += 1;
    prev.total += num(eg.valorEgreso);
    map.set(key, prev);
  }
  return [...map.values()].map((row) => ({
    formaPago: row.formaPago,
    descripcion: row.formaPago,
    cantidad: row.cantidad,
    total: row.total,
  }));
}

async function agruparEgresosPorTipo(egresos) {
  const map = new Map();
  for (const eg of egresos) {
    const key = String(eg.tipoEgreso ?? 'sin_tipo');
    const prev = map.get(key) || { tipoEgreso: key, cantidad: 0, total: 0 };
    prev.cantidad += 1;
    prev.total += num(eg.valorEgreso);
    map.set(key, prev);
  }
  const tipos = await cat.tipoEgreso.find({}).lean();
  const porId = Object.fromEntries(tipos.map((t) => [String(t.idTipoEgreso ?? t.id), t]));
  return [...map.values()].map((row) => {
    const t = porId[row.tipoEgreso];
    return {
      tipoEgreso: row.tipoEgreso,
      descripcion: t?.tipo || row.tipoEgreso,
      cantidad: row.cantidad,
      total: row.total,
    };
  });
}

function fusionarPorTipo(rows, keyField) {
  const map = new Map();
  for (const row of rows) {
    const key = String(row[keyField] ?? row.descripcion ?? 'sin_tipo');
    const prev = map.get(key) || {
      ...row,
      cantidad: 0,
      total: 0,
    };
    prev.cantidad += row.cantidad || 0;
    prev.total += row.total || 0;
    if (row.efectivo != null) prev.efectivo = (prev.efectivo || 0) + row.efectivo;
    if (row.otros != null) prev.otros = (prev.otros || 0) + row.otros;
    map.set(key, prev);
  }
  return [...map.values()];
}

function fusionarPorServicio(rows) {
  const normalizados = rows.map((r) => {
    const nombre = String(r.servicio || r.descripcion || 'Ingreso').trim() || 'Ingreso';
    return { ...r, servicio: nombre, descripcion: nombre };
  });
  return fusionarPorTipo(normalizados, 'servicio').sort((a, b) => b.total - a.total);
}

async function resolverNombreCajero(sesion) {
  if (!sesion?.idUsuario) return sesion?.usuario || 'Cajero';
  try {
    const u = await Usuario.findById(sesion.idUsuario).lean();
    if (u) {
      const nombre = [u.nombres, u.apellidos].filter(Boolean).join(' ').trim();
      if (nombre) return nombre;
    }
  } catch {
    /* ignore */
  }
  return sesion.usuario || 'Cajero';
}

function normalizarArqueo(arqueo) {
  if (!Array.isArray(arqueo)) return [];
  return arqueo
    .map((l) => ({
      denominacion: num(l.denominacion),
      cantidad: Math.max(0, Math.round(num(l.cantidad))),
      tipo: l.tipo === 'moneda' ? 'moneda' : 'billete',
      etiqueta: l.etiqueta || null,
      subtotal: num(l.denominacion) * Math.max(0, Math.round(num(l.cantidad))),
    }))
    .filter((l) => l.denominacion > 0);
}

function totalArqueo(arqueo) {
  return normalizarArqueo(arqueo).reduce((s, l) => s + num(l.subtotal), 0);
}

async function agruparIngresosPorServicio(ingresos, porTipoPago) {
  const Liquidacion = require('../models/Liquidacion');
  const liqIds = new Set();
  for (const i of ingresos) {
    if (i.idLiquidacion) liqIds.add(String(i.idLiquidacion));
    if (Array.isArray(i.detalle)) {
      for (const d of i.detalle) if (d.idLiquidacion) liqIds.add(String(d.idLiquidacion));
    }
  }
  const liqs = liqIds.size
    ? await Liquidacion.find({ _id: { $in: [...liqIds] } }).select('descripcion').lean()
    : [];
  const descrMap = Object.fromEntries(liqs.map((l) => [String(l._id), l.descripcion || '']));

  const tiposIng = await cat.tipoIngreso.find({}).lean();
  const porTipoIng = Object.fromEntries(
    tiposIng.map((t) => [String(t.idTipoIngreso ?? t.id ?? t.codigo), t]),
  );

  const map = new Map();
  const acumular = (servicio, valor, esEfectivo) => {
    const key = String(servicio).trim() || 'Ingreso';
    const prev = map.get(key) || {
      servicio: key,
      descripcion: key,
      cantidad: 0,
      total: 0,
      efectivo: 0,
      otros: 0,
    };
    prev.cantidad += 1;
    prev.total += valor;
    if (esEfectivo) prev.efectivo += valor;
    else prev.otros += valor;
    map.set(key, prev);
  };

  for (const ing of ingresos) {
    const efectivo = esIngresoEfectivo(ing, porTipoPago);
    // Comprobante multi-servicio: discrimina cada servicio del detalle.
    if (!ing.esIngresoCaja && Array.isArray(ing.detalle) && ing.detalle.length) {
      for (const d of ing.detalle) {
        const servicio =
          d.descripcion ||
          descrMap[String(d.idLiquidacion)] ||
          'Cobro matrícula / servicio';
        acumular(servicio, num(d.valor), efectivo);
      }
      continue;
    }
    let servicio = 'Ingreso';
    if (ing.esIngresoCaja) {
      const tid = String(ing.tipoIngreso ?? '');
      const tdoc = porTipoIng[tid];
      servicio = ing.concepto || tdoc?.tipo || tdoc?.descripcion || 'Ingreso de caja';
    } else {
      servicio =
        descrMap[String(ing.idLiquidacion)] ||
        ing.concepto ||
        ing.liquidacionDescr ||
        'Cobro matrícula / servicio';
    }
    acumular(servicio, num(ing.valor), efectivo);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

async function calcularResumenSesion(sesion) {
  const hasta = sesion.fechaCierre ? new Date(sesion.fechaCierre) : new Date();
  const { ingresos, egresos } = await agregarMovimientosSesion(sesion.idSesion);

  const tiposPago = await cat.catTipoPago.find({}).lean();
  const porTipoPago = mapaTiposPago(tiposPago);
  const tiposEgreso = await cat.tipoEgreso.find({}).lean();
  const porTipoEgreso = mapaTiposEgreso(tiposEgreso);

  let totalIngresos = 0;
  let totalIngresosEfectivo = 0;
  let totalIngresosElectronicos = 0;
  for (const ing of ingresos) {
    const v = num(ing.valor);
    if (ing.cuadreDescuadre) continue;
    totalIngresos += v;
    if (esIngresoEfectivo(ing, porTipoPago)) totalIngresosEfectivo += v;
    else totalIngresosElectronicos += v;
  }

  let totalEgresos = 0;
  let totalEgresosEfectivo = 0;
  const egresosEfectivo = [];
  for (const eg of egresos) {
    const v = num(eg.valorEgreso);
    totalEgresos += v;
    if (esEgresoEfectivo(eg)) {
      totalEgresosEfectivo += v;
      egresosEfectivo.push(eg);
    }
  }

  const { totalGastos, totalRetiros } = clasificarEgresos(egresosEfectivo, porTipoEgreso);
  const saldoInicial = num(sesion.saldoInicial);
  const saldoTeorico = saldoInicial + totalIngresos - totalEgresos;
  const efectivoEsperado = saldoInicial + totalIngresosEfectivo - totalEgresosEfectivo;

  const ingresosPorTipo = await agruparIngresosPorTipo(ingresos);
  const ingresosPorServicio = await agruparIngresosPorServicio(ingresos, porTipoPago);
  const egresosPorTipo = await agruparEgresosPorTipo(egresos);
  const egresosPorFormaPago = await agruparEgresosPorFormaPago(egresos);
  const nombreCajero = await resolverNombreCajero(sesion);

  return {
    idSesion: sesion.idSesion,
    usuario: sesion.usuario,
    nombreCajero,
    idUsuario: sesion.idUsuario,
    nombreCaja: sesion.nombreCaja || sesion.usuario,
    estado: sesion.estado,
    fechaApertura: sesion.fechaApertura,
    fechaCierre: sesion.fechaCierre || hasta,
    saldoInicial,
    ventasBrutas: totalIngresos,
    totalIngresos,
    totalIngresosEfectivo,
    totalIngresosElectronicos,
    totalEgresos,
    totalEgresosEfectivo,
    totalGastos,
    totalRetiros,
    saldoTeorico,
    efectivoEsperado,
    cantidadIngresos: ingresos.length,
    cantidadRecibos: ingresos.length,
    cantidadEgresos: egresos.length,
    ingresosPorTipo,
    ingresosPorServicio,
    egresosPorTipo,
    egresosPorFormaPago,
  };
}

async function cerrarSesion(
  idSesion,
  { observaciones, efectivoContado, arqueo, user, idUsuario, rol, supervisor },
) {
  const sesion = await CajaSesion.findOne({ idSesion: Number(idSesion), estado: 'abierta' });
  if (!sesion) {
    const err = new Error('No hay sesión de caja abierta con ese id');
    err.status = 404;
    throw err;
  }

  const admin = esAdmin(rol);
  if (!admin && String(sesion.idUsuario) !== String(idUsuario)) {
    const err = new Error('Solo puede cerrar su propia caja');
    err.status = 403;
    throw err;
  }

  const resumen = await calcularResumenSesion(sesion);
  const arqueoNorm = normalizarArqueo(arqueo);
  const totalArqueoVal = arqueoNorm.length ? totalArqueo(arqueoNorm) : null;
  let contado = efectivoContado != null ? Number(efectivoContado) : null;
  if ((contado == null || !Number.isFinite(contado)) && totalArqueoVal != null) {
    contado = totalArqueoVal;
  }
  const diferencia =
    contado != null && Number.isFinite(contado) ? contado - resumen.efectivoEsperado : null;
  if (contado != null && Number.isFinite(contado)) {
    resumen.efectivoContado = contado;
    resumen.diferencia = diferencia;
  }
  if (arqueoNorm.length) {
    resumen.arqueo = arqueoNorm;
    resumen.arqueoTotal = totalArqueoVal;
  }
  const now = new Date();
  const {
    tieneDescuadreSignificativo,
    crearRegistroDescuadre,
  } = require('./descuadreCaja');

  const sesionParaDescuadre = {
    ...planoSesion(sesion),
    fechaCierre: now,
  };

  let descuadre = null;
  if (tieneDescuadreSignificativo(diferencia)) {
    descuadre = await crearRegistroDescuadre({
      sesion: sesionParaDescuadre,
      resumen,
      diferencia,
      efectivoContado: contado,
      supervisor,
    });
    resumen.descuadre = descuadre;
    resumen.alertaDescuadre = true;
  }

  sesion.estado = 'cerrada';
  sesion.fechaCierre = now;
  sesion.saldoFinal = toDec(resumen.efectivoEsperado);
  sesion.efectivoContado = contado != null && Number.isFinite(contado) ? toDec(contado) : null;
  sesion.diferencia = diferencia != null ? toDec(diferencia) : null;
  sesion.observacionesCierre = observaciones || null;
  sesion.resumen = resumen;
  sesion.fechaMod = now;
  sesion.userChangeRecord = user || 'sistema';
  if (descuadre) {
    sesion.descuadreEstado = descuadre.estado || 'pendiente';
    sesion.descuadreMontoDebe = descuadre.montoDebe != null ? toDec(descuadre.montoDebe) : null;
    sesion.descuadreDiferencia = descuadre.diferencia != null ? toDec(descuadre.diferencia) : null;
    sesion.idDescuadre = descuadre.idDescuadre ?? null;
  }
  await sesion.save();

  const sesionPlana = planoSesion(sesion);
  return { sesion: { ...sesionPlana, descuadreEstado: descuadre?.estado || null }, resumen, descuadre };
}

async function reabrirSesion(idSesion, { user, rol, observaciones }) {
  if (!esAdmin(rol)) {
    const err = new Error('Solo un administrador puede reabrir un cierre de caja');
    err.status = 403;
    throw err;
  }

  const sesion = await CajaSesion.findOne({ idSesion: Number(idSesion) });
  if (!sesion) {
    const err = new Error('Sesión no encontrada');
    err.status = 404;
    throw err;
  }
  if (sesion.estado !== 'cerrada') {
    const err = new Error(
      sesion.estado === 'abierta' ? 'La caja ya está abierta' : 'La sesión no está cerrada',
    );
    err.status = 409;
    throw err;
  }

  const otraAbierta = await sesionAbiertaUsuario(sesion.idUsuario);
  if (otraAbierta && Number(otraAbierta.idSesion) !== Number(idSesion)) {
    const err = new Error(
      `El cajero tiene otra caja abierta (sesión #${otraAbierta.idSesion}). Ciérrela antes de reabrir esta.`,
    );
    err.status = 409;
    err.code = 'CAJA_ABIERTA_CAJERO';
    throw err;
  }

  const now = new Date();
  const notaReapertura = [
    sesion.observacionesCierre,
    observaciones,
    `Reabierta por admin ${user || 'sistema'} el ${now.toISOString()}`,
  ]
    .filter(Boolean)
    .join(' | ');

  sesion.estado = 'abierta';
  sesion.fechaCierreAnterior = sesion.fechaCierre || null;
  sesion.fechaCierre = null;
  sesion.fechaReapertura = now;
  sesion.observacionesCierre = notaReapertura;
  sesion.fechaMod = now;
  sesion.userChangeRecord = user || 'sistema';
  await sesion.save();

  return planoSesion(sesion);
}

async function obtenerSesionActiva(idUsuario, idSede) {
  const s = await sesionAbiertaUsuario(idUsuario, idSede);
  return planoSesion(s);
}

async function listarSesiones(opts = {}) {
  const limit = Math.min(Number(opts.limit) || 50, 200);
  const filter = { ...filtroIdSede(opts.idSede) };

  if (opts.estado) filter.estado = String(opts.estado);
  if (opts.usuario) filter.usuario = new RegExp(String(opts.usuario).trim(), 'i');
  if (opts.idUsuario) filter.idUsuario = String(opts.idUsuario);
  if (opts.soloMias && opts.idUsuario) filter.idUsuario = String(opts.idUsuario);

  const campoFecha = opts.porCierre ? 'fechaCierre' : 'fechaApertura';
  if (opts.desde || opts.hasta) {
    filter[campoFecha] = {};
    if (opts.desde) filter[campoFecha].$gte = new Date(opts.desde);
    if (opts.hasta) {
      const h = new Date(opts.hasta);
      h.setHours(23, 59, 59, 999);
      filter[campoFecha].$lte = h;
    }
  }

  const sortField = opts.porCierre ? { fechaCierre: -1 } : { fechaApertura: -1 };
  const rows = await CajaSesion.find(filter).sort(sortField).limit(limit).lean();
  return rows.map(planoSesion);
}

async function exigirSesionAbierta(idUsuario, idSede) {
  const s = await sesionAbiertaUsuario(idUsuario, idSede);
  if (!s) {
    const err = new Error('Debe abrir su caja en esta sede antes de registrar movimientos');
    err.status = 428;
    err.code = 'CAJA_CERRADA';
    throw err;
  }
  return s;
}

async function verificarMovimientoSesionCajero(req, idSesion) {
  if (esAdmin(req.user?.rol)) return { ok: true };
  if (idSesion == null || idSesion === '') {
    return {
      ok: false,
      status: 403,
      message: 'Este movimiento no está vinculado a su sesión de caja actual',
    };
  }
  const sesion = await sesionAbiertaUsuario(req.user?.sub);
  if (!sesion) {
    return {
      ok: false,
      status: 428,
      message: 'Debe tener su caja abierta para modificar o anular movimientos',
      code: 'CAJA_CERRADA',
    };
  }
  if (Number(sesion.idSesion) !== Number(idSesion)) {
    return {
      ok: false,
      status: 403,
      message: 'Solo puede modificar o anular movimientos de su sesión de caja actual',
    };
  }
  return { ok: true };
}

/** Admin puede anular sin re-auth solo movimientos de su sesión abierta actual. */
async function requiereAutorizacionAnularMovimiento(req, idSesion) {
  if (!esAdmin(req.user?.rol)) return false;
  const abierta = await sesionAbiertaUsuario(req.user?.sub);
  if (!abierta) return true;
  if (idSesion == null || idSesion === '') return true;
  return Number(abierta.idSesion) !== Number(idSesion);
}

const HORA_CORTE_TURNO = 14;

function normalizarFechaDia(input) {
  if (!input) return new Date().toISOString().slice(0, 10);
  const s = String(input).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const err = new Error('Fecha inválida (use YYYY-MM-DD)');
    err.status = 400;
    throw err;
  }
  return s;
}

function normalizarTurno(turno) {
  const t = String(turno || '')
    .trim()
    .toLowerCase()
    .replace(/[áàä]/g, 'a');
  if (['mediodia', 'medio_dia', 'medio-dia', 'am', 'manana', 'mañana'].includes(t)) return 'mediodia';
  if (['noche', 'pm', 'tarde', 'vespertino'].includes(t)) return 'noche';
  const err = new Error('Turno inválido. Use "mediodia" o "noche"');
  err.status = 400;
  throw err;
}

function etiquetaTurno(turno) {
  return turno === 'mediodia' ? 'Mediodía (hasta las 13:59)' : 'Noche (desde las 14:00)';
}

function rangoHorarioTurno(fechaDia, turno) {
  const d0 = new Date(`${fechaDia}T00:00:00`);
  const dMedioFin = new Date(`${fechaDia}T13:59:59.999`);
  const dNocheIni = new Date(`${fechaDia}T14:00:00.000`);
  const dNocheFin = new Date(`${fechaDia}T23:59:59.999`);
  if (turno === 'mediodia') return { desde: d0, hasta: dMedioFin };
  return { desde: dNocheIni, hasta: dNocheFin };
}

function sesionCierraEnTurno(fechaCierre, turno) {
  const fc = new Date(fechaCierre);
  if (Number.isNaN(fc.getTime())) return false;
  const mins = fc.getHours() * 60 + fc.getMinutes();
  const corte = HORA_CORTE_TURNO * 60;
  return turno === 'mediodia' ? mins < corte : mins >= corte;
}

/** Sesiones ya incluidas en cualquier cierre general registrado. */
async function idsSesionesEnCierresGenerales(idSede) {
  const filter = idSede ? { idSede: normalizarIdSede(idSede) } : {};
  const rows = await CajaCierreGeneral.find(filter, { idsSesiones: 1 }).lean();
  const ids = new Set();
  for (const r of rows) {
    for (const id of r.idsSesiones || []) ids.add(Number(id));
  }
  return [...ids];
}

function diaCalendarioSesion(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function listarCajasAbiertasResumen(idSede) {
  const filter = { estado: 'abierta', ...filtroIdSede(idSede) };
  const rows = await CajaSesion.find(filter).select('idSesion usuario idSede tipoSesion excluirCierreGeneral').lean();
  return rows
    .filter((s) => !esSesionCajaVirtual(s))
    .map((s) => ({ idSesion: s.idSesion, usuario: s.usuario, idSede: s.idSede || null }));
}

/** Cajas cerradas por cajeros que aún no entraron en ningún cierre general (cualquier fecha). */
async function sesionesPendientesCierreGeneral(excluirIds = [], idSede) {
  const ex = new Set((excluirIds || []).map(Number));
  const filter = { estado: 'cerrada', fechaCierre: { $ne: null }, ...filtroIdSede(idSede) };
  const rows = await CajaSesion.find(filter).sort({ fechaCierre: 1 }).lean();
  return rows.filter((s) => !ex.has(Number(s.idSesion)) && !esSesionCajaVirtual(s));
}

async function sesionesEnPeriodo(desde, hasta, opts = {}) {
  const { soloCerradas = false, turno = null, fechaDia = null, excluirIds = [], idSede = null } = opts;
  const dia = fechaDia ? normalizarFechaDia(fechaDia) : null;
  const t = turno ? normalizarTurno(turno) : null;

  let d0 = new Date(desde);
  let d1 = new Date(hasta);
  if (soloCerradas && dia && t) {
    const rango = rangoHorarioTurno(dia, t);
    d0 = rango.desde;
    d1 = rango.hasta;
  } else {
    d1.setHours(23, 59, 59, 999);
  }

  const filter = {
    fechaApertura: { $lte: d1 },
    $or: [{ fechaCierre: { $gte: d0 } }, { estado: 'abierta' }],
    ...filtroIdSede(idSede),
  };
  if (soloCerradas) {
    delete filter.$or;
    filter.estado = 'cerrada';
    filter.fechaCierre = { $gte: d0, $lte: d1 };
  }

  let rows = await CajaSesion.find(filter).sort({ fechaApertura: 1 }).lean();
  if (soloCerradas && t) {
    rows = rows.filter((s) => sesionCierraEnTurno(s.fechaCierre, t));
  }
  if (excluirIds?.length) {
    const ex = new Set(excluirIds.map(Number));
    rows = rows.filter((s) => !ex.has(Number(s.idSesion)));
  }
  return rows.filter((s) => !esSesionCajaVirtual(s));
}

async function calcularCierreGeneral(fechaDiaInput, opts = {}) {
  const fechaDia = normalizarFechaDia(fechaDiaInput);
  const idSede = normalizarIdSede(opts.idSede);
  if (!idSede) {
    const err = new Error('Debe indicar la sede para el cierre general');
    err.status = 428;
    err.code = 'SEDE_REQUERIDA';
    throw err;
  }
  const excluirIds = opts.excluirIds ?? (await idsSesionesEnCierresGenerales(idSede));

  const sesionesRaw = opts.soloCerradas
    ? await sesionesPendientesCierreGeneral(excluirIds, idSede)
    : await sesionesEnPeriodo(fechaDia, fechaDia, {
        soloCerradas: true,
        excluirIds,
        idSede,
      });

  const cajasAbiertasGlobales = await listarCajasAbiertasResumen(idSede);
  let sesionesDiasAnteriores = 0;
  for (const s of sesionesRaw) {
    const dc = diaCalendarioSesion(s.fechaCierre);
    if (dc && dc !== fechaDia) sesionesDiasAnteriores += 1;
  }

  const detalleSesiones = [];
  let totalIngresos = 0;
  let totalEgresos = 0;
  let saldoInicialTotal = 0;
  let cantidadIngresos = 0;
  let cantidadEgresos = 0;
  const ingresosPorTipoRows = [];
  const ingresosPorServicioRows = [];
  const egresosPorTipoRows = [];
  const egresosPorFormaPagoRows = [];
  const egresosDetalle = [];
  const ingresosDetalle = [];
  const ingresosPorServicioDetalle = [];
  const descuadres = [];
  let totalEfectivoEsperado = 0;
  let totalEfectivoContado = 0;
  let totalDiferencia = 0;
  let cantidadDescuadres = 0;

  const tiposPagoCat = await cat.catTipoPago.find({}).lean();
  const porTipoPagoGlobal = mapaTiposPago(tiposPagoCat);

  for (const s of sesionesRaw) {
    let resumen =
      s.estado === 'cerrada' && s.resumen
        ? { ...s.resumen, estado: 'cerrada', usuario: s.usuario, idUsuario: s.idUsuario }
        : await calcularResumenSesion(s);
    if (!resumen.nombreCajero) {
      resumen = { ...resumen, nombreCajero: await resolverNombreCajero(s) };
    }

    const { ingresos, egresos } = await agregarMovimientosSesion(s.idSesion);
    let totalIngresosElectronicos = 0;
    for (const ing of ingresos) {
      if (ing.cuadreDescuadre) continue;
      const v = num(ing.valor);
      if (!esIngresoEfectivo(ing, porTipoPagoGlobal)) totalIngresosElectronicos += v;
    }
    resumen = { ...resumen, totalIngresosElectronicos };
    const egresosPorForma = await agruparEgresosPorFormaPago(egresos);
    egresosPorFormaPagoRows.push(...egresosPorForma);

    for (const row of resumen.ingresosPorServicio || []) {
      ingresosPorServicioDetalle.push({
        idSesion: s.idSesion,
        usuario: s.usuario,
        servicio: row.servicio || row.descripcion || 'Ingreso',
        total: num(row.total),
      });
    }

    for (const ing of ingresos) {
      const servicio =
        ing.esIngresoCaja
          ? ing.concepto || ing.tipoIngresoDescr || ing.tipoIngreso || 'Ingreso caja'
          : ing.liquidacionDescr || ing.tipoAbonoDescr || ing.concepto || 'Cobro';
      const formaPago = resolverFormaPagoIngreso(ing, porTipoPagoGlobal);
      ingresosDetalle.push({
        idSesion: s.idSesion,
        usuario: s.usuario,
        idIngreso: String(ing._id || ing.idIngreso || ''),
        numRecibo: ing.numRecibo || null,
        fecha: ing.fecha,
        servicio: String(servicio).trim() || 'Ingreso',
        formaPago,
        tipoPagoDescr: resolverEtiquetaTipoPagoIngreso(ing, porTipoPagoGlobal),
        idTipoPago: ing.idTipoPago ?? null,
        pagador: ing.pagadorDescr || ing.recibidoDe || ing.recibiDe || null,
        valor: num(ing.valor),
      });
    }

    for (const eg of egresos) {
      egresosDetalle.push({
        idSesion: s.idSesion,
        usuario: s.usuario,
        idEgreso: eg.idEgreso || String(eg._id || ''),
        numRecibo: eg.numRecibo || null,
        fechaEgreso: eg.fechaEgreso,
        concepto: eg.concepto,
        valorEgreso: num(eg.valorEgreso),
        formaPago: eg.formaPago || 'Efectivo',
        tipoEgresoDescr: eg.tipoEgresoDescr || null,
        pagueA: eg.pagueA || null,
      });
    }

    detalleSesiones.push(resumen);

    totalIngresos += resumen.totalIngresos;
    totalEgresos += resumen.totalEgresos;
    saldoInicialTotal += resumen.saldoInicial;
    cantidadIngresos += resumen.cantidadIngresos;
    cantidadEgresos += resumen.cantidadEgresos;
    ingresosPorTipoRows.push(...(resumen.ingresosPorTipo || []));
    ingresosPorServicioRows.push(...(resumen.ingresosPorServicio || []));
    egresosPorTipoRows.push(...(resumen.egresosPorTipo || []));

    totalEfectivoEsperado += num(resumen.efectivoEsperado);
    if (resumen.efectivoContado != null) totalEfectivoContado += num(resumen.efectivoContado);
    if (resumen.diferencia != null) totalDiferencia += num(resumen.diferencia);

    const dif = s.diferencia != null ? num(s.diferencia) : resumen.diferencia;
    if (s.estado === 'cerrada' && dif != null && Math.abs(dif) >= 1) {
      cantidadDescuadres += 1;
      descuadres.push({
        idSesion: s.idSesion,
        usuario: s.usuario,
        efectivoEsperado: num(resumen.efectivoEsperado),
        efectivoContado: resumen.efectivoContado != null ? num(resumen.efectivoContado) : num(s.efectivoContado),
        diferencia: dif,
        montoDebe: dif < 0 ? Math.abs(dif) : 0,
        estado: s.descuadreEstado || 'pendiente',
        fechaCierre: s.fechaCierre || resumen.fechaCierre,
      });
    }
  }

  const ingresosPorTipo = fusionarPorTipo(ingresosPorTipoRows, 'idTipoPago');
  const ingresosPorServicio = fusionarPorServicio(ingresosPorServicioRows);
  const egresosPorTipo = fusionarPorTipo(egresosPorTipoRows, 'tipoEgreso');
  const egresosPorFormaPago = fusionarPorTipo(egresosPorFormaPagoRows, 'formaPago');

  ingresosDetalle.sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());
  egresosDetalle.sort(
    (a, b) => new Date(a.fechaEgreso || 0).getTime() - new Date(b.fechaEgreso || 0).getTime(),
  );
  ingresosPorServicioDetalle.sort(
    (a, b) =>
      Number(a.idSesion) - Number(b.idSesion) ||
      String(a.servicio).localeCompare(String(b.servicio)),
  );

  const fechasCierre = sesionesRaw.map((s) => s.fechaCierre).filter(Boolean).map((f) => new Date(f));
  const dDia0 = new Date(`${fechaDia}T00:00:00`);
  const dDia1 = new Date(`${fechaDia}T23:59:59.999`);
  let periodoDesde = dDia0;
  let periodoHasta = dDia1;
  if (fechasCierre.length) {
    periodoDesde = new Date(Math.min(...fechasCierre.map((d) => d.getTime())));
    periodoHasta = new Date(Math.max(...fechasCierre.map((d) => d.getTime())));
  }

  return {
    fechaDia,
    idSede,
    periodoDesde,
    periodoHasta,
    cantidadCajas: detalleSesiones.length,
    sesionesDiasAnteriores,
    cajasAbiertas: cajasAbiertasGlobales,
    tieneCajasAbiertas: cajasAbiertasGlobales.length > 0,
    saldoInicialTotal,
    totalIngresos,
    totalEgresos,
    saldoTeoricoConsolidado: saldoInicialTotal + totalIngresos - totalEgresos,
    totalEfectivoEsperado,
    totalEfectivoContado,
    totalDiferencia,
    cantidadDescuadres,
    cantidadIngresos,
    cantidadEgresos,
    ingresosPorTipo,
    ingresosPorServicio,
    egresosPorTipo,
    egresosPorFormaPago,
    descuadres,
    ingresosDetalle,
    ingresosPorServicioDetalle,
    egresosDetalle,
    detalleSesiones,
    idsSesiones: detalleSesiones.map((d) => d.idSesion),
  };
}

async function cerrarSesionesMultiples(cierres, ctx) {
  if (!Array.isArray(cierres) || !cierres.length) {
    const err = new Error('Indique al menos una caja a cerrar');
    err.status = 400;
    throw err;
  }

  const resultados = [];
  for (const item of cierres) {
    const idSesion = Number(item.idSesion);
    const contado = item.efectivoContado != null ? Number(item.efectivoContado) : null;
    if (!Number.isFinite(idSesion)) {
      const err = new Error('idSesion inválido en cierre múltiple');
      err.status = 400;
      throw err;
    }
    if (contado == null || !Number.isFinite(contado)) {
      const err = new Error(`Indique el efectivo contado para la sesión #${idSesion}`);
      err.status = 400;
      throw err;
    }
    const r = await cerrarSesion(idSesion, {
      observaciones: item.observaciones,
      efectivoContado: contado,
      arqueo: item.arqueo,
      user: ctx.user,
      idUsuario: ctx.idUsuario,
      rol: ctx.rol,
      supervisor: ctx.supervisor,
    });
    resultados.push(r);
  }
  return resultados;
}

async function estadoCierresGeneralesDia(fechaDiaInput, idSede) {
  const fechaDia = normalizarFechaDia(fechaDiaInput);
  const sid = normalizarIdSede(idSede);
  if (!sid) {
    const err = new Error('Debe indicar la sede');
    err.status = 428;
    throw err;
  }
  const cierre = await CajaCierreGeneral.findOne({ fechaDia, idSede: sid }).lean();
  return {
    fechaDia,
    idSede: sid,
    cierre,
    registrado: !!cierre,
    puedeRegistrar: !cierre,
  };
}

async function registrarCierreGeneral({
  fechaDia,
  idSede,
  observaciones,
  usuarioAdmin,
  idUsuarioAdmin,
  forzar,
}) {
  const dia = normalizarFechaDia(fechaDia);
  const sid = normalizarIdSede(idSede);
  if (!sid) {
    const err = new Error('Debe indicar la sede para el cierre general');
    err.status = 428;
    err.code = 'SEDE_REQUERIDA';
    throw err;
  }

  const existente = await CajaCierreGeneral.findOne({ fechaDia: dia, idSede: sid }).lean();
  if (existente) {
    const err = new Error(
      `Ya existe el cierre general del ${dia} en esta sede (registro #${existente.idCierreGeneral}). Solo se permite uno por sede y día.`,
    );
    err.status = 409;
    err.code = 'CIERRE_GENERAL_YA_EXISTE';
    err.cierreExistente = existente;
    throw err;
  }

  const preview = await calcularCierreGeneral(dia, { soloCerradas: true, idSede: sid });

  if (!preview.cantidadCajas) {
    const err = new Error(
      'No hay cajas cerradas pendientes de cierre general. Verifique que los cajeros hayan cerrado su sesión.',
    );
    err.status = 400;
    throw err;
  }

  if (preview.tieneCajasAbiertas && !forzar) {
    const err = new Error(
      `Hay ${preview.cajasAbiertas.length} caja(s) aún abierta(s). Ciérrelas en «Cajas abiertas» antes del cierre general.`,
    );
    err.status = 409;
    err.code = 'CAJAS_ABIERTAS';
    err.cajasAbiertas = preview.cajasAbiertas;
    throw err;
  }

  const idCierreGeneral = await maxNumericId(CajaCierreGeneral, 'idCierreGeneral');
  const doc = await CajaCierreGeneral.create({
    idCierreGeneral,
    idSede: sid,
    fechaDia: dia,
    periodoDesde: preview.periodoDesde,
    periodoHasta: preview.periodoHasta,
    fechaRegistro: new Date(),
    usuarioAdmin,
    idUsuarioAdmin,
    observaciones: observaciones || null,
    idsSesiones: preview.idsSesiones,
    cantidadCajas: preview.cantidadCajas,
    resumen: preview,
    userAddReg: usuarioAdmin,
  });

  return { cierre: doc.toObject(), resumen: preview };
}

async function depurarCierresGenerales() {
  const r = await CajaCierreGeneral.deleteMany({});
  return { eliminados: r.deletedCount ?? 0 };
}

/**
 * Resumen para pantalla de cierre cerrado: cuadre (esperado/contado/diferencia) congelado al cierre;
 * listas de movimientos recalculadas. Si hay descuadre pendiente, el cuadre refleja la gestión actual.
 */
async function resumenVistaSesion(sesion, { descuadre = null } = {}) {
  const live = await calcularResumenSesion(sesion);
  if (sesion.estado !== 'cerrada') return live;

  const snap = sesion.resumen && typeof sesion.resumen === 'object' ? sesion.resumen : null;

  const efectivoEsperadoCierre =
    snap?.efectivoEsperado != null
      ? num(snap.efectivoEsperado)
      : sesion.saldoFinal != null
        ? num(sesion.saldoFinal)
        : live.efectivoEsperado;

  const efectivoContado =
    sesion.efectivoContado != null
      ? num(sesion.efectivoContado)
      : snap?.efectivoContado != null
        ? num(snap.efectivoContado)
        : null;

  let diferencia =
    sesion.diferencia != null
      ? num(sesion.diferencia)
      : snap?.diferencia != null
        ? num(snap.diferencia)
        : efectivoContado != null
          ? efectivoContado - efectivoEsperadoCierre
          : null;

  if (descuadre?.estado === 'pendiente') {
    const esp = descuadre.efectivoEsperado != null ? num(descuadre.efectivoEsperado) : live.efectivoEsperado;
    const cont = descuadre.efectivoContado != null ? num(descuadre.efectivoContado) : efectivoContado;
    const dif =
      descuadre.diferencia != null
        ? num(descuadre.diferencia)
        : cont != null
          ? cont - esp
          : diferencia;
    return {
      ...live,
      saldoInicial: snap?.saldoInicial != null ? num(snap.saldoInicial) : num(sesion.saldoInicial),
      efectivoEsperado: esp,
      efectivoContado: cont,
      diferencia: dif,
      arqueo: snap?.arqueo ?? live.arqueo,
      arqueoTotal: snap?.arqueoTotal ?? live.arqueoTotal,
      totalGastos: live.totalGastos,
      totalRetiros: live.totalRetiros,
    };
  }

  return {
    ...live,
    saldoInicial: snap?.saldoInicial != null ? num(snap.saldoInicial) : num(sesion.saldoInicial),
    ventasBrutas: snap?.ventasBrutas ?? snap?.totalIngresos ?? live.ventasBrutas ?? live.totalIngresos,
    totalIngresos: snap?.totalIngresos != null ? num(snap.totalIngresos) : live.totalIngresos,
    totalIngresosEfectivo:
      snap?.totalIngresosEfectivo != null ? num(snap.totalIngresosEfectivo) : live.totalIngresosEfectivo,
    totalIngresosElectronicos:
      snap?.totalIngresosElectronicos != null
        ? num(snap.totalIngresosElectronicos)
        : live.totalIngresosElectronicos,
    totalEgresos: snap?.totalEgresos != null ? num(snap.totalEgresos) : live.totalEgresos,
    totalEgresosEfectivo:
      snap?.totalEgresosEfectivo != null ? num(snap.totalEgresosEfectivo) : live.totalEgresosEfectivo,
    saldoTeorico: snap?.saldoTeorico != null ? num(snap.saldoTeorico) : live.saldoTeorico,
    efectivoEsperado: efectivoEsperadoCierre,
    efectivoContado,
    diferencia,
    arqueo: snap?.arqueo ?? live.arqueo,
    arqueoTotal: snap?.arqueoTotal ?? live.arqueoTotal,
    totalGastos: snap?.totalGastos != null ? num(snap.totalGastos) : live.totalGastos,
    totalRetiros: snap?.totalRetiros != null ? num(snap.totalRetiros) : live.totalRetiros,
    cantidadIngresos: live.cantidadIngresos,
    cantidadEgresos: live.cantidadEgresos,
    cantidadRecibos: live.cantidadRecibos ?? live.cantidadIngresos,
    ingresosPorTipo: live.ingresosPorTipo,
    ingresosPorServicio: live.ingresosPorServicio,
    egresosPorTipo: live.egresosPorTipo,
    egresosPorFormaPago: live.egresosPorFormaPago,
  };
}

async function listarCierresGenerales(limit = 20, fechaDia = null, idSede = null) {
  const filter = { ...filtroIdSede(idSede) };
  if (fechaDia) filter.fechaDia = normalizarFechaDia(fechaDia);
  const rows = await CajaCierreGeneral.find(filter)
    .sort({ fechaDia: -1, fechaRegistro: -1 })
    .limit(Math.min(limit, 100))
    .lean();
  return rows;
}

module.exports = {
  abrirSesion,
  cerrarSesion,
  reabrirSesion,
  obtenerSesionActiva,
  listarSesiones,
  listarSesionesAbiertas,
  exigirSesionAbierta,
  verificarMovimientoSesionCajero,
  requiereAutorizacionAnularMovimiento,
  calcularResumenSesion,
  resumenVistaSesion,
  calcularCierreGeneral,
  cerrarSesionesMultiples,
  registrarCierreGeneral,
  estadoCierresGeneralesDia,
  depurarCierresGenerales,
  listarCierresGenerales,
  normalizarTurno,
  normalizarFechaDia,
  etiquetaTurno,
  planoSesion,
};
