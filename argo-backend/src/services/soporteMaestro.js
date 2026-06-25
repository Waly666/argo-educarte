/**
 * Cuenta de soporte maestro ("break-glass").
 *
 * Acceso de administrador que NO vive en la colección `usuarios`: sus credenciales
 * residen en variables de entorno del servidor, distintas por instalación. Pensada
 * para soporte del proveedor: sobrevive a una puesta en cero o restauración, no es
 * visible ni editable desde la app, y exige SIEMPRE 2FA (TOTP).
 *
 * Cumple ISO/IEC 27001 (5.15 control de acceso, 8.15 registro de eventos):
 * cada ingreso y cada acción quedan registrados en auditoría como `soporte-argo`.
 *
 * Variables de entorno:
 *   SOPORTE_MASTER_ENABLED=true|false   (default false: deshabilitada)
 *   SOPORTE_MASTER_USER=soporte-argo    (nombre de usuario para el login)
 *   SOPORTE_MASTER_PASSWORD_HASH=...    (hash bcrypt; recomendado)
 *   SOPORTE_MASTER_PASSWORD=...         (texto plano; solo si no hay hash)
 *   SOPORTE_MASTER_TOTP_SECRET=...      (secreto base32 del Authenticator)
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { verifySync } = require('otplib');
const { datosRol, nombreRol } = require('./rolesPermisos');
const { listarSedesActivas, asegurarSedePrincipal } = require('./sedeContext');
const { logAuthIntento } = require('./authSecurityLog');
const { registrarAuditoria } = require('./auditoria');

/** Identificador sintético en el JWT (no es un ObjectId de Mongo). */
const SUB = 'soporte-maestro';
const ACCESS_TTL = process.env.JWT_EXPIRES || '12h';
const MFA_TTL = '8m';

function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET no configurado');
  return s;
}

function flag(v, def = false) {
  if (v == null || v === '') return def;
  return v === '1' || v === 'true' || v === 'yes';
}

function credencialUser() {
  return String(process.env.SOPORTE_MASTER_USER || '').trim().toLowerCase();
}
function nombreUser() {
  return String(process.env.SOPORTE_MASTER_USER || 'soporte-argo').trim() || 'soporte-argo';
}
function passwordHash() {
  return String(process.env.SOPORTE_MASTER_PASSWORD_HASH || '').trim();
}
function passwordPlain() {
  return String(process.env.SOPORTE_MASTER_PASSWORD || '');
}
function secretoTotp() {
  return String(process.env.SOPORTE_MASTER_TOTP_SECRET || '').replace(/\s/g, '');
}

/** La cuenta solo está operativa si está habilitada y completamente configurada. */
function habilitado() {
  if (!flag(process.env.SOPORTE_MASTER_ENABLED, false)) return false;
  if (!credencialUser()) return false;
  if (!secretoTotp()) return false;
  return !!passwordHash() || !!passwordPlain();
}

function esLoginSoporte(username) {
  if (!habilitado()) return false;
  return String(username || '').trim().toLowerCase() === credencialUser();
}

