/**
 * Convierte usernames que son solo documento a nombre.apellido y alias corto.
 * Uso: node scripts/migrarUsuariosLoginLegible.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('../src/models/Usuario');
const Empleado = require('../src/models/Empleado');
const {
  usernameDesdeEmpleado,
} = require('../src/services/empleadoUsuario');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/argo';
  await mongoose.connect(uri);
  const rows = await Usuario.find({}).lean();
  let ok = 0;
  for (const u of rows) {
    const login = String(u.username || '').trim();
    if (!/^\d+$/.test(login)) continue;

    const emp = u.idEmpleado
      ? await Empleado.findOne({ idEmpleado: u.idEmpleado }).lean()
      : null;
    const base = emp || {
      primerNombre: u.nombres,
      primerApellido: u.apellidos,
      nombres: u.nombres,
      apellidos: u.apellidos,
      numeroDocumento: u.numeroDocumento || login,
      idEmpleado: u.idEmpleado,
    };

    const friendly = await usernameDesdeEmpleado(base, u._id);
    const $set = { username: friendly };
    if (!u.numeroDocumento) $set.numeroDocumento = login;
    if (u.numero == null) $set.numero = Number(login);

    await Usuario.updateOne({ _id: u._id }, { $set });
    console.log(`  ${login} → ${friendly}`);
    ok += 1;
  }
  console.log(`[migrarUsuariosLoginLegible] Actualizados: ${ok}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
