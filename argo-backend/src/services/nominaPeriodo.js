const LiquidacionNomina = require('../models/LiquidacionNomina');
const NovedadNomina = require('../models/NovedadNomina');
const PeriodoNomina = require('../models/PeriodoNomina');

function finMesCal(ano, mes) {
  return new Date(ano, mes, 0, 23, 59, 59, 999);
}

function inicioMesCal(ano, mes) {
  return new Date(ano, mes - 1, 1, 0, 0, 0, 0);
}

/** El mes del período aún no ha comenzado (ej. diciembre estando en mayo). */
function esPeriodoFuturo(periodo, ref = new Date()) {
  const inicio = periodo.fechaInicio
    ? new Date(periodo.fechaInicio)
    : inicioMesCal(Number(periodo.ano), Number(periodo.mes));
  const finMesActual = finMesCal(ref.getFullYear(), ref.getMonth() + 1);
  return inicio > finMesActual;
}

function mensajePeriodoFuturo(periodo) {
  const nom = periodo.nombre || `${periodo.ano}-${String(periodo.mes).padStart(2, '0')}`;
  return `El período ${nom} es un mes futuro: aún no se puede causar ni liquidar nómina.`;
}

function assertPeriodoCausable(periodo) {
  if (esPeriodoFuturo(periodo)) {
    throw Object.assign(new Error(mensajePeriodoFuturo(periodo)), { status: 400 });
  }
}

/** Corrige estados incoherentes (liquidado sin liquidación, etc.). */
async function sincronizarEstadoPeriodo(periodo) {
  const [liq, novedades] = await Promise.all([
    LiquidacionNomina.findOne({ idPeriodo: periodo.idPeriodo }).lean(),
    NovedadNomina.countDocuments({ idPeriodo: periodo.idPeriodo }),
  ]);

  let estado = periodo.estado;
  let fixed = false;

  if (['liquidado', 'cerrado', 'pagado'].includes(estado) && !liq) {
    estado = novedades > 0 ? 'novedades' : 'abierto';
    fixed = true;
  } else if (liq && estado === 'abierto') {
    estado = 'novedades';
    fixed = true;
  } else if (liq && !['liquidado', 'cerrado', 'pagado'].includes(estado)) {
    estado = 'liquidado';
    fixed = true;
  }

  if (fixed) {
    await PeriodoNomina.updateOne(
      { idPeriodo: periodo.idPeriodo },
      { $set: { estado, updatedAt: new Date() } },
    );
    return { ...periodo, estado };
  }
  return periodo;
}

module.exports = {
  finMesCal,
  inicioMesCal,
  esPeriodoFuturo,
  mensajePeriodoFuturo,
  assertPeriodoCausable,
  sincronizarEstadoPeriodo,
};
