const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const XLSX = require('xlsx');

const HOJAS_OMITIR = new Set(['usuarios', 'programas', 'servicios']);

const { camposEsquema } = require('./catalogoMeta');

function limpiarFila(obj, sheetName) {
  const out = {};
  const esquema = sheetName ? camposEsquema(sheetName) : null;
  for (const [k, v] of Object.entries(obj)) {
    const key = String(k).trim();
    if (!key) continue;
    if (/^col\d+$/i.test(key)) continue;
    if (esquema && !esquema.includes(key)) continue;
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
    return { omitida: true, count: 0 };
  }
  const col = db.collection(sheetName);
  await col.deleteMany({});
  if (rows.length > 0) await col.insertMany(rows);
  return { omitida: false, count: rows.length };
}

async function derivarCarrocerias(db, claseRows) {
  if (!claseRows?.length) return 0;
  const set = new Map();
  for (const r of claseRows) {
    const idC = r.idCarroceria || r.idCarro || r.carroceriaId;
    const desc = r.carroceria || r.descripcionCarroceria;
    if (idC && desc && !set.has(String(idC))) {
      set.set(String(idC), { idCarroceria: String(idC), descripcion: String(desc) });
    }
  }
  if (set.size === 0) return 0;
  const col = db.collection('carrocerias');
  await col.deleteMany({});
  await col.insertMany([...set.values()]);
  return set.size;
}

/**
 * Recarga catálogos desde excel/catalogos.xlsx (misma lógica que scripts/seed.js).
 * @param {{ soloHoja?: string }} opts
 */
async function recargarDesdeExcel(opts = {}) {
  const xlsxPath = path.join(__dirname, '..', '..', '..', 'excel', 'catalogos.xlsx');
  if (!fs.existsSync(xlsxPath)) {
    const err = new Error(`No se encontró el archivo ${xlsxPath}`);
    err.status = 404;
    throw err;
  }
  const db = mongoose.connection.db;
  const wb = XLSX.readFile(xlsxPath);
  const hojas = opts.soloHoja ? [opts.soloHoja] : wb.SheetNames;
  const resumen = [];
  let claseRows = null;

  for (const sheetName of hojas) {
    if (!wb.Sheets[sheetName]) {
      resumen.push({ hoja: sheetName, error: 'Hoja no encontrada' });
      continue;
    }
    const sheet = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(sheet, { defval: null });
    const rows = raw.map((r) => limpiarFila(r, sheetName));
    if (sheetName === 'claseVehiculo') claseRows = rows;
    const r = await cargarHoja(db, sheetName, rows);
    resumen.push({
      hoja: sheetName,
      documentos: r.count,
      omitida: r.omitida,
    });
  }

  if (!opts.soloHoja && claseRows) {
    const n = await derivarCarrocerias(db, claseRows);
    if (n > 0) resumen.push({ hoja: 'carrocerias (derivada)', documentos: n });
  }

  return { archivo: xlsxPath, hojas: resumen };
}

module.exports = { recargarDesdeExcel, limpiarFila };
