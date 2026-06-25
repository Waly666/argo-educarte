/**
 * Asigna sede PRINCIPAL a matrículas y liquidaciones de jornadas que quedaron sin sede.
 * Uso:
 *   node scripts/migrarSedeJornadasCap.js --listar
 *   node scripts/migrarSedeJornadasCap.js --confirmar
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { models: cat } = require('../src/models/catalogos');
const Matricula = require('../src/models/Matricula');
const Liquidacion = require('../src/models/Liquidacion');
const { esProgramaJornadasCap, resolverIdSedeMatriculaJornada } = require('../src/services/jornadaCapacitacion');

async function idsProgramasJornada() {
  const rows = await cat.programas.find({}).lean();
  const ids = [];
  for (const p of rows) {
    if (await esProgramaJornadasCap(p)) {
      ids.push(String(p.idPrograma ?? p._id));
    }
  }
  return [...new Set(ids)];
}

async function main() {
  const listar = process.argv.includes('--listar');
  const confirmar = process.argv.includes('--confirmar');

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/argo');

  const idSede = await resolverIdSedeMatriculaJornada();
  const progIds = await idsProgramasJornada();
  const filtroProg = {
    $or: [{ idProg: { $in: progIds } }, { idPrograma: { $in: progIds } }],
  };
  const filtroSedeVacia = {
    $or: [{ idSede: null }, { idSede: '' }, { idSede: { $exists: false } }],
  };

  const matFilter = { $and: [filtroProg, filtroSedeVacia] };
  const liqFilter = { $and: [filtroProg, filtroSedeVacia] };

  const matCount = await Matricula.countDocuments(matFilter);
  const liqCount = await Liquidacion.countDocuments(liqFilter);

  console.log('\n=== Migración sede jornadas de capacitación ===\n');
  console.log(`Sede destino: ${idSede}`);
  console.log(`Programas jornada detectados: ${progIds.length}`);
  console.log(`Matrículas sin sede: ${matCount}`);
  console.log(`Liquidaciones sin sede: ${liqCount}\n`);

  if (listar || !confirmar) {
    if (!confirmar) {
      console.log('Para aplicar ejecute:');
      console.log('  node scripts/migrarSedeJornadasCap.js --confirmar\n');
    }
    await mongoose.disconnect();
    return;
  }

  const rMat = await Matricula.updateMany(matFilter, { $set: { idSede } });
  const rLiq = await Liquidacion.updateMany(liqFilter, { $set: { idSede } });
  console.log(`Matrículas actualizadas: ${rMat.modifiedCount ?? 0}`);
  console.log(`Liquidaciones actualizadas: ${rLiq.modifiedCount ?? 0}\n`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
