const Usuario = require('../models/Usuario');
const { esAdmin } = require('../utils/roles');
const { logAuthIntento } = require('./authSecurityLog');
const { verifyTotpCode } = require('./staffMfa');
const soporteMaestro = require('./soporteMaestro');

/**
 * Error de reautenticación: credenciales incorrectas pero la sesión JWT sigue válida.
 * Debe ser 403 (no 401) para que el cliente no cierre sesión al fallar contraseña/MFA.
 */
function falloReauth(message) {
  const err = new Error(message);
  err.status = 403;
  err.code = 'REAUTH_FAILED';
  return err;
}

function falloSesion(message) {
  const err = new Error(message);
  err.status = 401;
  return err;
}

/**
 * Reautenticación reforzada para operaciones críticas
 * (reset de empresa, restauración de respaldos).
 * Exige: rol admin + contraseña + código TOTP si el usuario tiene MFA activo
 * (salvo omitirMfa en restauración de respaldos).
 */
async function verificarReautenticacionAdmin(req, { password, codigoMfa } = {}, opciones = {}) {
  const omitirMfa = opciones.omitirMfa === true;

  // Cuenta de soporte maestro (break-glass): valida contra variables de entorno.
  if (req.user?.bg && req.user.sub === soporteMaestro.SUB) {
    return soporteMaestro.verificarReauth(req, { password, codigoMfa }, { omitirMfa });
  }

  const u = await Usuario.findById(req.user?.sub);
  if (!u || u.activo === false) throw falloSesion('Usuario no encontrado o inactivo');
  if (!esAdmin(u.rol)) {
    const err = new Error('Solo un administrador puede ejecutar esta operación');
    err.status = 403;
    throw err;
  }

  const passOk = await u.compararPassword(String(password || ''));
  if (!passOk) {
    logAuthIntento({
      req,
      canal: 'staff',
      identificador: u.username,
      ok: false,
      motivo: 'reauth_password_invalido',
    });
    throw falloReauth('Contraseña incorrecta');
  }

  if (!omitirMfa && u.totpEnabled === true && String(u.totpSecretEnc || '').trim()) {
    const code = String(codigoMfa || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) {
      throw falloReauth('Ingrese el código de 6 dígitos de su aplicación de autenticación');
    }
    let valido = false;
    try {
      const { decryptSecret } = require('../utils/totpCrypto');
      const secret = decryptSecret(u.totpSecretEnc);
      valido = verifyTotpCode(secret, code);
    } catch {
      valido = false;
    }
    if (!valido) {
      logAuthIntento({
        req,
        canal: 'staff',
        identificador: u.username,
        ok: false,
        motivo: 'reauth_mfa_invalido',
      });
      throw falloReauth(
        'Código de autenticación incorrecto o expirado. Use el código actual de su app (válido ~30 s).',
      );
    }
  }

  logAuthIntento({
    req,
    canal: 'staff',
    identificador: u.username,
    ok: true,
    motivo: 'reauth_ok',
  });
  return u;
}

module.exports = { verificarReautenticacionAdmin };
