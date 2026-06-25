const LiquidacionNomina = require('../models/LiquidacionNomina');
const NovedadNomina = require('../models/NovedadNomina');
const PeriodoNomina = require('../models/PeriodoNomina');
const Empleado = require('../models/Empleado');
const Eps = require('../models/Eps');
const Afp = require('../models/Afp');
const Arl = require('../models/Arl');
const CajaCompensacion = require('../models/CajaCompensacion');
const { maxNumericId, insertarCatalogo } = require('./programaServicio');
const { num } = require('./rrhhCatalogo');
const { nombreCompletoEmpleado, normalizarEmpleadoLegacy } = require('../utils/empleadoDoc');
const { clasificarNovedadManual, contratoVigente } = require('./nominaNovedades');
const { buildPilaContext } = require('./nominaPilaContext');
const {
  redondear,
  ibcDesdeNovedades,
  calcularAportesPatronales,
  calcularProvisiones,
} = require('./nominaLegal');
const { assertPeriodoCausable } = require('./nominaPeriodo');

async function cargarAdminEmpleado(emp) {
  const e = normalizarEmpleadoLegacy(emp);
  const [eps, afp, arl, caja] = await Promise.all([
    e.epsId ? Eps.findOne({ idEps: e.epsId }).lean() : null,
    e.afpId ? Afp.findOne({ idAfp: e.afpId }).lean() : null,
    e.arlId ? Arl.findOne({ idArl: e.arlId }).lean() : null,
    e.cajaCompensacionId
      ? CajaCompensacion.findOne({ idCajaCompensacion: e.cajaCompensacionId }).lean()
      : null,
  ]);
  return {
    epsCodigo: eps?.codigoMinisterio || '',
    afpCodigo: afp?.codigoMinisterio || '',
    arlCodigo: arl?.codigoMinisterio || '',
    ccfCodigo: caja?.codigoMinisterio || '',
    arlNivel: arl?.nivelRiesgo ?? null,
    epsNombre: eps?.nombre || null,
    afpNombre: afp?.nombre || null,
    arlNombre: arl?.nombre || null,
    ccfNombre: caja?.nombre || null,
  };
}

async function obtenerNovedadesPeriodo(idPeriodo) {
  return NovedadNomina.find({
    idPeriodo,
    estado: { $in: [/^activo$/i, 'activo', 'ACTIVO', null] },
  }).lean();
}

function agruparPorEmpleado(novedades) {
  const map = new Map();
  for (const n of novedades) {
    const id = n.empleadoId;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(n);
  }
  return map;
}

function sumarPorCodigo(novedades, codigo) {
  return novedades
    .filter((n) => String(n.codigoConcepto || '').toUpperCase() === codigo)
    .reduce((s, n) => s + Math.abs(redondear(num(n.valor))), 0);
}

function calcularDetalleEmpleado(emp, novedades, admin, periodo, contrato) {
  const manuales = novedades.filter((n) => !n.autoGenerada);
  const pilaCtx = periodo
    ? buildPilaContext(emp, contrato, periodo, manuales)
    : null;
  const lineas = [];
  let totalDevengos = 0;
  let totalDeducciones = 0;

  for (const n of novedades) {
    const naturaleza = clasificarNovedadManual(n);
    if (naturaleza !== 'devengo' && naturaleza !== 'deduccion') continue;
    const valor = Math.abs(redondear(num(n.valor)));
    if (valor <= 0) continue;
    lineas.push({
      codigoConcepto: n.codigoConcepto || n.tipoNovedad,
      concepto: n.descripcion || n.tipoNovedad,
      naturaleza,
      valor,
    });
    if (naturaleza === 'devengo') totalDevengos += valor;
    else totalDeducciones += valor;
  }

  const salarioBase = sumarPorCodigo(novedades, 'SALARIO_BASE');
  const ibcCalc = pilaCtx?.ibc > 0 ? pilaCtx.ibc : ibcDesdeNovedades(novedades, salarioBase);
  const patronal = calcularAportesPatronales({
    ibc: ibcCalc,
    nivelRiesgoArl: admin.arlNivel,
  });
  const provisiones = calcularProvisiones(salarioBase || ibcCalc);

  const advertencias = [];
  if (!admin.epsCodigo) advertencias.push('Sin EPS asignada');
  if (!admin.afpCodigo) advertencias.push('Sin AFP asignada');
  if (!admin.arlCodigo) advertencias.push('Sin ARL asignada');
  if (!admin.ccfCodigo) advertencias.push('Sin caja de compensación');

  const netoPagar = totalDevengos - totalDeducciones;
  const totalCostoEmpresa = netoPagar + patronal.total + provisiones.total;

  return {
    empleadoId: emp.idEmpleado,
    numeroDocumento: normalizarEmpleadoLegacy(emp).numeroDocumento,
    tipoDocumento: normalizarEmpleadoLegacy(emp).tipoDocumento || 'CC',
    empleadoNombre: nombreCompletoEmpleado(emp),
    lineas,
    lineasPatronales: patronal.lineas,
    lineasProvisiones: provisiones.lineas,
    totalDevengos,
    totalDeducciones,
    netoPagar,
    ibc: patronal.ibc,
    totalPatronal: patronal.total,
    totalProvisiones: provisiones.total,
    totalCostoEmpresa,
    diasPila: pilaCtx?.diasCotizacion ?? 30,
    diasSalarioPila: pilaCtx?.diasSalarioPagar ?? 30,
    novedadesPila: pilaCtx
      ? {
          ing: pilaCtx.novedadIng || '',
          ret: pilaCtx.novedadRet || '',
          ige: pilaCtx.novedadIGE || '',
          lma: pilaCtx.novedadLMA || '',
          sln: pilaCtx.novedadSLN || '',
          vacLr: pilaCtx.novedadVAC_LR || '',
        }
      : null,
    pila: {
      codigoEps: admin.epsCodigo,
      codigoAfp: admin.afpCodigo,
      codigoArl: admin.arlCodigo,
      codigoCcf: admin.ccfCodigo,
      arlNivel: admin.arlNivel,
      ibc: patronal.ibc,
      dias: pilaCtx?.diasCotizacion ?? 30,
      diasCotizacion: pilaCtx?.diasCotizacion ?? 30,
      novedadIng: pilaCtx?.novedadIng || '',
      novedadRet: pilaCtx?.novedadRet || '',
      novedadIGE: pilaCtx?.novedadIGE || '',
      novedadLMA: pilaCtx?.novedadLMA || '',
      novedadSLN: pilaCtx?.novedadSLN || '',
      novedadVAC_LR: pilaCtx?.novedadVAC_LR || '',
      pilaContext: pilaCtx,
      saludEmpleado: sumarPorCodigo(novedades, 'SALUD_EMPLEADO'),
      pensionEmpleado: sumarPorCodigo(novedades, 'PENSION_EMPLEADO'),
      fsp: sumarPorCodigo(novedades, 'FSP'),
      retencion: sumarPorCodigo(novedades, 'RETENCION_FUENTE'),
      ...patronal.desglose,
    },
    administradoras: {
      eps: admin.epsNombre,
      afp: admin.afpNombre,
      arl: admin.arlNombre,
      ccf: admin.ccfNombre,
    },
    advertencias,
  };
}

