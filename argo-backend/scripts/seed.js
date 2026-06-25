/**
 * scripts/seed.js
 *
 * Lee excel/catalogos.xlsx (en la raíz del repo) y vuelca cada hoja a su colección
 * correspondiente en MongoDB. Cada hoja debe llamarse como la colección destino
 * y los encabezados de columnas deben coincidir con los nombres de campos.
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const XLSX = require('xlsx');

const { connectDB } = require('../src/config/db');

const HOJAS_OMITIR = new Set(['usuarios']); // los usuarios se cargan con seed:users

function limpiarFila(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = String(k).trim();
    if (!key) continue;
    if (typeof v === 'string') {
      const t = v.trim();
      out[key] = t === '' ? null : t;
    } else {
      out[key] = v;
    }
  }
  return out;
}

async function cargarHoja(db, sheetName, rows) {
  if (HOJAS_OMITIR.has(sheetName)) {
    console.log(`  · ${sheetName}: omitida (se carga con seed:users)`);
    return;
  }
  const col = db.collection(sheetName);
  await col.deleteMany({});
  if (rows.length > 0) await col.insertMany(rows);
  console.log(`  · ${sheetName}: ${rows.length} documentos`);
}

async function derivarCarrocerias(db, claseRows) {
  if (!claseRows || claseRows.length === 0) return;
  const set = new Map();
  for (const r of claseRows) {
    const idC = r.idCarroceria || r.idCarro || r.carroceriaId;
    const desc = r.carroceria || r.descripcionCarroceria;
    if (idC && desc && !set.has(String(idC))) {
      set.set(String(idC), { idCarroceria: String(idC), descripcion: String(desc) });
    }
  }
  if (set.size === 0) return;
  const col = db.collection('carrocerias');
  await col.deleteMany({});
  await col.insertMany([...set.values()]);
  console.log(`  · carrocerias (derivada): ${set.size} documentos`);
}

(async () => {
  try {
    const xlsxPath = path.join(__dirname, '..', '..', 'excel', 'catalogos.xlsx');
    if (!fs.existsSync(xlsxPath)) {
      console.error(`No se encontró ${xlsxPath}`);
      process.exit(1);
    }
    await connectDB();
    const db = mongoose.connection.db;

    const wb = XLSX.readFile(xlsxPath);
    console.log(`[seed] Hojas detectadas: ${wb.SheetNames.length}`);

    let claseRows = null;
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: null });
      const rows = raw.map(limpiarFila);
      if (sheetName === 'claseVehiculo') claseRows = rows;
      await cargarHoja(db, sheetName, rows);
    }

    if (claseRows) await derivarCarrocerias(db, claseRows);

    await mongoose.disconnect();
    console.log('[seed] OK');
    process.exit(0);
  } catch (err) {
    console.error('[seed] Error:', err);
    process.exit(1);
  }
})();
