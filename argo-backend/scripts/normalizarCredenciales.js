/**
 * Normaliza contraseñas de usuarios (últimos 4 del documento) y muestra credenciales de prueba.
 * Uso: node scripts/normalizarCredenciales.js
 *      node scripts/normalizarCredenciales.js --solo-listar
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('../src/models/Usuario');
const { findUsuarioPorLogin, passwordSugeridoParaUsuario } = require('../src/utils/usuarioLogin');

const soloListar = process.argv.includes('--solo-listar');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/argo');
  const users = await Usuario.find({}).sort({ rol: 1, username: 1 });

  console.log('\n=== CREDENCIALES ARGO (después de normalizar) ===\n');
  console.log('Login puede ser: documento, nick o usuario del sistema');
  console.log('Contraseña por defecto: últimos 4 dígitos del documento\n');

  for (const u of users) {
    const pass = passwordSugeridoParaUsuario(u);
    if (!soloListar) {
      const pass = passwordSugeridoParaUsuario(u);
      const hash = await Usuario.hashPassword(pass);
      const aliases = new Set((u.loginAliases || []).map((a) => String(a).toLowerCase()));
      if (u.nickName) aliases.add(String(u.nickName).toLowerCase());
      if (u.username === 'waly') {
        aliases.add('waly666');
        aliases.add('walter');
      }
      await Usuario.updateOne(
        { _id: u._id },
        {
          $set: {
            passwordHash: hash,
            activo: true,
            nickName: u.nickName || (!/^\d+$/.test(u.username || '') ? u.username : u.nickName),
            loginAliases: [...aliases].filter((a) => a && a !== u.username),
          },
        },
      );
    }

    const logins = [
      u.username,
      u.nickName,
      ...(u.loginAliases || []),
      u.numero != null ? String(u.numero) : null,
      u.numeroDocumento,
    ].filter(Boolean);
    const uniqLogins = [...new Set(logins)];

    let verificado = false;
    for (const lg of uniqLogins) {
      const found = await findUsuarioPorLogin(lg);
      if (found && String(found._id) === String(u._id)) {
        const ok = await found.compararPassword(pass);
        if (ok) verificado = true;
        break;
      }
    }

    console.log(
      [
        `${u.nombres || ''} ${u.apellidos || ''}`.trim() || '—',
        `rol=${u.rol}`,
        `login: ${uniqLogins.join(' | ')}`,
        `clave: ${pass}`,
        verificado ? '✓' : '✗ REVISAR',
      ].join('  ·  '),
    );
  }

  console.log('\n=== Fin ===\n');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
