/**
 * Rellena idJornada en certificados de jornada que no lo tienen (históricos).
 * Uso: node scripts/migrarIdJornadaCertificados.js  (desde argo-backend)
 * Simulación: node scripts/migrarIdJornadaCertificados.js --dry-run
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { migrarIdJornadaCertificados } = require('../src/services/migrarIdJornadaCertificados');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/argo';
  await mongoose.connect(uri);
  const r = await migrarIdJornadaCertificados({ dryRun });
  console.log(
    `Listo. Revisados: ${r.total}, actualizados: ${r.actualizados}, sin inferir: ${r.sinInferir}${dryRun ? ' (dry-run)' : ''}.`,
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
