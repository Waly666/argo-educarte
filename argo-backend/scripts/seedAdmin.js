/**
 * scripts/seedAdmin.js
 *
 * - Asegura que exista un usuario administrador (admin / admin123).
 * - Si existe el archivo excel/catalogos.xlsx con hoja "usuarios", carga esos usuarios
 *   y asigna como contraseña por defecto el username (en minúsculas) si no hay password en Excel.
 *
 * Uso:
 *   pnpm run seed:users
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const { connectDB } = require('../src/config/db');
const Usuario = require('../src/models/Usuario');

const ROLES_VALIDOS = ['admin', 'usuario', 'cajero', 'instructor', 'recepcion'];

function normalizarRol(r) {
  if (!r) return 'usuario';
  const v = String(r).trim().toLowerCase();
  if (ROLES_VALIDOS.includes(v)) return v;
  if (v.includes('admin')) return 'admin';
  if (v.includes('caj'))   return 'cajero';
  if (v.includes('inst'))  return 'instructor';
  if (v.includes('rec'))   return 'recepcion';
  return 'usuario';
}

async function ensureAdmin() {
  const u = await Usuario.findOne({ username: 'admin' });
  if (u) {
    // Re-aseguro password en caso de duda
    if (!u.passwordHash) {
      u.passwordHash = await Usuario.hashPassword('admin123');
      await u.save();
      console.log('[seedAdmin] admin reseteado con password admin123');
    } else {
      console.log('[seedAdmin] admin ya existe');
    }
    return;
  }
  const passwordHash = await Usuario.hashPassword('admin123');
  await Usuario.create({
    username: 'admin',
    nombres: 'Administrador',
    apellidos: 'ARGO',
    rol: 'admin',
    activo: true,
    passwordHash,
  });
  console.log('[seedAdmin] admin creado (usuario=admin / password=admin123)');
}

async function cargarUsuariosDesdeExcel() {
  const xlsxPath = path.join(__dirname, '..', '..', 'excel', 'catalogos.xlsx');
  if (!fs.existsSync(xlsxPath)) {
    console.log('[seedAdmin] No hay catalogos.xlsx, salteando carga de usuarios');
    return;
  }
  const XLSX = require('xlsx');
  const wb = XLSX.readFile(xlsxPath);
  const sheet = wb.Sheets['usuarios'];
  if (!sheet) {
    console.log('[seedAdmin] No hay hoja "usuarios" en catalogos.xlsx');
    return;
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  console.log(`[seedAdmin] Hoja usuarios: ${rows.length} filas`);

  let creados = 0, actualizados = 0, omitidos = 0;
  for (const r of rows) {
    const username = String(r.username || r.usuario || r.user || r.nickName || r.nick || r.alias || '')
      .trim()
      .toLowerCase();
    if (!username) { omitidos++; continue; }

    const userKey = username;
    const passPlano = String(r.password || userKey).trim();
    const passwordHash = await Usuario.hashPassword(passPlano);

    const doc = {
      username: userKey,
      nombres:   String(r.nombres   || '').trim(),
      apellidos: String(r.apellidos || '').trim(),
      email:     String(r.email     || '').trim().toLowerCase(),
      rol: normalizarRol(r.rol || r.role),
      activo: true,
      passwordHash,
    };

    const exist = await Usuario.findOne({ username: userKey });
    if (exist) {
      // Si ya hay password, NO la sobreescribimos (respetamos cambios)
      if (!exist.passwordHash) exist.passwordHash = passwordHash;
      exist.nombres = doc.nombres || exist.nombres;
      exist.apellidos = doc.apellidos || exist.apellidos;
      exist.email = doc.email || exist.email;
      exist.rol = doc.rol;
      exist.activo = true;
      await exist.save();
      actualizados++;
    } else {
      await Usuario.create(doc);
      creados++;
    }
  }
  console.log(`[seedAdmin] Usuarios — creados: ${creados}, actualizados: ${actualizados}, omitidos: ${omitidos}`);
  console.log('[seedAdmin] Para usuarios cargados desde Excel: la contraseña por defecto es el username si no viene password.');
}

(async () => {
  try {
    await connectDB();
    await ensureAdmin();
    await cargarUsuariosDesdeExcel();
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[seedAdmin] Error:', err);
    process.exit(1);
  }
})();
