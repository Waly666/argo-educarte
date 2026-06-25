/**
 * scripts/fixAdmin.js
 *
 * - Quita el índice único 'nickName_1' si existe (no debe ser único).
 * - Garantiza que exista admin con username='admin' y password='admin123'.
 *   Si ya existe, fuerza el reset del passwordHash.
 *
 * Uso: node scripts/fixAdmin.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const Usuario = require('../src/models/Usuario');

(async () => {
  try {
    await connectDB();
    const col = mongoose.connection.db.collection('usuarios');

    const indexes = await col.indexes();
    const malIdx = indexes.find((i) => i.name === 'nickName_1' && i.unique);
    if (malIdx) {
      await col.dropIndex('nickName_1');
      console.log('[fixAdmin] Índice único nickName_1 eliminado');
    } else {
      console.log('[fixAdmin] No hay índice único en nickName (OK)');
    }

    const passwordHash = await Usuario.hashPassword('admin123');

    const exist = await Usuario.findOne({ username: 'admin' });
    if (exist) {
      exist.passwordHash = passwordHash;
      exist.activo = true;
      exist.rol = exist.rol || 'admin';
      await exist.save();
      console.log('[fixAdmin] admin existente — password reseteado a admin123');
    } else {
      await Usuario.create({
        username: 'admin',
        nombres: 'Administrador',
        apellidos: 'ARGO',
        rol: 'admin',
        activo: true,
        passwordHash,
      });
      console.log('[fixAdmin] admin creado (usuario=admin / password=admin123)');
    }

    const total = await Usuario.countDocuments({});
    console.log(`[fixAdmin] Total usuarios en la BD: ${total}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[fixAdmin] Error:', err);
    process.exit(1);
  }
})();
