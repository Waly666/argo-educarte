/**
 * Catálogos base según esquema ARGO (cuando no vienen en Excel o están vacíos).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');

const CATALOGOS = {
  catTipoDoc: [
    { idTipoDoc: '1', codigo: 'CC', descripcion: '1) CEDULA DE CIUDADANÍA' },
    { idTipoDoc: '2', codigo: 'TI', descripcion: '2) TARJETA DE IDENTIDAD' },
    { idTipoDoc: '3', codigo: 'RC', descripcion: '3) REGISTRO CIVIL' },
    { idTipoDoc: '4', codigo: 'CE', descripcion: '4) CEDULA DE EXTRANJERIA' },
    { idTipoDoc: '5', codigo: 'PA', descripcion: '5) PASAPORTE' },
    { idTipoDoc: '6', codigo: 'NIT', descripcion: '6) NUMERO DE IDENTIFICACION TRIBUTARIA' },
  ],
  catRegimenSalud: [
    { idRegimen: '1', descripcion: '1) CONTRIBUTIVO' },
    { idRegimen: '2', descripcion: '2) SUBSIDIADO' },
    { idRegimen: '3', descripcion: '3) ESPECIAL' },
    { idRegimen: '4', descripcion: '4) NO AFILIADO' },
  ],
  jornada: [
    { idJornada: '1', descripcion: '1) DIURNA' },
    { idJornada: '2', descripcion: '2) NOCTURNA' },
    { idJornada: '3', descripcion: '3) FIN DE SEMANA' },
  ],
  estrato: [
    { idEstrato: '1', descripcion: '1) 1' },
    { idEstrato: '2', descripcion: '2) 2' },
    { idEstrato: '3', descripcion: '3) 3' },
    { idEstrato: '4', descripcion: '4) 4' },
    { idEstrato: '5', descripcion: '5) 5' },
    { idEstrato: '6', descripcion: '6) 6' },
    { idEstrato: '99', descripcion: '7) 99' },
  ],
  nivelFormacion: [
    { idNivel: '1', descripcion: '1) PREESCOLAR' },
    { idNivel: '2', descripcion: '2) BÁSICA PRIMARIA' },
    { idNivel: '3', descripcion: '3) BÁSICA SECUNDARIA' },
    { idNivel: '4', descripcion: '4) MEDIA' },
    { idNivel: '5', descripcion: '5) PREGRADO' },
    { idNivel: '6', descripcion: '6) POSTGRADO' },
    { idNivel: '7', descripcion: '7) SIN ESTUDIOS' },
    { idNivel: '8', descripcion: '8) TÉCNICO LABORAL' },
  ],
  ocupacion: [
    { idOcupacion: '1', descripcion: '1) EMPLEADO' },
    { idOcupacion: '2', descripcion: '2) ESTUDIANTE. BÁSICA / MEDIA' },
    { idOcupacion: '3', descripcion: '3) ESTUDIANTE SUPERIOR' },
    { idOcupacion: '4', descripcion: '4) DESEMPLEADO' },
    { idOcupacion: '5', descripcion: '5) INDEPENDIENTE' },
  ],
  discapacidad: [
    { idDiscapacidad: '1', descripcion: '1) SORDERA PROFUNDA' },
    { idDiscapacidad: '2', descripcion: '2) HIPOACUSIA A BAJA AUDICION' },
    { idDiscapacidad: '3', descripcion: '3) BAJA VISION DIAGNOSTICA' },
    { idDiscapacidad: '4', descripcion: '4) CEGUERA' },
    { idDiscapacidad: '5', descripcion: '5) PARALISIS CEREBRAL' },
    { idDiscapacidad: '6', descripcion: '6) LESION NEUROMUSCULAR' },
    { idDiscapacidad: '7', descripcion: '7) DEFICIENCIA COGNITIVA(RETARDO EN EL DESARROLLO)' },
    { idDiscapacidad: '8', descripcion: '8) MULTIPLE' },
    { idDiscapacidad: '9', descripcion: '9) NO APLICA' },
  ],
  estadoCivil: [
    { idEstadoCivil: '1', descripcion: '1) SOLTERO' },
    { idEstadoCivil: '2', descripcion: '2) CASADO' },
    { idEstadoCivil: '3', descripcion: '3) UNIÓN LIBRE' },
    { idEstadoCivil: '4', descripcion: '4) SEPARADO' },
    { idEstadoCivil: '5', descripcion: '5) VIUDO' },
    { idEstadoCivil: '6', descripcion: '6) DIVORCIADO' },
    { idEstadoCivil: '7', descripcion: '7) SIN INFORMACIÓN' },
  ],
  genero: [
    { idGenero: 'M', descripcion: 'M' },
    { idGenero: 'F', descripcion: 'F' },
  ],
  tipoSangre: [
    { id: 'A+', descripcion: 'A+' },
    { id: 'A-', descripcion: 'A-' },
    { id: 'B+', descripcion: 'B+' },
    { id: 'B-', descripcion: 'B-' },
    { id: 'AB+', descripcion: 'AB+' },
    { id: 'AB-', descripcion: 'AB-' },
    { id: 'O+', descripcion: 'O+' },
    { id: 'O-', descripcion: 'O-' },
  ],
  catTipoPago: [
    { idTipoPago: '1', codigo: 'EF', descripcion: 'Efectivo' },
    { idTipoPago: '2', codigo: 'TR', descripcion: 'Transferencia' },
    { idTipoPago: '3', codigo: 'TC', descripcion: 'Tarjeta crédito' },
    { idTipoPago: '4', codigo: 'TD', descripcion: 'Tarjeta débito' },
    { idTipoPago: '5', codigo: 'CH', descripcion: 'Cheque' },
    { idTipoPago: '6', codigo: 'NE', descripcion: 'Nequi / Daviplata' },
    { idTipoPago: '7', codigo: 'PL', descripcion: 'Pago en línea' },
  ],
  multiCulturalidad: [
    { id: 'INDIGENA', descripcion: 'INDIGENA' },
    { id: 'AFRODESCENDIENTE', descripcion: 'AFRODESCENDIENTE' },
    { id: 'DESPLAZADO', descripcion: 'DESPLAZADO' },
    { id: 'POBLACION_FRONTERA', descripcion: 'POBLACIÓN DE FRONTERA' },
    { id: 'CABEZA_FAMILIA', descripcion: 'CABEZA DE FAMILIA' },
    { id: 'REINSERTADO', descripcion: 'REINSERTADO' },
    { id: 'POBLACION_ROM', descripcion: 'POBLACIÓN ROM' },
    { id: 'NO_APLICA', descripcion: 'NO APLICA' },
  ],
  modalidades: [
    { idModalidad: '1', codigo: 'PRESENCIAL', descripcion: 'Presencial', activo: true },
    { idModalidad: '2', codigo: 'VIRTUAL', descripcion: 'Virtual', activo: true },
    { idModalidad: '3', codigo: 'MIXTA', descripcion: 'Mixta', activo: true },
  ],
};

async function seedCollection(db, name, rows, force = false) {
  const col = db.collection(name);
  const count = await col.countDocuments();
  if (count > 0 && !force) {
    console.log(`  · ${name}: ya tiene ${count} registros (omitido)`);
    return;
  }
  if (count > 0) await col.deleteMany({});
  await col.insertMany(rows);
  console.log(`  · ${name}: ${rows.length} registros`);
}

/** Billeteras digitales (no suelen venir en Excel legacy) */
const BANCOS_EXTRA = [
  { idbanco: 31, idBanco: '31', banco: 'NEQUI', descripcion: 'NEQUI' },
  { idbanco: 32, idBanco: '32', banco: 'DAVIPLATA', descripcion: 'DAVIPLATA' },
];

async function upsertBancosExtra(db) {
  const col = db.collection('bancos');
  for (const row of BANCOS_EXTRA) {
    const r = await col.updateOne(
      { $or: [{ idbanco: row.idbanco }, { idBanco: row.idBanco }, { banco: row.banco }] },
      { $set: row },
      { upsert: true },
    );
    console.log(`  · bancos ${row.banco}: ${r.upsertedCount ? 'creado' : 'actualizado'}`);
  }
}

(async () => {
  try {
    await connectDB();
    const db = mongoose.connection.db;
    const force = process.argv.includes('--force');
    console.log('[seedCatalogosBase] Cargando catálogos de alumnos…');
    for (const [name, rows] of Object.entries(CATALOGOS)) {
      await seedCollection(db, name, rows, force);
    }
    await upsertBancosExtra(db);
    await mongoose.disconnect();
    console.log('[seedCatalogosBase] OK');
    process.exit(0);
  } catch (err) {
    console.error('[seedCatalogosBase] Error:', err);
    process.exit(1);
  }
})();
