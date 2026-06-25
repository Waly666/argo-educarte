const mongoose = require('mongoose');
const PeriodoNomina = require('../models/PeriodoNomina');
const NovedadNomina = require('../models/NovedadNomina');
const { maxNumericId, insertarCatalogo } = require('./programaServicio');
const { nombreCompletoEmpleado, normalizarEmpleadoLegacy } = require('../utils/empleadoDoc');

const TIPOS_ANTICIPO = {
  prestamo: {
    codigoConcepto: 'PRESTAMO',
    tipoNovedad: 'PRESTAMO',
    naturaleza: 'deduccion',
    prefijoConcepto: 'Préstamo desembolsado',
  },
  abono_adelanto: {
    codigoConcepto: 'ABONO_ADELANTO',
    tipoNovedad: 'ABONO_ADELANTO',
    naturaleza: 'deduccion',
    prefijoConcepto: 'Abono/adelanto de sueldo ya pagado',
  },
};

function toDec(n) {
  return mongoose.Types.Decimal128.fromString(String(Math.round(Number(n) || 0)));
}

/** Período abierto a novedades (no cerrado ni pagado). */
async function resolverPeriodoNomina(idPeriodo) {
  if (idPeriodo != null && idPeriodo !== '') {
    const p = await PeriodoNomina.findOne({ idPeriodo: Number(idPeriodo) }).lean();
    if (!p) throw Object.assign(new Error('Período de nómina no encontrado'), { status: 400 });
    if (['cerrado', 'pagado'].includes(p.estado)) {
      throw Object.assign(new Error('El período ya está cerrado o pagado'), { status: 409 });
    }
    return p;
  }
  const p = await PeriodoNomina.findOne({
    estado: { $in: ['abierto', 'novedades', 'liquidado'] },
  })
    .sort({ ano: -1, mes: -1 })
    .lean();
  if (!p) {
    throw Object.assign(
      new Error('No hay período de nómina abierto. Cree uno en RRHH → Nómina.'),
      { status: 400 },
    );
  }
  return p;
}

/**
 * Préstamo o abono adelanto: egreso hoy en caja + novedad deducción en el período
 * (al liquidar nómina se descuenta para no pagar dos veces).
 * El bono NO usa este flujo: solo novedad devengo manual al liquidar.
 */
async function registrarAnticipoDesdeEgreso({ anticipoNomina, idPeriodo, empleado, egresoId, valor, concepto, user }) {
  const cfg = TIPOS_ANTICIPO[anticipoNomina];
  if (!cfg) return null;

  const emp = normalizarEmpleadoLegacy(empleado);
  const periodo = await resolverPeriodoNomina(idPeriodo);
  const v = Math.abs(Math.round(Number(valor) || 0));
  if (v <= 0) throw Object.assign(new Error('Valor inválido para anticipo'), { status: 400 });

  const nombre = nombreCompletoEmpleado(emp);
  const desc = `${cfg.prefijoConcepto} — ${nombre}${concepto ? ` (${concepto})` : ''} — egreso ${egresoId}`;

  const existente = await NovedadNomina.findOne({
    idEgresoOrigen: String(egresoId),
  }).lean();
  if (existente) {
    return { idNovedad: existente.idNovedad, idPeriodo: periodo.idPeriodo, actualizado: false };
  }

  const idNovedad = await maxNumericId(NovedadNomina, 'idNovedad');
  const now = new Date();
  await insertarCatalogo(NovedadNomina, {
    idNovedad,
    empleadoId: emp.idEmpleado,
    idPeriodo: periodo.idPeriodo,
    tipoNovedad: cfg.tipoNovedad,
    codigoConcepto: cfg.codigoConcepto,
    naturaleza: cfg.naturaleza,
    descripcion: desc,
    valor: toDec(v),
    fecha: now,
    autoGenerada: false,
    idEgresoOrigen: String(egresoId),
    estado: 'activo',
    createdAt: now,
    updatedAt: now,
    userAddReg: user,
    userChangeRecord: user,
  });

  if (periodo.estado === 'abierto') {
    await PeriodoNomina.updateOne(
      { idPeriodo: periodo.idPeriodo },
      { $set: { estado: 'novedades', updatedAt: now, userChangeRecord: user } },
    );
  }

  return {
    idNovedad,
    idPeriodo: periodo.idPeriodo,
    periodoNombre: periodo.nombre,
    naturaleza: cfg.naturaleza,
    tipoNovedad: cfg.tipoNovedad,
    valor: v,
  };
}

async function eliminarNovedadPorEgreso(egresoId) {
  await NovedadNomina.deleteOne({ idEgresoOrigen: String(egresoId) });
}

module.exports = {
  TIPOS_ANTICIPO,
  resolverPeriodoNomina,
  registrarAnticipoDesdeEgreso,
  eliminarNovedadPorEgreso,
};
