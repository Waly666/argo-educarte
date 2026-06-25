const mongoose = require('mongoose');
const Empleado = require('../models/Empleado');
const Contrato = require('../models/Contrato');
const NovedadNomina = require('../models/NovedadNomina');
const PeriodoNomina = require('../models/PeriodoNomina');
const { getConfigSync } = require('./configNomina');
const { aplicaAuxilio, calcularFsp, calcularRetencionFuente } = require('./nominaLegal');
const { buildPilaContext } = require('./nominaPilaContext');
const { maxNumericId, insertarCatalogo } = require('../services/programaServicio');
const { num } = require('../services/rrhhCatalogo');
const { nombreCompletoEmpleado, normalizarEmpleadoLegacy } = require('../utils/empleadoDoc');

function toDec(n) {
  return mongoose.Types.Decimal128.fromString(String(Math.round(Number(n) || 0)));
}

function empleadosActivos() {
  return Empleado.find({
    estado: { $in: [/^activo$/i, 'activo', 'ACTIVO', null] },
  }).lean();
}

async function contratoVigente(empleadoId, fechaInicio, fechaFin) {
  const rows = await Contrato.find({
    empleadoId,
    estado: { $in: [/^activo$/i, 'activo', 'ACTIVO', null] },
  }).lean();
  for (const c of rows) {
    const ini = c.fechaInicio ? new Date(c.fechaInicio) : null;
    const fin = c.fechaFin ? new Date(c.fechaFin) : null;
    if (ini && ini > fechaFin) continue;
    if (fin && fin < fechaInicio) continue;
    return c;
  }
  return rows[0] || null;
}

function salarioBase(emp, contrato) {
  const s = num(contrato?.salario) || num(emp?.salario) || 0;
  return Math.max(0, s);
}

async function upsertNovedadAuto({
  empleadoId,
  idPeriodo,
  codigoConcepto,
  tipoNovedad,
  naturaleza,
  descripcion,
  valor,
  fecha,
  user,
}) {
  const existente = await NovedadNomina.findOne({
    empleadoId,
    idPeriodo,
    codigoConcepto,
    autoGenerada: true,
  });
  const doc = {
    tipoNovedad,
    codigoConcepto,
    naturaleza,
    descripcion,
    valor: toDec(valor),
    fecha,
    autoGenerada: true,
    estado: 'activo',
    updatedAt: new Date(),
    userChangeRecord: user,
  };
  if (existente) {
    await NovedadNomina.updateOne({ idNovedad: existente.idNovedad }, { $set: doc });
    return existente.idNovedad;
  }
  const idNovedad = await maxNumericId(NovedadNomina, 'idNovedad');
  await insertarCatalogo(NovedadNomina, {
    idNovedad,
    empleadoId,
    idPeriodo,
    ...doc,
    createdAt: new Date(),
    userAddReg: user,
  });
  return idNovedad;
}

/**
 * Genera novedades automáticas del período: salario, auxilio, salud y pensión.
 */
const { assertPeriodoCausable } = require('./nominaPeriodo');

