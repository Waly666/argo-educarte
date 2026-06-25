/**
 * Elimina clases CEA e inscripciones por estado (reprogramación desde cero).
 *
 * Uso:
 *   node scripts/depurarClasesCea.js --listar
 *   node scripts/depurarClasesCea.js --listar --estados CREADO,PROGRAMADA,FINALIZADO
 *   node scripts/depurarClasesCea.js --confirmar --reset-matriculas
 *   node scripts/depurarClasesCea.js --confirmar --todas
 *
 * Por defecto borra: CREADO (pendiente), PROGRAMADA y FINALIZADO.
 * No borra EN PROCESO ni CANCELADA salvo --todas.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const ClaseProgramadaCea = require('../src/models/ClaseProgramadaCea');
const InscripcionClaseCea = require('../src/models/InscripcionClaseCea');
const Matricula = require('../src/models/Matricula');
const { ESTADOS_CLASE_CEA } = require('../src/constants/programacionCea');

const DEFAULT_ESTADOS = ['CREADO', 'PROGRAMADA', 'FINALIZADO'];

function parseEstados(argv) {
  const idx = argv.indexOf('--estados');
  if (idx < 0 || !argv[idx + 1]) return DEFAULT_ESTADOS;
  return argv[idx + 1]
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

async function resumenPorEstado(filtro = {}) {
  return ClaseProgramadaCea.aggregate([
    ...(Object.keys(filtro).length ? [{ $match: filtro }] : []),
    { $group: { _id: '$estado', total: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
}

async function main() {
  const listar = process.argv.includes('--listar');
  const confirmar = process.argv.includes('--confirmar');
  const todas = process.argv.includes('--todas');
  const resetMatriculas = process.argv.includes('--reset-matriculas');
  const estados = todas ? [...ESTADOS_CLASE_CEA] : parseEstados(process.argv);

  const invalidos = estados.filter((e) => !ESTADOS_CLASE_CEA.includes(e));
  if (invalidos.length) {
    console.error(`Estados inválidos: ${invalidos.join(', ')}`);
    console.error(`Válidos: ${ESTADOS_CLASE_CEA.join(', ')}`);
    process.exit(1);
  }

  await connectDB();

  const filtroClases = { estado: { $in: estados } };
  const totalClases = await ClaseProgramadaCea.countDocuments();
  const totalBorrar = await ClaseProgramadaCea.countDocuments(filtroClases);
  const idsBorrar = await ClaseProgramadaCea.find(filtroClases).select('_id').lean();
  const idSet = idsBorrar.map((c) => c._id);
  const totalInscripcionesBorrar = idSet.length
    ? await InscripcionClaseCea.countDocuments({ idClase: { $in: idSet } })
    : 0;
  const totalInscripciones = await InscripcionClaseCea.countDocuments();
  const matsConFlag = await Matricula.countDocuments({ clasesCeaAutoGeneradas: true });

  const porEstado = await resumenPorEstado();
  const porEstadoBorrar = await resumenPorEstado(filtroClases);
  const muestra = await ClaseProgramadaCea.find(filtroClases)
    .sort({ fechaClase: -1, horaDesde: -1 })
    .limit(10)
    .select('idProg tipoClase fechaClase horaDesde estado inscritos cupoMaximo')
    .lean();

  console.log('\n=== Depuración clases CEA ===\n');
  console.log(`Estados a borrar: ${estados.join(', ')}`);
  console.log(`Clases en BD: ${totalClases} → a eliminar: ${totalBorrar}`);
  console.log(`Inscripciones en BD: ${totalInscripciones} → a eliminar: ${totalInscripcionesBorrar}`);
  console.log(`Matrículas con clasesCeaAutoGeneradas: ${matsConFlag}`);
  if (resetMatriculas) console.log('Tras borrar: se reseteará clasesCeaAutoGeneradas en todas las matrículas.\n');
  else console.log('(Use --reset-matriculas para permitir regenerar clases por alumno.)\n');

  if (porEstado.length) {
    console.log('Todas las clases por estado:');
    console.table(porEstado.map((r) => ({ estado: r._id || '—', total: r.total })));
  }

  if (porEstadoBorrar.length) {
    console.log('Clases que se eliminarían:');
    console.table(porEstadoBorrar.map((r) => ({ estado: r._id || '—', total: r.total })));
  }

  const conservadas = await ClaseProgramadaCea.countDocuments({ estado: { $nin: estados } });
  if (conservadas > 0) {
    const rest = await resumenPorEstado({ estado: { $nin: estados } });
    console.log('Clases que NO se tocan:');
    console.table(rest.map((r) => ({ estado: r._id || '—', total: r.total })));
  }

  if (muestra.length) {
    console.log('Muestra de clases a eliminar:');
    console.table(
      muestra.map((c) => ({
        programa: c.idProg,
        tipo: c.tipoClase,
        fecha: c.fechaClase ? new Date(c.fechaClase).toISOString().slice(0, 10) : '—',
        hora: c.horaDesde || '—',
        estado: c.estado,
        inscritos: `${c.inscritos ?? 0}/${c.cupoMaximo ?? '—'}`,
      })),
    );
  }

  if (listar || !confirmar) {
    if (!listar && !confirmar) {
      console.log('Para ejecutar el borrado:');
      console.log('  node scripts/depurarClasesCea.js --confirmar --reset-matriculas');
      console.log('  node scripts/depurarClasesCea.js --confirmar --todas --reset-matriculas\n');
    }
    await mongoose.disconnect();
    return;
  }

  if (!totalBorrar) {
    console.log('No hay clases que coincidan con el filtro. Nada que borrar.');
    if (resetMatriculas && matsConFlag > 0) {
      const rMat = await Matricula.updateMany({}, { $set: { clasesCeaAutoGeneradas: false } });
      console.log(`Matrículas reseteadas (clasesCeaAutoGeneradas): ${rMat.modifiedCount ?? 0}`);
    }
    await mongoose.disconnect();
    return;
  }

  const rIns = await InscripcionClaseCea.deleteMany({ idClase: { $in: idSet } });
  const rCls = await ClaseProgramadaCea.deleteMany(filtroClases);
  console.log(`\nEliminadas inscripciones: ${rIns.deletedCount ?? 0}`);
  console.log(`Eliminadas clases: ${rCls.deletedCount ?? 0}`);

  if (resetMatriculas) {
    const rMat = await Matricula.updateMany({}, { $set: { clasesCeaAutoGeneradas: false } });
    console.log(`Matrículas reseteadas (clasesCeaAutoGeneradas): ${rMat.modifiedCount ?? 0}`);
  }

  console.log('\nListo. Puede volver a generar clases desde Programación CEA → Pendientes.\n');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
