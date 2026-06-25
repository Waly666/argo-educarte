/**
 * Convierte numDoc de string a Number en datosAlumnos y colecciones relacionadas.
 * Uso: node scripts/migrateNumDocToNumber.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { parseNumDoc } = require('../src/utils/numDoc');

const COLS = [
  { name: 'datosAlumnos', model: () => require('../src/models/DatosAlumno') },
  { name: 'matriculas', model: () => require('../src/models/Matricula') },
  { name: 'liquidaciones', model: () => require('../src/models/Liquidacion') },
  { name: 'ingresos', model: () => require('../src/models/Ingreso') },
  { name: 'certificados', model: () => require('../src/models/Certificado') },
];

async function migrarColeccion(Model, label) {
  const cursor = Model.find({
    numDoc: { $exists: true, $not: { $type: 'number' } },
  }).cursor();

  let ok = 0;
  let skip = 0;
  for await (const doc of cursor) {
    const n = parseNumDoc(doc.numDoc);
    if (n == null) {
      skip += 1;
      console.warn(`  [${label}] omitido _id=${doc._id} numDoc=${JSON.stringify(doc.numDoc)}`);
      continue;
    }
    await Model.updateOne({ _id: doc._id }, { $set: { numDoc: n } });
    ok += 1;
  }
  console.log(`  ${label}: ${ok} actualizados, ${skip} omitidos`);
  return { ok, skip };
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Defina MONGODB_URI en .env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('Conectado a MongoDB. Migrando numDoc → Number…\n');

  let totalOk = 0;
  let totalSkip = 0;
  for (const { name, model } of COLS) {
    const Model = model();
    const r = await migrarColeccion(Model, name);
    totalOk += r.ok;
    totalSkip += r.skip;
  }

  console.log(`\nListo. Total: ${totalOk} documentos, ${totalSkip} omitidos.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
