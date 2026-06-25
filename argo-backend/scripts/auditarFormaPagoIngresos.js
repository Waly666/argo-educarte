/**
 * Audita ingresos con sesión: cuántos no tienen formaPago en BD y cómo se resuelven.
 * Uso: node scripts/auditarFormaPagoIngresos.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { formaPagoDesdeCatalogo } = require('../src/services/tipoIngresoResolver');

function mapaTiposPago(tipos) {
  const porId = new Map();
  for (const t of tipos) {
    for (const k of [t.idTipoPago, t.codigo].filter(Boolean).map(String)) {
      porId.set(k, t);
    }
  }
  return porId;
}

function resolver(ing, porTipoPago) {
  const guardada = ing?.formaPago && String(ing.formaPago).trim();
  if (guardada) return guardada;
  const id = String(ing?.idTipoPago ?? '').trim();
  const tipo = porTipoPago.get(id) || null;
  return formaPagoDesdeCatalogo(tipo, id);
}

async function findCatTipoPago(db) {
  const names = (await db.listCollections().toArray()).map((c) => c.name);
  const hit = names.find((n) => /tipopago/i.test(n));
  return hit ? db.collection(hit).find({}).toArray() : [];
}

(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/argo';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const ingresos = await db.collection('ingresos').find({ idSesion: { $ne: null } }).toArray();
  const tipos = await findCatTipoPago(db);
  const porTipo = mapaTiposPago(tipos);

  const sinGuardada = ingresos.filter((i) => !i.formaPago || !String(i.formaPago).trim());
  const sinId = ingresos.filter((i) => !i.idTipoPago);
  const idsHuerfanos = new Set();
  const muestras = [];
  const problemas = [];

  for (const ing of sinGuardada) {
    const id = String(ing.idTipoPago ?? '').trim();
    const tipo = porTipo.get(id);
    const resuelta = resolver(ing, porTipo);
    if (!tipo && id) idsHuerfanos.add(id);
    if (resuelta === 'Efectivo' && !tipo && id && id !== '1') {
      problemas.push({
        recibo: ing.numRecibo,
        idSesion: ing.idSesion,
        idTipoPago: id,
        motivo: 'Sin catálogo — asumido Efectivo por defecto',
      });
    }
    if (muestras.length < 20) {
      muestras.push({
        recibo: ing.numRecibo,
        idSesion: ing.idSesion,
        idTipoPago: id || null,
        tipoCat: tipo?.descripcion || tipo?.nombre || '(no en catálogo)',
        formaPagoBD: ing.formaPago || null,
        resuelta,
      });
    }
  }

  const porResuelta = {};
  for (const ing of ingresos) {
    const r = resolver(ing, porTipo);
    porResuelta[r] = (porResuelta[r] || 0) + 1;
  }

  console.log(
    JSON.stringify(
      {
        totalConSesion: ingresos.length,
        sinFormaPagoEnBD: sinGuardada.length,
        sinIdTipoPago: sinId.length,
        idsTipoPagoSinCatalogo: [...idsHuerfanos],
        catalogoTiposPago: tipos.length,
        distribucionResuelta: porResuelta,
        posiblesMalClasificados: problemas.slice(0, 30),
        muestrasSinFormaPagoBD: muestras,
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