function comparaTextoConstante(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

async function validarPassword(password) {
  const hash = passwordHash();
  if (hash) {
    try {
      return await bcrypt.compare(String(password || ''), hash);
    } catch {
      return false;
    }
  }
  const plain = passwordPlain();
  return plain.length > 0 && comparaTextoConstante(password || '', plain);
}

function validarTotp(code) {
  const c = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return false;
  try {
    return verifySync({ secret: secretoTotp(), token: c, window: 1 }).valid === true;
  } catch {
    return false;
  }
}

function signMfaToken() {
  return jwt.sign({ sub: SUB, purpose: 'mfa_verify', bg: true }, jwtSecret(), { expiresIn: MFA_TTL });
}

function signAccessToken() {
  return jwt.sign(
    { sub: SUB, username: nombreUser(), rol: 'admin', bg: true },
    jwtSecret(),
    { expiresIn: ACCESS_TTL },
  );
}

/** ¿El mfaToken corresponde a un login de soporte (break-glass)? */
function esMfaTokenSoporte(mfaToken) {
  try {
    const p = jwt.verify(String(mfaToken || ''), jwtSecret());
    return p.bg === true && p.sub === SUB && p.purpose === 'mfa_verify';
  } catch {
    return false;
  }
}

/** Construye el req.user sintético que usan los middlewares para esta sesión. */
function reqUser() {
  return { sub: SUB, username: nombreUser(), rol: 'admin', bg: true, soporteMaestro: true };
}

/** Paso 1 del login: valida contraseña y exige 2FA (no entrega token todavía). */
async function iniciarLogin(req, password) {
  if (!habilitado()) {
    const err = new Error('Credenciales inválidas');
    err.status = 401;
    throw err;
  }
  const ok = await validarPassword(password);
  if (!ok) {
    logAuthIntento({ req, canal: 'soporte', identificador: nombreUser(), ok: false, motivo: 'password_invalida' });
    const err = new Error('Credenciales inválidas');
    err.status = 401;
    throw err;
  }
  logAuthIntento({ req, canal: 'soporte', identificador: nombreUser(), ok: true, motivo: 'password_ok' });
  return { step: 'mfa_verify', mfaToken: signMfaToken(), username: nombreUser() };
}

/** Paso 2 del login: valida el código TOTP y entrega el token de acceso. */
async function verificarMfa(req, code) {
  if (!habilitado()) {
    const err = new Error('Acceso de soporte deshabilitado');
    err.status = 401;
    throw err;
  }
  if (!validarTotp(code)) {
    logAuthIntento({ req, canal: 'soporte', identificador: nombreUser(), ok: false, motivo: 'mfa_codigo_invalido' });
    const err = new Error('Código de autenticación incorrecto');
    err.status = 401;
    throw err;
  }
  logAuthIntento({ req, canal: 'soporte', identificador: nombreUser(), ok: true, motivo: 'mfa_ok' });
  registrarAuditoria({
    req: { ...req, user: reqUser() },
    accion: 'login_soporte_maestro',
    entidad: 'auth',
    resumen: 'Ingreso con cuenta de soporte maestro (break-glass)',
    metodo: 'POST',
    ruta: req?.originalUrl || req?.url || '/api/auth/mfa/verify',
  }).catch(() => {});
  const token = signAccessToken();
  const user = await usuarioJson();
  return { token, user };
}

/** Reautenticación para operaciones críticas (reset/restauración) con la cuenta de soporte. */
async function verificarReauth(req, { password, codigoMfa } = {}, opciones = {}) {
  const omitirMfa = opciones.omitirMfa === true;
  if (!habilitado()) {
    const err = new Error('Acceso de soporte deshabilitado');
    err.status = 401;
    throw err;
  }
  const passOk = await validarPassword(password);
  if (!passOk) {
    logAuthIntento({ req, canal: 'soporte', identificador: nombreUser(), ok: false, motivo: 'reauth_password_invalido' });
    const err = new Error('Contraseña incorrecta');
    err.status = 403;
    err.code = 'REAUTH_FAILED';
    throw err;
  }
  if (!omitirMfa && !validarTotp(codigoMfa)) {
    logAuthIntento({ req, canal: 'soporte', identificador: nombreUser(), ok: false, motivo: 'reauth_mfa_invalido' });
    const err = new Error('Código de autenticación incorrecto o expirado');
    err.status = 403;
    err.code = 'REAUTH_FAILED';
    throw err;
  }
  logAuthIntento({ req, canal: 'soporte', identificador: nombreUser(), ok: true, motivo: 'reauth_ok' });
  return { username: nombreUser(), soporteMaestro: true };
}

/** Perfil que devuelve /me: rol admin, permisos totales y todas las sedes. */
async function usuarioJson() {
  const datos = await datosRol('admin');
  await asegurarSedePrincipal();
  const sedes = await listarSedesActivas();
  return {
    _id: SUB,
    id: SUB,
    username: nombreUser(),
    nombres: 'Soporte',
    apellidos: 'ARGO',
    nombreCompleto: 'Soporte ARGO',
    email: '',
    rol: 'admin',
    rolNombre: (await nombreRol('admin')) || 'Administrador',
    activo: true,
    soporteMaestro: true,
    permisos: datos.permisos,
    alarmas: datos.alarmas,
    permisosRev: datos.permisosRev || null,
    sedes: sedes.map((s) => ({
      idSede: s.idSede,
      nombre: s.nombre,
      codigo: s.codigo || '',
      esPrincipal: !!s.esPrincipal,
    })),
    sedesPermitidas: sedes.map((s) => s.idSede),
    puedeUsarPortalInstructor: false,
  };
}

module.exports = {
  SUB,
  habilitado,
  esLoginSoporte,
  esMfaTokenSoporte,
  reqUser,
  iniciarLogin,
  verificarMfa,
  verificarReauth,
  usuarioJson,
};
