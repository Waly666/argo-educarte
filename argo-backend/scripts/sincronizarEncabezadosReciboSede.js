/**
 * Actualiza encabezados (nombre sede, teléfono, dirección, ciudad) en config recibo:* por sede.
 *
 * Uso: node scripts/sincronizarEncabezadosReciboSede.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Sede = require('../src/models/Sede');
const { sincronizarEncabezadoReciboDesdeSede } = require('../src/services/configRecibo');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Falta MONGODB_URI en .env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const sedes = await Sede.find({ activa: { $ne: false } }).select('idSede nombre codigo').lean();
  console.log(`Sincronizando encabezados de ${sedes.length} sede(s)...`);
  for (const s of sedes) {
    await sincronizarEncabezadoReciboDesdeSede(s.idSede);
    console.log(`  OK ${s.codigo || s.idSede} — ${s.nombre}`);
  }
  await mongoose.disconnect();
  console.log('Listo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
