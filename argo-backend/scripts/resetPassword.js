/**
 * Restablece la contraseña de un usuario por username.
 * Uso: node scripts/resetPassword.js waly666 nuevaClave
 */
require('dotenv').config();
const { connectDB } = require('../src/config/db');
const Usuario = require('../src/models/Usuario');
const { findUsuarioPorLogin } = require('../src/utils/usuarioLogin');

const login = (process.argv[2] || '').trim();
const nueva = process.argv[3] || login || 'waly666';

(async () => {
  if (!login) {
    console.error('Uso: node scripts/resetPassword.js <usuario> [nuevaContraseña]');
    process.exit(1);
  }
  try {
    await connectDB();
    const u = await findUsuarioPorLogin(login);
    if (!u) {
      console.error(`No se encontró usuario: ${login}`);
      process.exit(1);
    }
    u.passwordHash = await Usuario.hashPassword(nueva);
    u.activo = true;
    await u.save();
    console.log('[resetPassword] OK');
    console.log(`  Usuario: ${u.username}`);
    console.log(`  Nueva clave:   ${nueva}`);
    process.exit(0);
  } catch (err) {
    console.error('[resetPassword] Error:', err.message);
    process.exit(1);
  }
})();
