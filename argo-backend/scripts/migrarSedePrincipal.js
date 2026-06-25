/**
 * Migración multi-sede: crea sede PRINCIPAL y asigna idSede=PRINCIPAL
 * a TODOS los registros existentes en colecciones operativas (pre-cambio sede).
 *
 * Uso: node scripts/migrarSedePrincipal.js
 *      node scripts/migrarSedePrincipal.js --forzar   (reescribe idSede aunque ya tenga valor)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { asegurarSedePrincipal, ID_SEDE_PRINCIPAL } = require('../src/services/sedeContext');

/** Colecciones que llevan sede (caja, alumnos/finanzos, CEA, recursos). Jornadas cap. NO. */
const COLECCIONES_SEDE = [
  'cajaSesiones',
  'ingresos',
  'egresos',
  'matriculas',
  'liquidacion',
  'empleados',
  'clasesProgramadasCea',
  'inscripcionesClaseCea',
  'vehiculos',
  'aulas',
  'talleres',
  'cajaCierresGenerales',
  'cajaDescuadres',
  'inspeccionesvehiculos',
];

/** Certificados CEA/curso (no los auto-generados por jornada móvil). */
const FILTRO_CERTIFICADOS = {
  $or: [
    { generadoAutoJornada: { $ne: true } },
    { generadoAutoJornada: { $exists: false } },
    { idJornada: null },
    { idJornada: { $exists: false } },
  ],
};

function filtroSinSede(forzar) {
  if (forzar) return {};
  return {
    $or: [
      { idSede: { $exists: false } },
      { idSede: null },
      { idSede: '' },
    ],
  };
}

async function patchCollection(db, name, opts = {}) {
  const col = db.collection(name);
  const exists = (await col.countDocuments({}, { limit: 1 })) > 0;
  if (!exists) return { updated: 0, total: 0, skip: true };

  const filter = opts.filterExtra
    ? { $and: [filtroSinSede(opts.forzar), opts.filterExtra] }
    : filtroSinSede(opts.forzar);

  const total = await col.countDocuments({});
  const r = await col.updateMany(filter, { $set: { idSede: ID_SEDE_PRINCIPAL } });
  const updated = r.modifiedCount ?? r.nModified ?? 0;
  const matched = r.matchedCount ?? r.n ?? updated;
  return { updated, matched, total, skip: false };
}

async function patchCertificados(db, forzar) {
  const col = db.collection('certificados');
  const exists = (await col.countDocuments({}, { limit: 1 })) > 0;
  if (!exists) return { updated: 0, total: 0, skip: true };

  const filter = forzar
    ? FILTRO_CERTIFICADOS
    : { $and: [filtroSinSede(false), FILTRO_CERTIFICADOS] };

  const total = await col.countDocuments({});
  const r = await col.updateMany(filter, { $set: { idSede: ID_SEDE_PRINCIPAL } });
  return {
    updated: r.modifiedCount ?? r.nModified ?? 0,
    matched: r.matchedCount ?? r.n ?? 0,
    total,
    skip: false,
  };
}

async function patchUsuarios(db, forzar) {
  const col = db.collection('usuarios');
  const exists = (await col.countDocuments({}, { limit: 1 })) > 0;
  if (!exists) return { updated: 0, total: 0, skip: true };

  const total = await col.countDocuments({});
  const filter = forzar
    ? {}
    : {
        $or: [
          { sedesPermitidas: { $exists: false } },
          { sedesPermitidas: null },
          { sedesPermitidas: { $size: 0 } },
          { sedesPermitidas: { $not: { $elemMatch: { $eq: ID_SEDE_PRINCIPAL } } } },
        ],
      };

  const r = await col.updateMany(filter, {
    $set: { sedesPermitidas: [ID_SEDE_PRINCIPAL] },
  });
  return {
    updated: r.modifiedCount ?? r.nModified ?? 0,
    matched: r.matchedCount ?? r.n ?? 0,
    total,
    skip: false,
  };
}

async function escanearOtrasColecciones(db, forzar) {
  const omitir = new Set([
    ...COLECCIONES_SEDE,
    'certificados',
    'sedes',
    'config',
    'auditoria',
    'actividadHttp',
    // Jornadas capacitación — sin sede
    'jornadasCap',
    'clasesJornadaCap',
    'contratacion',
    'inscripcionClase',
    'asisClasJorCap',
    'supervisores',
  ]);

  const nombres = (await db.listCollections().toArray()).map((c) => c.name);
  const extras = [];

  for (const name of nombres) {
    if (omitir.has(name) || name.startsWith('system.')) continue;
    const col = db.collection(name);
    const conCampo = await col.countDocuments({ idSede: { $exists: true } }, { limit: 1 });
    if (!conCampo) continue;
    const sinAsignar = await col.countDocuments(filtroSinSede(forzar));
    if (sinAsignar > 0) {
      const r = await col.updateMany(filtroSinSede(forzar), { $set: { idSede: ID_SEDE_PRINCIPAL } });
      extras.push({
        name,
        updated: r.modifiedCount ?? r.nModified ?? 0,
      });
    }
  }
  return extras;
}

async function fixCierreIndex(db) {
  const col = db.collection('cajaCierresGenerales');
  try {
    await col.dropIndex('fechaDia_1');
  } catch {
    /* puede no existir */
  }
  try {
    await col.createIndex({ fechaDia: 1, idSede: 1 }, { unique: true, sparse: true });
  } catch (e) {
    console.warn('Índice cierre general:', e.message);
  }
}

async function main() {
  const forzar = process.argv.includes('--forzar');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Falta MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const sede = await asegurarSedePrincipal();
  console.log(`Sede principal: ${sede.idSede} — ${sede.nombre}`);
  if (forzar) console.log('Modo --forzar: se reasigna idSede=PRINCIPAL en todas las colecciones listadas.\n');

  const db = mongoose.connection.db;
  let totalActualizados = 0;

  for (const name of COLECCIONES_SEDE) {
    try {
      const r = await patchCollection(db, name, { forzar });
      if (r.skip) {
        console.log(`  ${name}: (vacía)`);
      } else {
        console.log(`  ${name}: ${r.updated} actualizados / ${r.total} total`);
        totalActualizados += r.updated;
      }
    } catch (e) {
      console.warn(`  ${name}: error (${e.message})`);
    }
  }

  try {
    const r = await patchCertificados(db, forzar);
    if (!r.skip) {
      console.log(`  certificados (no jornada): ${r.updated} actualizados / ${r.total} total`);
      totalActualizados += r.updated;
    }
  } catch (e) {
    console.warn(`  certificados: error (${e.message})`);
  }

  try {
    const r = await patchUsuarios(db, forzar);
    if (!r.skip) {
      console.log(`  usuarios: ${r.updated} actualizados / ${r.total} total (sedesPermitidas=[PRINCIPAL])`);
      totalActualizados += r.updated;
    }
  } catch (e) {
    console.warn(`  usuarios: error (${e.message})`);
  }

  const extras = await escanearOtrasColecciones(db, forzar);
  for (const e of extras) {
    console.log(`  ${e.name} (extra): ${e.updated} actualizados`);
    totalActualizados += e.updated;
  }

  await fixCierreIndex(db);
  console.log(`\nTotal documentos actualizados: ${totalActualizados}`);
  console.log('Índice cajaCierresGenerales (fechaDia + idSede) verificado.');
  await mongoose.disconnect();
  console.log('Migración sede PRINCIPAL completada.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
