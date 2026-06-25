const mongoose = require('mongoose');
const Liquidacion = require('../models/Liquidacion');
const Matricula = require('../models/Matricula');
const Ingreso = require('../models/Ingreso');

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

function estadoPagadaMatricula(estadoAgregado) {
  if (estadoAgregado === 'pagado') return 'Pagado';
  if (estadoAgregado === 'parcial') return 'Pago Parcial';
  return 'No Pago';
}

function agregarEstados(estados) {
  if (!estados.length) return 'pendiente';
  if (estados.every((e) => e === 'pagado')) return 'pagado';
  if (estados.some((e) => e === 'parcial' || e === 'pagado')) return 'parcial';
  return 'pendiente';
}

/** Recalcula pagada de la matrícula según todas sus liquidaciones vinculadas. */
async function refrescarPagoMatricula(idMat) {
  if (!idMat) return;
  const liqs = await Liquidacion.find({
    $or: [{ idMat }, { idMatricula: idMat }],
  }).lean();
  if (!liqs.length) return;
  const estados = liqs.map((l) => estadoLiq(num(l.valor), num(l.abonado)));
  const agregado = agregarEstados(estados);
  await Matricula.findByIdAndUpdate(idMat, { pagada: estadoPagadaMatricula(agregado) });
}

/** Tras cambiar tarifa del servicio: ajusta valor/saldo de liquidaciones sin tocar abonos. */
async function actualizarSaldosLiquidacionesPorServicio(idServ, nuevoValor) {
  const idServStr = String(idServ);
  const liqs = await Liquidacion.find({ idServ: idServStr }).lean();
  const mats = new Set();
  for (const l of liqs) {
    const valor = Number(nuevoValor) || 0;
    const abonado = num(l.abonado);
    const saldo = Math.max(0, valor - abonado);
    const estado = estadoLiq(valor, abonado);
    await Liquidacion.updateOne(
      { _id: l._id },
      {
        $set: {
          valor: toDec(valor),
          saldo: toDec(saldo),
          estado,
        },
      },
    );
    if (l.idMat) mats.add(String(l.idMat));
    else if (l.idMatricula) mats.add(String(l.idMatricula));
  }
  for (const idMat of mats) {
    await refrescarPagoMatricula(idMat);
  }
  return liqs.length;
}

/** Recalcula abonado/saldo/estado de una liquidación sumando ingresos vigentes.
 *  Los ingresos ANULADOS aportan 0 (valor en cero), así el servicio queda habilitado de nuevo. */
async function recalcularAbonoLiquidacion(idLiquidacion) {
  if (!idLiquidacion) return null;
  const liq = await Liquidacion.findById(idLiquidacion);
  if (!liq) return null;

  const idStr = String(idLiquidacion);
  const ingresos = await Ingreso.find({
    $or: [{ idLiquidacion }, { 'detalle.idLiquidacion': idLiquidacion }],
  }).lean();

  let abonado = 0;
  for (const ing of ingresos) {
    if (Array.isArray(ing.detalle) && ing.detalle.length) {
      for (const d of ing.detalle) {
        if (String(d.idLiquidacion) === idStr) abonado += num(d.valor);
      }
    } else if (ing.idLiquidacion && String(ing.idLiquidacion) === idStr) {
      abonado += num(ing.valor);
    }
  }

  const valor = num(liq.valor);
  abonado = Math.max(0, Math.min(abonado, valor));
  const saldo = Math.max(0, valor - abonado);
  const estado = estadoLiq(valor, abonado);

  await Liquidacion.updateOne(
    { _id: idLiquidacion },
    { $set: { abonado: toDec(abonado), saldo: toDec(saldo), estado } },
  );

  return { abonado, saldo, estado, idMat: liq.idMat || liq.idMatricula || null };
}

/** Ítems de liquidación afectados por un ingreso (simple o multi-ítem). */
function idsLiquidacionDeIngreso(ing) {
  if (!ing) return [];
  if (Array.isArray(ing.detalle) && ing.detalle.length) {
    return [...new Set(ing.detalle.map((d) => d.idLiquidacion).filter(Boolean).map(String))];
  }
  if (ing.idLiquidacion) return [String(ing.idLiquidacion)];
  return [];
}

module.exports = {
  num,
  estadoLiq,
  estadoPagadaMatricula,
  refrescarPagoMatricula,
  actualizarSaldosLiquidacionesPorServicio,
  recalcularAbonoLiquidacion,
  idsLiquidacionDeIngreso,
};
