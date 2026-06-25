const DatosAlumno = require('../models/DatosAlumno');
const Matricula = require('../models/Matricula');
const Liquidacion = require('../models/Liquidacion');
const Ingreso = require('../models/Ingreso');
const Certificado = require('../models/Certificado');
const CajaSesion = require('../models/CajaSesion');
const CajaDescuadre = require('../models/CajaDescuadre');
const Egreso = require('../models/Egreso');
const { models: cat } = require('../models/catalogos');
const { num, roundMoney } = require('../utils/coerceTypes');
const { TIPO_SERV_A_NOMBRE } = require('./tipoIngresoResolver');
const {
  crearMapaMetodos,
  agregarIngresoAMetodos,
  ingresosPorMetodoPagoLista,
} = require('../utils/metodoPagoCanonico');

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function etiquetaMes(y, m) {
  const mi = Math.max(0, Math.min(11, Number(m) - 1));
  return `${MESES[mi]} ${String(y).slice(-2)}`;
}

function inicioMesActual() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function haceMeses(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - (n - 1));
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseFechaQuery(val, finDeDia) {
  if (!val) return null;
  const s = String(val).trim();
  if (!s) return null;
  const d = new Date(finDeDia ? `${s}T23:59:59.999` : `${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    const err = new Error(`Fecha inválida: ${s}`);
    err.status = 400;
    throw err;
  }
  return d;
}

function parseFiltroFechas(query = {}) {
  let desde = parseFechaQuery(query.desde, false);
  let hasta = parseFechaQuery(query.hasta, true);
  if (desde && hasta && desde > hasta) {
    const t = desde;
    desde = hasta;
    hasta = t;
  }
  const activo = !!(desde || hasta);
  return {
    activo,
    desde,
    hasta,
    desdeStr: desde ? String(query.desde || '').trim().slice(0, 10) : null,
    hastaStr: hasta ? String(query.hasta || '').trim().slice(0, 10) : null,
  };
}

function matchIngresos(filtro) {
  const m = { cuadreDescuadre: { $ne: true } };
  if (!filtro?.activo) return m;
  const f = {};
  if (filtro.desde) f.$gte = filtro.desde;
  if (filtro.hasta) f.$lte = filtro.hasta;
  if (Object.keys(f).length) m.fecha = f;
  return m;
}

function matchEgresos(filtro) {
  if (!filtro?.activo) return {};
  const f = {};
  if (filtro.desde) f.$gte = filtro.desde;
  if (filtro.hasta) f.$lte = filtro.hasta;
  if (!Object.keys(f).length) return {};
  return { fechaEgreso: f };
}

async function mapaProgramas() {
  const rows = await cat.programas.find({}).lean();
  const m = new Map();
  for (const p of rows) {
    const id = String(p.idProg ?? p._id ?? '');
    if (id) m.set(id, (p.nombreProg || p.descripcion || p.nombre || `Programa ${id}`).trim());
  }
  return m;
}

async function mapaServicios() {
  const rows = await cat.servicios.find({}).lean();
  const m = new Map();
  for (const s of rows) {
    const id = String(s.idServ ?? '');
    if (id) m.set(id, (s.descrServicio || s.descripcion || `Servicio ${id}`).trim());
  }
  return m;
}

async function mapaTiposIngreso() {
  const rows = await cat.tipoIngreso.find({}).lean();
  const m = new Map();
  for (const t of rows) {
    const id = String(t.idTipoIngreso ?? '');
    const nombre = (t.tipo || t.descripcion || t.nombre || '').trim();
    if (id && nombre) m.set(id, nombre);
    if (nombre) m.set(nombre.toUpperCase(), nombre);
  }
  return m;
}

async function mapaTiposEgreso() {
  const rows = await cat.tipoEgreso.find({}).lean();
  const m = new Map();
  for (const t of rows) {
    const id = String(t.idTipoEgreso ?? '');
    const nombre = (t.tipo || t.descripcion || t.nombre || '').trim();
    if (id) m.set(id, nombre || `Tipo egreso ${id}`);
  }
  return m;
}

function etiquetaTipoIngresoDoc(ing, mapTipos, liqIdServ, serviciosPorId) {
  const nombre = String(ing.tipoIngreso || '').trim();
  if (nombre) return nombre;

  const id = String(ing.idTipoIngreso || '').trim();
  if (id && mapTipos.has(id)) return mapTipos.get(id);
  if (id) return `Tipo ingreso ${id}`;

  if (ing.idLiquidacion) {
    const idServ = liqIdServ.get(String(ing.idLiquidacion));
    if (idServ) {
      const serv = serviciosPorId.get(String(idServ));
      const cod = String(serv?.tipoServ || '').trim().toUpperCase();
      if (cod && TIPO_SERV_A_NOMBRE[cod]) return TIPO_SERV_A_NOMBRE[cod];
      const descr = (serv?.descrServicio || serv?.descripcion || '').trim();
      if (descr) return descr;
    }
  }

  return 'Cobro alumno / sin tipo';
}

async function mapaServiciosPorId() {
  const rows = await cat.servicios.find({}).lean();
  const m = new Map();
  for (const s of rows) {
    const id = String(s.idServ ?? '');
    if (id) m.set(id, s);
  }
  return m;
}

async function agruparIngresosPorTipo(match) {
  const ingresos = await Ingreso.find(match)
    .select('valor tipoIngreso idTipoIngreso idLiquidacion detalle ingresoCaja')
    .lean();

  const mapTipos = await mapaTiposIngreso();
  const serviciosPorId = await mapaServiciosPorId();

  // Liquidaciones a resolver: ingresos de un ítem sin tipo, y TODOS los ítems de detalle.
  const liqIds = new Set();
  for (const i of ingresos) {
    if (
      !String(i.tipoIngreso || '').trim() &&
      !String(i.idTipoIngreso || '').trim() &&
      i.idLiquidacion
    ) {
      liqIds.add(String(i.idLiquidacion));
    }
    if (Array.isArray(i.detalle)) {
      for (const d of i.detalle) if (d.idLiquidacion) liqIds.add(String(d.idLiquidacion));
    }
  }

  const liqIdServ = new Map();
  if (liqIds.size) {
    const liqs = await Liquidacion.find({ _id: { $in: [...liqIds] } })
      .select('idServ')
      .lean();
    for (const l of liqs) {
      if (l.idServ != null) liqIdServ.set(String(l._id), l.idServ);
    }
  }

  const grupos = new Map();
  const acumular = (tipo, valor) => {
    const prev = grupos.get(tipo) || { tipo, cantidad: 0, total: 0 };
    prev.cantidad += 1;
    prev.total += valor;
    grupos.set(tipo, prev);
  };

  for (const ing of ingresos) {
    // Comprobante multi-servicio: discrimina cada servicio del detalle por su propio tipo.
    if (!ing.ingresoCaja && Array.isArray(ing.detalle) && ing.detalle.length) {
      for (const d of ing.detalle) {
        const tipo = etiquetaTipoIngresoDoc(
          { tipoIngreso: '', idTipoIngreso: '', idLiquidacion: d.idLiquidacion },
          mapTipos,
          liqIdServ,
          serviciosPorId,
        );
        acumular(tipo, num(d.valor));
      }
      continue;
    }
    acumular(etiquetaTipoIngresoDoc(ing, mapTipos, liqIdServ, serviciosPorId), num(ing.valor));
  }

  return [...grupos.values()].sort((a, b) => b.total - a.total);
}

function labelTipoEgreso(idRaw, mapTipos) {
  const id = String(idRaw ?? 'sin_tipo').trim();
  if (!id || id === 'sin_tipo') return 'Sin tipo';
  if (mapTipos.has(id)) return mapTipos.get(id);
  return `Tipo egreso ${id}`;
}

async function obtenerEstadisticasDashboard(filtro = parseFiltroFechas()) {
  const desde12m = haceMeses(12);
  const inicioMes = inicioMesActual();
  const matchIngFin = matchIngresos(filtro);
  const matchEgrFin = matchEgresos(filtro);
  const matchIngMes = filtro.activo
    ? matchIngFin
    : { fecha: { $gte: inicioMes }, cuadreDescuadre: { $ne: true } };
  const matchEgrMes = filtro.activo ? matchEgrFin : { fechaEgreso: { $gte: inicioMes } };
  const matchIngSerie = filtro.activo
    ? matchIngFin
    : { fecha: { $gte: desde12m }, cuadreDescuadre: { $ne: true } };

  const [
    totalAlumnos,
    totalMatriculas,
    totalProgramas,
    totalServicios,
    totalCertificados,
    certificadosMes,
    cajasCerradas,
    descuadresPendientes,
    cajasAbiertas,
    liqPorEstado,
    matPorPago,
    ingresosPorMesAgg,
    ingresosMesAgg,
    egresosMesAgg,
    certPorMesAgg,
    liqPorServAgg,
    matPorProgAgg,
    ingresosRaw,
    tiposPago,
    totalLiquidaciones,
    liqTotalesAgg,
    totalRecibos,
    totalEgresosHistAgg,
    totalEgresosCount,
    matriculasActivas,
    ingresosMesCant,
    egresosPorTipoAgg,
    egresosPeriodoCount,
  ] = await Promise.all([
    DatosAlumno.countDocuments({}),
    Matricula.countDocuments({}),
    cat.programas.countDocuments({}),
    cat.servicios.countDocuments({}),
    Certificado.countDocuments({ estado: { $ne: 'anulado' } }),
    Certificado.countDocuments({ estado: { $ne: 'anulado' }, fechaEmision: { $gte: inicioMes } }),
    CajaSesion.countDocuments({ estado: 'cerrada' }),
    CajaDescuadre.countDocuments({ estado: 'pendiente' }),
    CajaSesion.countDocuments({ estado: 'abierta' }),
    Liquidacion.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$estado', 'pendiente'] },
          cantidad: { $sum: 1 },
          totalValor: { $sum: { $toDouble: { $ifNull: ['$valor', 0] } } },
          totalSaldo: { $sum: { $toDouble: { $ifNull: ['$saldo', 0] } } },
        },
      },
    ]),
    Matricula.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$pagada', 'No Pago'] },
          cantidad: { $sum: 1 },
        },
      },
    ]),
    Ingreso.aggregate([
      { $match: matchIngSerie },
      {
        $group: {
          _id: { y: { $year: '$fecha' }, m: { $month: '$fecha' } },
          total: { $sum: { $toDouble: { $ifNull: ['$valor', 0] } } },
          cantidad: { $sum: 1 },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]),
    Ingreso.aggregate([
      { $match: matchIngMes },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: { $ifNull: ['$valor', 0] } } },
          cantidad: { $sum: 1 },
        },
      },
    ]),
    Egreso.aggregate([
      { $match: matchEgrMes },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: { $ifNull: ['$valorEgreso', 0] } } },
          cantidad: { $sum: 1 },
        },
      },
    ]),
    Certificado.aggregate([
      { $match: { fechaEmision: { $gte: desde12m }, estado: { $ne: 'anulado' } } },
      {
        $group: {
          _id: { y: { $year: '$fechaEmision' }, m: { $month: '$fechaEmision' } },
          cantidad: { $sum: 1 },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]),
    Liquidacion.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$idServ', 'sin_servicio'] },
          cantidad: { $sum: 1 },
          total: { $sum: { $toDouble: { $ifNull: ['$valor', 0] } } },
        },
      },
      { $sort: { cantidad: -1, total: -1 } },
    ]),
    Matricula.aggregate([
      { $group: { _id: '$idProg', cantidad: { $sum: 1 } } },
      { $sort: { cantidad: -1 } },
    ]),
    Ingreso.find(matchIngFin)
      .select('valor formaPago idTipoPago')
      .lean(),
    cat.catTipoPago.find({}).lean(),
    Liquidacion.countDocuments({}),
    Liquidacion.aggregate([
      {
        $group: {
          _id: null,
          totalValor: { $sum: { $toDouble: { $ifNull: ['$valor', 0] } } },
          totalAbonado: { $sum: { $toDouble: { $ifNull: ['$abonado', 0] } } },
          totalSaldo: { $sum: { $toDouble: { $ifNull: ['$saldo', 0] } } },
        },
      },
    ]),
    Ingreso.countDocuments({ cuadreDescuadre: { $ne: true } }),
    Egreso.aggregate([
      { $group: { _id: null, total: { $sum: { $toDouble: { $ifNull: ['$valorEgreso', 0] } } } } },
    ]),
    Egreso.countDocuments({}),
    Matricula.countDocuments({ estado: { $regex: /^activa$/i } }),
    Ingreso.countDocuments(matchIngMes),
    Egreso.aggregate([
      { $match: matchEgrFin },
      {
        $group: {
          _id: { $ifNull: ['$tipoEgreso', 'sin_tipo'] },
          cantidad: { $sum: 1 },
          total: { $sum: { $toDouble: { $ifNull: ['$valorEgreso', 0] } } },
        },
      },
      { $sort: { total: -1 } },
    ]),
    Egreso.countDocuments(matchEgrFin),
  ]);

  const porTipoPago = new Map();
  for (const t of tiposPago) {
    for (const k of [t.idTipoPago, t.codigo].filter(Boolean).map(String)) {
      porTipoPago.set(k, t);
    }
  }

  const formasMap = crearMapaMetodos();
  let totalIngresosHistorico = 0;
  for (const ing of ingresosRaw) {
    const v = num(ing.valor);
    totalIngresosHistorico += v;
    agregarIngresoAMetodos(formasMap, ing, v, porTipoPago);
  }

  const ingresosPorFormaPago = ingresosPorMetodoPagoLista(
    formasMap,
    totalIngresosHistorico,
    roundMoney,
    pct,
  );

  const totalLiq = liqPorEstado.reduce((a, r) => a + r.cantidad, 0);
  const estadoLabels = {
    pagado: 'Pagado',
    parcial: 'Parcial',
    pendiente: 'Pendiente',
  };
  const liquidacionesPorEstado = liqPorEstado
    .map((r) => {
      const key = String(r._id || 'pendiente').toLowerCase();
      return {
        estado: key,
        label: estadoLabels[key] || r._id,
        cantidad: r.cantidad,
        totalValor: roundMoney(r.totalValor),
        totalSaldo: roundMoney(r.totalSaldo),
        pct: pct(r.cantidad, totalLiq),
      };
    })
    .sort((a, b) => b.cantidad - a.cantidad);

  const totalMat = matPorPago.reduce((a, r) => a + r.cantidad, 0);
  const matriculasPorPago = matPorPago
    .map((r) => {
      const estado = String(r._id || 'No Pago');
      return {
        estado,
        label: estado,
        cantidad: r.cantidad,
        pct: pct(r.cantidad, totalMat),
      };
    })
    .sort((a, b) => b.cantidad - a.cantidad);

  const ingresosPorMes = ingresosPorMesAgg.map((r) => ({
    mes: etiquetaMes(r._id.y, r._id.m),
    total: roundMoney(r.total),
    cantidad: r.cantidad,
  }));

  const certificadosPorMes = certPorMesAgg.map((r) => ({
    mes: etiquetaMes(r._id.y, r._id.m),
    cantidad: r.cantidad,
  }));

  const mapProg = await mapaProgramas();
  const mapServ = await mapaServicios();
  const mapTiposEgr = await mapaTiposEgreso();

  const ingresosPorTipoRaw = await agruparIngresosPorTipo(matchIngFin);
  const totalIngPeriodo = ingresosPorTipoRaw.reduce((a, r) => a + (r.total || 0), 0);
  const ingresosPorTipo = ingresosPorTipoRaw
    .map((r) => ({
      tipo: r.tipo,
      cantidad: r.cantidad,
      total: roundMoney(r.total),
      pct: pct(r.total, totalIngPeriodo),
    }))
    .filter((r) => r.tipo && r.tipo !== '[object Object]');

  const totalEgrPeriodo = egresosPorTipoAgg.reduce((a, r) => a + (r.total || 0), 0);

  const egresosPorTipoMap = new Map();
  for (const r of egresosPorTipoAgg) {
    const tipo = labelTipoEgreso(r._id, mapTiposEgr);
    const prev = egresosPorTipoMap.get(tipo) || { tipo, cantidad: 0, total: 0 };
    prev.cantidad += r.cantidad;
    prev.total += r.total || 0;
    egresosPorTipoMap.set(tipo, prev);
  }
  const egresosPorTipo = [...egresosPorTipoMap.values()]
    .map((r) => ({
      tipo: r.tipo,
      cantidad: r.cantidad,
      total: roundMoney(r.total),
      pct: pct(r.total, totalEgrPeriodo),
    }))
    .sort((a, b) => b.total - a.total);

  const serviciosTodos = liqPorServAgg.map((r) => {
    const id = String(r._id);
    return {
      servicio:
        id === 'sin_servicio' ? 'Otros / sin servicio' : mapServ.get(id) || `Servicio ${id}`,
      cantidad: r.cantidad,
      total: roundMoney(r.total),
    };
  });

  const serviciosTop = serviciosTodos.slice(0, 10);

  const matriculasPorPrograma = matPorProgAgg.map((r) => ({
    programa: mapProg.get(String(r._id)) || `Programa ${r._id}`,
    matriculas: r.cantidad,
    pct: pct(r.cantidad, totalMatriculas),
  }));

  const programasTop = matriculasPorPrograma.slice(0, 8);

  const ingresosMes = roundMoney(ingresosMesAgg[0]?.total ?? 0);
  const egresosMes = roundMoney(egresosMesAgg[0]?.total ?? 0);
  const totalEgresosHistorico = roundMoney(totalEgresosHistAgg[0]?.total ?? 0);
  const liqTot = liqTotalesAgg[0] || {};
  const carteraPendiente = roundMoney(liqTot.totalSaldo);
  const valorLiquidado = roundMoney(liqTot.totalValor);
  const totalAbonadoLiq = roundMoney(liqTot.totalAbonado);
  const recibosEnPeriodo = filtro.activo ? ingresosMesCant : ingresosMesAgg[0]?.cantidad ?? 0;
  const egresosEnPeriodo = roundMoney(egresosMesAgg[0]?.total ?? 0);
  const egresosCountPeriodo = filtro.activo ? egresosPeriodoCount : totalEgresosCount;
  const recibosParaTicket = filtro.activo ? ingresosMesCant : totalRecibos;
  const ticketPromedio =
    recibosParaTicket > 0 ? roundMoney(totalIngresosHistorico / recibosParaTicket) : 0;
  const promedioLiq = totalLiquidaciones > 0 ? roundMoney(valorLiquidado / totalLiquidaciones) : 0;

  const CHART_COLORS = [
    '#14b8a6',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#f59e0b',
    '#ef4444',
    '#06b6d4',
    '#10b981',
  ];

  return {
    actualizadoEn: new Date().toISOString(),
    filtroFechas: {
      activo: filtro.activo,
      desde: filtro.desdeStr,
      hasta: filtro.hastaStr,
    },
    colores: CHART_COLORS,
    kpis: {
      alumnos: totalAlumnos,
      matriculas: totalMatriculas,
      matriculasActivas,
      programas: totalProgramas,
      servicios: totalServicios,
      liquidaciones: totalLiquidaciones,
      ingresosTotal: roundMoney(totalIngresosHistorico),
      ingresosMes,
      egresosMes,
      egresosTotal: totalEgresosHistorico,
      recibosTotal: filtro.activo ? ingresosMesCant : totalRecibos,
      recibosMes: recibosEnPeriodo,
      certificados: totalCertificados,
      certificadosMes,
      cajasCerradas,
      cajasAbiertas,
      descuadresPendientes,
      carteraPendiente,
      valorLiquidado,
      totalAbonadoLiq,
      ticketPromedio,
      promedioLiquidacion: promedioLiq,
      egresosCount: egresosCountPeriodo,
    },
    resumenFinanciero: {
      ingresosHistorico: roundMoney(totalIngresosHistorico),
      ingresosMes,
      egresosMes: egresosEnPeriodo,
      egresosHistorico: filtro.activo ? egresosEnPeriodo : totalEgresosHistorico,
      netoMes: ingresosMes - egresosEnPeriodo,
      carteraPendiente,
      valorFacturado: valorLiquidado,
      totalAbonado: totalAbonadoLiq,
      porCobrar: carteraPendiente,
    },
    liquidacionesPorEstado,
    matriculasPorPago,
    ingresosPorMes,
    ingresosPorTipo,
    egresosPorTipo,
    ingresosPorFormaPago,
    certificadosPorMes,
    serviciosTodos,
    serviciosTop,
    matriculasPorPrograma,
    programasTop,
    cajaMes: {
      ingresos: ingresosMes,
      egresos: egresosEnPeriodo,
      neto: ingresosMes - egresosEnPeriodo,
      recibosMes: recibosEnPeriodo,
    },
  };
}

module.exports = { obtenerEstadisticasDashboard, parseFiltroFechas };
