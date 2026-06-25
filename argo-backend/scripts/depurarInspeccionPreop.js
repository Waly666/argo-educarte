/**
 * Elimina todos los datos de inspección preoperacional (cabecera, detalle y catálogos).
 *
 * Uso:
 *   node scripts/depurarInspeccionPreop.js --listar
 *   node scripts/depurarInspeccionPreop.js --confirmar
 */
require('dotenv').config();
const mongoose = require('mongoose');

const COLECCIONES = [
  'detInspeccion',
  'inspTecPreop',
  'itemsInspeccion',
  'caractInspeccion',
  'inspeccionesvehiculos',
];

function arg(flag) {
  return process.argv.includes(flag);
}

async function main() {
  const confirmar = arg('--confirmar');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/argo';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  console.log(confirmar ? 'Eliminando datos de inspección…' : 'Conteo (dry-run). Use --confirmar para borrar.');

  for (const name of COLECCIONES) {
    const col = db.collection(name);
    const total = await col.countDocuments({});
    if (confirmar) {
      const r = await col.deleteMany({});
      const n = r.deletedCount ?? 0;
      console.log(`  ${name}: ${n} documentos eliminados`);
    } else {
      console.log(`  ${name}: ${total} documentos`);
    }
  }

  await mongoose.disconnect();
  console.log('Listo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
