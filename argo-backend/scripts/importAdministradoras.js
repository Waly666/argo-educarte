/**
 * Importa EPS, AFP, ARL y Cajas de compensación desde el Excel del Ministerio.
 *
 * Uso:
 *   node scripts/importAdministradoras.js [ruta-al.xls]
 *   pnpm run import:administradoras
 *
 * Por defecto busca:
 *   excel/Listado-con-codigos-administradoras.xls
 *   ../../Downloads/Listado-con-codigos-administradoras.xls
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { connectDB } = require('../src/config/db');
const Eps = require('../src/models/Eps');
const Afp = require('../src/models/Afp');
const Arl = require('../src/models/Arl');
const CajaCompensacion = require('../src/models/CajaCompensacion');
const { maxNumericId } = require('../src/services/programaServicio');

const TIPO_MAP = {
  EPS: { model: Eps, idField: 'idEps', label: 'EPS' },
  AFP: { model: Afp, idField: 'idAfp', label: 'AFP' },
  ARP: { model: Arl, idField: 'idArl', label: 'ARL' },
  CCF: { model: CajaCompensacion, idField: 'idCajaCompensacion', label: 'Cajas compensación' },
};

const HEADER_ROW = 30;
const DATA_START_ROW = 31;

function resolveArchivo(argPath) {
  const candidatos = [
    argPath,
    path.join(__dirname, '..', '..', 'excel', 'Listado-con-codigos-administradoras.xls'),
    path.join(__dirname, '..', '..', 'excel', 'Listado-con-codigos-administradoras.xlsx'),
    path.join('c:', 'Users', 'walte', 'Downloads', 'Listado-con-codigos-administradoras.xls'),
  ].filter(Boolean);
  for (const p of candidatos) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function celda(sh, r, c) {
  const cell = sh[XLSX.utils.encode_cell({ r, c })];
  if (cell == null || cell.v == null) return '';
  return String(cell.v).trim();
}

function limpiarNombre(n) {
  return String(n || '')
    .replace(/^SSS\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFilas(sh) {
  const range = XLSX.utils.decode_range(sh['!ref'] || 'A1:A1');
  const filas = [];
  for (let r = DATA_START_ROW; r <= range.e.r; r += 1) {
    const tipo = celda(sh, r, 0).toUpperCase();
    if (!TIPO_MAP[tipo]) continue;
    const codigoMinisterio = celda(sh, r, 1);
    const nombre = limpiarNombre(celda(sh, r, 3));
    if (!codigoMinisterio || !nombre) continue;
    filas.push({
      tipo,
      codigoMinisterio,
      nit: celda(sh, r, 2),
      nombre,
      direccion: celda(sh, r, 4),
      ciudad: celda(sh, r, 5),
      telefono: celda(sh, r, 6),
    });
  }
  return filas;
}

async function upsertRegistro(cfg, row) {
  const { model, idField } = cfg;
  const now = new Date();
  const doc = {
    codigoMinisterio: row.codigoMinisterio,
    nit: row.nit || undefined,
    nombre: row.nombre,
    direccion: row.direccion || undefined,
    ciudad: row.ciudad || undefined,
    telefono: row.telefono || undefined,
    estado: 'activo',
    updatedAt: now,
    userChangeRecord: 'import-administradoras',
  };

  const existente = await model.findOne({ codigoMinisterio: row.codigoMinisterio }).lean();
  if (existente) {
    await model.updateOne({ _id: existente._id }, { $set: doc });
    return 'actualizado';
  }

  const id = await maxNumericId(model, idField);
  await model.create({
    [idField]: id,
    ...doc,
    createdAt: now,
    userAddReg: 'import-administradoras',
  });
  return 'insertado';
}

async function main() {
  const archivo = resolveArchivo(process.argv[2]);
  if (!archivo) {
    console.error('No se encontró el archivo Excel. Pase la ruta como argumento.');
    process.exit(1);
  }

  console.log('[import] Archivo:', archivo);
  const wb = XLSX.readFile(archivo);
  const sh = wb.Sheets[wb.SheetNames[0]];
  const filas = parseFilas(sh);
  console.log('[import] Registros EPS/AFP/ARL/CCF:', filas.length);

  await connectDB();

  const resumen = { insertado: 0, actualizado: 0, porTipo: {} };

  for (const row of filas) {
    const cfg = TIPO_MAP[row.tipo];
    const accion = await upsertRegistro(cfg, row);
    resumen[accion] += 1;
    resumen.porTipo[row.tipo] = resumen.porTipo[row.tipo] || { insertado: 0, actualizado: 0 };
    resumen.porTipo[row.tipo][accion] += 1;
  }

  console.log('[import] Resultado:', JSON.stringify(resumen, null, 2));

  const totales = await Promise.all([
    Eps.countDocuments(),
    Afp.countDocuments(),
    Arl.countDocuments(),
    CajaCompensacion.countDocuments(),
  ]);
  console.log('[import] Totales en BD — EPS:', totales[0], 'AFP:', totales[1], 'ARL:', totales[2], 'CCF:', totales[3]);

  await require('mongoose').disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[import] Error:', err);
  process.exit(1);
});
