const Usuario = require('../models/Usuario');
const { esAdmin } = require('../utils/roles');
const { findUsuarioPorLogin } = require('../utils/usuarioLogin');

async function verificarAdminCredenciales(username, password) {
  if (!username || !password) {
    return {
      ok: false,
      status: 400,
      message: 'Usuario y contraseña del administrador son requeridos',
      code: 'AUTH_REQUIRED',
    };
  }
  const u = await findUsuarioPorLogin(username);
  if (!u) {
    return { ok: false, status: 401, message: 'Credenciales de administrador inválidas', code: 'AUTH_INVALID' };
  }
  if (!esAdmin(u.rol)) {
    return {
      ok: false,
      status: 403,
      message: 'Solo un usuario con rol administrador puede autorizar esta operación',
      code: 'AUTH_INVALID',
    };
  }
  const passOk = await u.compararPassword(password);
  if (!passOk) {
    return { ok: false, status: 401, message: 'Credenciales de administrador inválidas', code: 'AUTH_INVALID' };
  }
  const nombreAutoriza =
    [u.nombres, u.apellidos].filter(Boolean).join(' ').trim() || u.username;
  return {
    ok: true,
    idUsuario: String(u._id),
    username: u.username,
    nombreAutoriza,
  };
}

/** Admin directo, o cajero con credenciales de un administrador (sin cambiar sesión). */
async function exigirAdminOSupervisor(req, mensaje) {
  if (esAdmin(req.user?.rol)) {
    let nombreAutoriza = req.user?.username || 'admin';
    try {
      const u = await Usuario.findById(req.user.sub).lean();
      if (u) {
        nombreAutoriza =
          [u.nombres, u.apellidos].filter(Boolean).join(' ').trim() || u.username;
      }
    } catch {
      /* ignore */
    }
    return {
      ok: true,
      supervisor: {
        autorizadoPor: req.user.username,
        idUsuarioAutoriza: req.user.sub,
        nombreAutoriza,
        autorizadoEn: new Date(),
      },
    };
  }
  const { autorizadoUsername, autorizadoPassword } = req.body || {};
  const ver = await verificarAdminCredenciales(autorizadoUsername, autorizadoPassword);
  if (!ver.ok) {
    return {
      ok: false,
      status: ver.status,
      message: ver.message || mensaje || 'Se requiere autorización de un administrador (usuario y contraseña).',
      code: ver.code || (ver.status === 400 ? 'AUTH_REQUIRED' : 'AUTH_INVALID'),
    };
  }
  return {
    ok: true,
    supervisor: {
      autorizadoPor: ver.username,
      idUsuarioAutoriza: ver.idUsuario,
      nombreAutoriza: ver.nombreAutoriza,
      autorizadoEn: new Date(),
    },
  };
}

module.exports = { verificarAdminCredenciales, exigirAdminOSupervisor };