async function generarNovedadesAutomaticas(idPeriodo, user = 'sistema') {
  const periodo = await PeriodoNomina.findOne({ idPeriodo }).lean();
  if (!periodo) throw Object.assign(new Error('Período no encontrado'), { status: 404 });
  assertPeriodoCausable(periodo);
  if (['cerrado', 'pagado'].includes(periodo.estado)) {
    throw Object.assign(new Error('El período está cerrado o pagado'), { status: 409 });
  }

  await NovedadNomina.deleteMany({ idPeriodo, autoGenerada: true });

  const empleados = await empleadosActivos();
  const fechaRef = periodo.fechaFin || periodo.fechaInicio;
  const todasNovedades = await NovedadNomina.find({ idPeriodo, autoGenerada: false }).lean();
  const manualesPorEmp = new Map();
  for (const n of todasNovedades) {
    if (!manualesPorEmp.has(n.empleadoId)) manualesPorEmp.set(n.empleadoId, []);
    manualesPorEmp.get(n.empleadoId).push(n);
  }

  let count = 0;

  const cfg = getConfigSync();

  for (const emp of empleados) {
    const e = normalizarEmpleadoLegacy(emp);
    const contrato = await contratoVigente(
      e.idEmpleado,
      new Date(periodo.fechaInicio),
      new Date(periodo.fechaFin),
    );
    const salarioMes = salarioBase(e, contrato);
    if (salarioMes <= 0) continue;

    const manuales = manualesPorEmp.get(e.idEmpleado) || [];
    const ctx = buildPilaContext(e, contrato, periodo, manuales);
    if (ctx.diasEnPeriodo <= 0) continue;

    const nombre = nombreCompletoEmpleado(e);
    const salario = ctx.salarioProporcional;
    const baseSeguridad = ctx.ibc;

    await upsertNovedadAuto({
      empleadoId: e.idEmpleado,
      idPeriodo,
      codigoConcepto: 'SALARIO_BASE',
      tipoNovedad: 'SALARIO_BASE',
      naturaleza: 'devengo',
      descripcion: `Salario ${periodo.nombre || ''} (${ctx.diasSalarioPagar}/${ctx.diasMes} d) — ${nombre}`,
      valor: salario,
      fecha: fechaRef,
      user,
    });
    count++;

    const aux =
      contrato?.auxilioTransporte === true || (contrato == null && aplicaAuxilio(salarioMes));
    if (aux && ctx.diasSalarioPagar > 0) {
      const auxVal = Math.round(cfg.auxilioTransporteMensual * (ctx.diasSalarioPagar / ctx.diasMes));
      await upsertNovedadAuto({
        empleadoId: e.idEmpleado,
        idPeriodo,
        codigoConcepto: 'AUX_TRANSPORTE',
        tipoNovedad: 'AUX_TRANSPORTE',
        naturaleza: 'devengo',
        descripcion: `Auxilio transporte (${ctx.diasSalarioPagar} d) — ${nombre}`,
        valor: auxVal,
        fecha: fechaRef,
        user,
      });
      count++;
    }

    const salud = Math.round(baseSeguridad * cfg.saludEmpleadoPct);
    const pension = Math.round(baseSeguridad * cfg.pensionEmpleadoPct);

    if (salud > 0) {
      await upsertNovedadAuto({
        empleadoId: e.idEmpleado,
        idPeriodo,
        codigoConcepto: 'SALUD_EMPLEADO',
        tipoNovedad: 'SALUD_EMPLEADO',
        naturaleza: 'deduccion',
        descripcion: `Aporte salud 4% — ${nombre}`,
        valor: salud,
        fecha: fechaRef,
        user,
      });
      count++;
    }
    if (pension > 0) {
      await upsertNovedadAuto({
        empleadoId: e.idEmpleado,
        idPeriodo,
        codigoConcepto: 'PENSION_EMPLEADO',
        tipoNovedad: 'PENSION_EMPLEADO',
        naturaleza: 'deduccion',
        descripcion: `Aporte pensión 4% — ${nombre}`,
        valor: pension,
        fecha: fechaRef,
        user,
      });
      count++;
    }

    const fsp = calcularFsp(salarioMes > 0 ? salarioMes : baseSeguridad);
    if (fsp > 0) {
      await upsertNovedadAuto({
        empleadoId: e.idEmpleado,
        idPeriodo,
        codigoConcepto: 'FSP',
        tipoNovedad: 'FSP',
        naturaleza: 'deduccion',
        descripcion: `Fondo solidaridad pensional — ${nombre}`,
        valor: fsp,
        fecha: fechaRef,
        user,
      });
      count++;
    }

    const retencion = calcularRetencionFuente(baseSeguridad, salud, pension);
    if (retencion > 0) {
      await upsertNovedadAuto({
        empleadoId: e.idEmpleado,
        idPeriodo,
        codigoConcepto: 'RETENCION_FUENTE',
        tipoNovedad: 'RETENCION_FUENTE',
        naturaleza: 'deduccion',
        descripcion: `Retención en la fuente — ${nombre}`,
        valor: retencion,
        fecha: fechaRef,
        user,
      });
      count++;
    }
  }

  await PeriodoNomina.updateOne(
    { idPeriodo },
    { $set: { estado: 'novedades', updatedAt: new Date(), userChangeRecord: user } },
  );

  return { empleados: empleados.length, novedadesGeneradas: count };
}

function clasificarNovedadManual(novedad) {
  if (novedad.naturaleza === 'devengo' || novedad.naturaleza === 'deduccion') return novedad.naturaleza;
  const t = String(novedad.tipoNovedad || '').toUpperCase();
  const cfg = getConfigSync();
  if (cfg.tiposDeduccion.some((x) => t.includes(x) || x.includes(t))) return 'deduccion';
  if (cfg.tiposDevengo.some((x) => t.includes(x) || x.includes(t))) return 'devengo';
  const v = num(novedad.valor);
  return v < 0 ? 'deduccion' : 'devengo';
}

module.exports = {
  generarNovedadesAutomaticas,
  clasificarNovedadManual,
  contratoVigente,
  salarioBase,
};
