/**
 * Elimina todos los registros de cierre general de caja (colección cajaCierresGenerales).
 * Uso:
 *   node scripts/depurarCierresGenerales.js --listar
 *   node scripts/depurarCierresGenerales.js --confirmar
 */
require('dotenv').config();
const mongoose = require('mongoose');
const CajaCierreGeneral = require('../src/models/CajaCierreGeneral');

async function main() {
  const listar = process.argv.includes('--listar');
  const confirmar = process.argv.includes('--confirmar');

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/argo');

  const total = await CajaCierreGeneral.countDocuments();
  const muestra = await CajaCierreGeneral.find({})
    .sort({ fechaRegistro: -1 })
    .limit(15)
    .select('idCierreGeneral fechaDia turno cantidadCajas fechaRegistro usuarioAdmin')
    .lean();

  console.log(`\nCierres generales en BD: ${total}\n`);
  if (muestra.length) {
    console.table(
      muestra.map((r) => ({
        id: r.idCierreGeneral,
        dia: r.fechaDia || '—',
        turno: r.turno || '—',
        cajas: r.cantidadCajas,
        registrado: r.fechaRegistro ? new Date(r.fechaRegistro).toISOString() : '—',
        admin: r.usuarioAdmin,
      })),
    );
  }

  if (listar) {
    await mongoose.disconnect();
    return;
  }

  if (!confirmar) {
    console.log('Para borrar TODOS los cierres generales ejecute:');
    console.log('  node scripts/depurarCierresGenerales.js --confirmar\n');
    await mongoose.disconnect();
    return;
  }

  const r = await CajaCierreGeneral.deleteMany({});
  console.log(`Eliminados: ${r.deletedCount ?? 0} registro(s).\n`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
