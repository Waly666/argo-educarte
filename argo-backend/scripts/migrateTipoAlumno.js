/**
 * Asigna tipoAlumno = Regular a alumnos sin el campo.
 * Uso: node scripts/migrateTipoAlumno.js  (desde argo-backend)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { migrarTipoAlumnoRegular } = require('../src/services/migrarTipoAlumno');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/argo';
  await mongoose.connect(uri);
  const n = await migrarTipoAlumnoRegular();
  console.log(`Listo. ${n} documento(s) actualizado(s).`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
