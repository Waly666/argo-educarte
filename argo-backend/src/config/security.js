/** Configuración de seguridad (Fase 1 producción). */

const { smtpConfigured } = require('../services/mail');

function envFlag(name, defaultTrue = true) {
  const v = process.env[name];
  if (v == null || v === '') return defaultTrue;
  return v === '1' || v === 'true' || v === 'yes';
}

function envInt(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function turnstileEnabled() {
  const secret = String(process.env.TURNSTILE_SECRET_KEY || '').trim();
  if (!secret) return false;
  return envFlag('TURNSTILE_ENABLED', true);
}

function turnstileSiteKey() {
  return String(process.env.TURNSTILE_SITE_KEY || '').trim();
}

function portalRegistroAbierto() {
  return envFlag('PORTAL_REGISTRO_ABIERTO', true);
}

/** Verificación de correo al registrarse en aula virtual (solo portal). */
function portalEmailVerifyEnabled() {
  const v = process.env.PORTAL_EMAIL_VERIFY;
  if (v === '0' || v === 'false' || v === 'no') return false;
  if (!smtpConfigured()) return false;
  if (v === '1' || v === 'true' || v === 'yes') return true;
  return true;
}

function trustProxyHops() {
  return envInt('TRUST_PROXY', 1);
}

/** 2FA TOTP obligatorio para ERP web (app.finstruvial.edu.co). */
function mfaStaffRequired() {
  return envFlag('MFA_STAFF_REQUIRED', true);
}

/** Solo exige MFA en navegador; app móvil (X-ARGO-Cliente) queda exenta. */
function mfaStaffWebOnly() {
  return envFlag('MFA_STAFF_WEB_ONLY', true);
}

function mfaTotpIssuer() {
  return String(process.env.MFA_TOTP_ISSUER || 'ARGO Finstruvial').trim() || 'ARGO Finstruvial';
}

module.exports = {
  envFlag,
  envInt,
  turnstileEnabled,
  turnstileSiteKey,
  portalRegistroAbierto,
  portalEmailVerifyEnabled,
  trustProxyHops,
  mfaStaffRequired,
  mfaStaffWebOnly,
  mfaTotpIssuer,
  loginRateLimit: {
    windowMs: envInt('RATE_LIMIT_LOGIN_WINDOW_MS', 15 * 60 * 1000),
    max: envInt('RATE_LIMIT_LOGIN_MAX', 10),
  },
  buscarAlumnoRateLimit: {
    windowMs: envInt('RATE_LIMIT_BUSCAR_ALUMNO_WINDOW_MS', 15 * 60 * 1000),
    max: envInt('RATE_LIMIT_BUSCAR_ALUMNO_MAX', 15),
  },
  authApiRateLimit: {
    windowMs: envInt('RATE_LIMIT_AUTH_WINDOW_MS', 15 * 60 * 1000),
    max: envInt('RATE_LIMIT_AUTH_MAX', 30),
  },
};
