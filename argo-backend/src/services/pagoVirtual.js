const Matricula = require('../models/Matricula');
const { esTarifaVirtual } = require('../constants/tarifa');

function num(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
  return Number(v) || 0;
}

async function tarifaMatriculaDeLiquidacion(liq) {
  if (!liq) return null;
  const idMat = liq.idMat || liq.idMatricula;
  if (!idMat) return liq.tarifaMatricula != null ? Number(liq.tarifaMatricula) : null;
  const mat = await Matricula.findById(idMat).select('tarifa').lean();
  return mat ? Number(mat.tarifa) : null;
}

async function esLiquidacionMatriculaVirtual(liq) {
  const tarifa = liq?.esVirtual === true
    ? 4
    : liq?.tarifaMatricula != null
      ? Number(liq.tarifaMatricula)
      : await tarifaMatriculaDeLiquidacion(liq);
  return esTarifaVirtual(tarifa);
}

/**
 * Matrícula virtual: solo pago total del saldo pendiente (en línea o caja física).
 */
function validarPagoTotalMatriculaVirtual(liq, valor) {
  const saldo = num(liq?.saldo);
  const v = num(valor);
  if (saldo <= 0.0001) {
    return { ok: false, message: 'Este ítem ya está pagado.' };
  }
  if (Math.abs(v - saldo) > 0.0001) {
    return {
      ok: false,
      message: `La matrícula virtual debe pagarse en su totalidad (${Math.round(saldo).toLocaleString('es-CO')} COP). No se permiten abonos parciales.`,
    };
  }
  return { ok: true };
}

module.exports = {
  num,
  tarifaMatriculaDeLiquidacion,
  esLiquidacionMatriculaVirtual,
  validarPagoTotalMatriculaVirtual,
};
