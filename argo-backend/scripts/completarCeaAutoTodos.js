/**
 * Genera o inscribe clases teóricas/taller faltantes para todos los alumnos afectados.
 * Uso: node scripts/completarCeaAutoTodos.js [--dry-run]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const {
  completarClasesGrupalesTodos,
  contarClasesGrupalesFaltantesAlumno,
} = require('../src/services/programacionCeaAuto');
const Matricula = require('../src/models/Matricula');
const DatosAlumno = require('../src/models/DatosAlumno');

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  await connectDB();

  const mats = await Matricula.find({ clasesCeaAutoGeneradas: true }).select('numDoc').lean();
  const numDocs = [...new Set(mats.map((m) => Number(m.numDoc)).filter((n) => Number.isFinite(n)))];

  console.log(`Matrículas CEA con clases generadas: ${mats.length}`);
  console.log(`Alumnos únicos: ${numDocs.length}\n`);

  const pendientes = [];
  for (const numDoc of numDocs) {
    const f = await contarClasesGrupalesFaltantesAlumno(numDoc);
    if (f.total <= 0) continue;
    const alumno = await DatosAlumno.findOne({ numDoc }).select('nombre1 apellido1').lean();
    const nombre = alumno
      ? [alumno.nombre1, alumno.apellido1].filter(Boolean).join(' ').trim()
      : String(numDoc);
    pendientes.push({ numDoc, nombre, ...f });
  }

  if (!pendientes.length) {
    console.log('No hay alumnos con clases teóricas/taller faltantes.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Alumnos con faltantes: ${pendientes.length}`);
  for (const p of pendientes) {
    console.log(
      `  · ${p.numDoc} ${p.nombre} → ${p.total} faltante(s) (${p.teoria} teoría, ${p.taller} taller)`,
    );
  }

  if (dryRun) {
    console.log('\n[--dry-run] No se aplicaron cambios.');
    await mongoose.disconnect();
    return;
  }

  console.log('\nCompletando…');
  const r = await completarClasesGrupalesTodos({ soloConFaltantes: true });
  console.log(`\nListo: ${r.alumnos} alumno(s), ${r.clasesGeneradas} clase(s) generada(s)/inscrita(s).`);
  for (const item of r.reporte) {
    console.log(
      `  ✓ ${item.numDoc} ${item.alumnoNombre}: +${item.clasesGeneradas} clase(s)`,
    );
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
