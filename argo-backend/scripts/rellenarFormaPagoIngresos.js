/**
 * Rellena formaPago en ingresos que solo tienen idTipoPago (registros legacy).
 * Uso: node scripts/rellenarFormaPagoIngresos.js
 *      node scripts/rellenarFormaPagoIngresos.js --dry-run
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Ingreso = require('../src/models/Ingreso');
const { models: cat } = require('../src/models/catalogos');
const { formaPagoDesdeCatalogo } = require('../src/services/tipoIngresoResolver');

const dryRun = process.argv.includes('--dry-run');

function mapaTiposPago(tipos) {
  const porId = new Map();
  for (const t of tipos) {
    for (const k of [t.idTipoPago, t.codigo].filter(Boolean).map(String)) {
      porId.set(k, t);
    }
  }
  return porId;
}

(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/argo';
  await mongoose.connect(uri);

  const tipos = await cat.catTipoPago.find({}).lean();
  const porTipo = mapaTiposPago(tipos);

  const pendientes = await Ingreso.find({
    $or: [{ formaPago: null }, { formaPago: '' }, { formaPago: { $exists: false } }],
  }).lean();

  let actualizados = 0;
  const detalle = [];

  for (const ing of pendientes) {
    const id = String(ing.idTipoPago ?? '').trim();
    const tipo = porTipo.get(id) || null;
    const formaPago = formaPagoDesdeCatalogo(tipo, id);
    detalle.push({ recibo: ing.numRecibo, idTipoPago: id, formaPago });
    if (!dryRun) {
      await Ingreso.updateOne({ _id: ing._id }, { $set: { formaPago } });
    }
    actualizados += 1;
  }

  console.log(
    JSON.stringify(
      {
        modo: dryRun ? 'dry-run' : 'aplicado',
        pendientes: pendientes.length,
        actualizados,
        detalle,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