async function liquidarPeriodo(idPeriodo, user = 'sistema') {
  const periodo = await PeriodoNomina.findOne({ idPeriodo }).lean();
  if (!periodo) throw Object.assign(new Error('Período no encontrado'), { status: 404 });
  assertPeriodoCausable(periodo);
  if (['cerrado', 'pagado'].includes(periodo.estado)) {
    throw Object.assign(new Error('El período ya está cerrado o pagado'), { status: 409 });
  }

  const { generarNovedadesDescuadrePorPeriodo } = require('./descuadreCaja');
  await generarNovedadesDescuadrePorPeriodo(idPeriodo, user);

  const novedades = await obtenerNovedadesPeriodo(idPeriodo);
  if (!novedades.length) {
    throw Object.assign(new Error('No hay novedades en el período. Genere novedades automáticas primero.'), {
      status: 400,
    });
  }

  const porEmp = agruparPorEmpleado(novedades);
  const detalle = [];
  let totalDevengos = 0;
  let totalDeducciones = 0;
  let totalPatronal = 0;
  let totalProvisiones = 0;
  let totalCostoEmpresa = 0;

  for (const [empleadoId, novs] of porEmp) {
    const emp = await Empleado.findOne({ idEmpleado: empleadoId }).lean();
    if (!emp) continue;
    const contrato = await contratoVigente(
      empleadoId,
      new Date(periodo.fechaInicio),
      new Date(periodo.fechaFin),
    );
    const admin = await cargarAdminEmpleado(emp);
    const d = calcularDetalleEmpleado(emp, novs, admin, periodo, contrato);
    if (d.lineas.length === 0) continue;
    detalle.push(d);
    totalDevengos += d.totalDevengos;
    totalDeducciones += d.totalDeducciones;
    totalPatronal += d.totalPatronal;
    totalProvisiones += d.totalProvisiones;
    totalCostoEmpresa += d.totalCostoEmpresa;
  }

  detalle.sort((a, b) => a.empleadoNombre.localeCompare(b.empleadoNombre));

  const totalNeto = totalDevengos - totalDeducciones;
  const now = new Date();
  const { coerceDocumentDeep } = require('../utils/coerceTypes');
  const payload = coerceDocumentDeep({
    idPeriodo,
    fechaLiquidacion: now,
    estado: 'liquidada',
    detalle,
    totalDevengos,
    totalDeducciones,
    totalNeto,
    totalPatronal,
    totalProvisiones,
    totalCostoEmpresa,
    cantidadEmpleados: detalle.length,
    updatedAt: now,
    userChangeRecord: user,
  });

  const existente = await LiquidacionNomina.findOne({ idPeriodo }).lean();
  if (existente) {
    await LiquidacionNomina.updateOne({ idPeriodo }, { $set: payload });
  } else {
    const idLiquidacionNomina = await maxNumericId(LiquidacionNomina, 'idLiquidacionNomina');
    await insertarCatalogo(LiquidacionNomina, {
      idLiquidacionNomina,
      ...payload,
      createdAt: now,
      userAddReg: user,
    });
  }

  await PeriodoNomina.updateOne(
    { idPeriodo },
    { $set: { estado: 'liquidado', updatedAt: now, userChangeRecord: user } },
  );

  return LiquidacionNomina.findOne({ idPeriodo }).lean();
}

module.exports = { liquidarPeriodo, calcularDetalleEmpleado, cargarAdminEmpleado };
