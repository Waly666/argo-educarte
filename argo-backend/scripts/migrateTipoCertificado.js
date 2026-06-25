/**
 * Migra formato curso/tecnico a tipoFormatoCert y asigna tipoCertificado = Regular.
 * Uso: node scripts/migrateTipoCertificado.js  (desde argo-backend)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { migrarTipoCertificadoRegular } = require('../src/services/migrarTipoCertificado');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/argo';
  await mongoose.connect(uri);
  const n = await migrarTipoCertificadoRegular();
  console.log(`Listo. ${n} certificado(s) con tipoCertificado = Regular.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
