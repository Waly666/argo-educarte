const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const { generateSecret, generateURI, verifySync } = require('otplib');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const { encryptSecret, decryptSecret } = require('../utils/totpCrypto');
const { mfaStaffRequired, mfaStaffWebOnly, mfaTotpIssuer } = require('../config/security');
const { isClienteNativo } = require('../middleware/turnstile');
const { enriquecerUsuarioDoc } = require('./authUsuario');
const { normalizarRol } = require('../utils/roles');
const { logAuthIntento } = require('./authSecurityLog');

const MFA_TOKEN_TTL = '8m';
const RECOVERY_CODE_COUNT = 10;

function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET no configurado');
  return s;
}

function signAccessToken(u) {
  const rol = normalizarRol(u.rol);
  return jwt.sign(
    { sub: u._id.toString(), username: u.username, rol },
    jwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES || '12h' },
  );
}

function signMfaToken(userId, purpose) {
  return jwt.sign({ sub: String(userId), purpose }, jwtSecret(), { expiresIn: MFA_TOKEN_TTL });
}

function verifyMfaToken(token, purpose) {
  const payload = jwt.verify(String(token || ''), jwtSecret());
  if (payload.purpose !== purpose) {
    const err = new Error('Token MFA inválido');
    err.status = 401;
    throw err;
  }
  return payload;
}

function mfaAppliesToRequest(req) {
  if (!mfaStaffRequired()) return false;
  if (mfaStaffWebOnly() && isClienteNativo(req)) return false;
  return true;
}

function isUserMfaEnrolled(doc) {
  return doc?.totpEnabled === true && !!String(doc.totpSecretEnc || '').trim();
}

function userMfaLabel(doc) {
  return String(doc.username || doc.email || doc._id || '').trim();
}

function generateRecoveryCodes() {
  const plain = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    plain.push(crypto.randomBytes(5).toString('hex').slice(0, 10).toUpperCase());
  }
  return plain;
}

async function hashRecoveryCodes(codes) {
  const hashes = [];
  for (const c of codes) {
    hashes.push(await bcrypt.hash(c, 10));
  }
  return hashes;
}

function verifyTotpCode(secret, code) {
  const c = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return false;
  try {
    // window: 1 → acepta ±30 s por desfase de reloj (login y reauth).
    return verifySync({ secret, token: c, window: 1 }).valid === true;
  } catch {
    return false;
  }
}

async function loadUsuarioById(id) {
  const u = await Usuario.findById(id);
  if (!u || u.activo === false) {
    const err = new Error('Usuario no encontrado');
    err.status = 404;
    throw err;
  }
  return u;
}

/** Tras password OK: decide si JWT directo, setup o verify MFA. */
async function resolvePostPasswordLogin(req, usuarioDoc) {
  if (!mfaAppliesToRequest(req)) {
    return { step: 'complete', usuario: usuarioDoc };
  }

  if (isUserMfaEnrolled(usuarioDoc)) {
    return {
      step: 'mfa_verify',
      mfaToken: signMfaToken(usuarioDoc._id, 'mfa_verify'),
      username: userMfaLabel(usuarioDoc),
    };
  }

  const secret = generateSecret();
  const enc = encryptSecret(secret);
  await Usuario.updateOne(
    { _id: usuarioDoc._id },
    { $set: { totpPendingEnc: enc, totpPendingAt: new Date() } },
  );

  const setupToken = signMfaToken(usuarioDoc._id, 'mfa_setup');
  const qr = await buildSetupQr(usuarioDoc, secret);

  return {
    step: 'mfa_setup',
    setupToken,
    username: userMfaLabel(usuarioDoc),
    ...qr,
  };
}

async function buildSetupQr(doc, secretPlain) {
  const otpauth = generateURI({
    issuer: mfaTotpIssuer(),
    label: userMfaLabel(doc),
    secret: secretPlain,
  });
  const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, width: 220 });
  return {
    qrDataUrl,
    manualSecret: secretPlain,
    issuer: mfaTotpIssuer(),
  };
}

async function getSetupInfo(setupToken) {
  const { sub } = verifyMfaToken(setupToken, 'mfa_setup');
  const u = await loadUsuarioById(sub);
  if (!String(u.totpPendingEnc || '').trim()) {
    const err = new Error('Configuración MFA expirada. Vuelva a iniciar sesión.');
    err.status = 400;
    throw err;
  }
  const secret = decryptSecret(u.totpPendingEnc);
  return {
    username: userMfaLabel(u),
    ...(await buildSetupQr(u, secret)),
  };
}

async function confirmMfaSetup(req, setupToken, code) {
  const { sub } = verifyMfaToken(setupToken, 'mfa_setup');
  const u = await loadUsuarioById(sub);
  if (!String(u.totpPendingEnc || '').trim()) {
    const err = new Error('Configuración MFA expirada. Vuelva a iniciar sesión.');
    err.status = 400;
    throw err;
  }
  const secret = decryptSecret(u.totpPendingEnc);
  if (!verifyTotpCode(secret, code)) {
    logAuthIntento({ req, canal: 'staff', identificador: u.username, ok: false, motivo: 'mfa_setup_invalido' });
    const err = new Error('Código incorrecto. Verifique la hora del celular e intente de nuevo.');
    err.status = 401;
    throw err;
  }

  const recoveryPlain = generateRecoveryCodes();
  const recoveryHashes = await hashRecoveryCodes(recoveryPlain);

  u.totpSecretEnc = encryptSecret(secret);
  u.totpEnabled = true;
  u.totpEnrolledAt = new Date();
  u.totpPendingEnc = null;
  u.totpPendingAt = null;
  u.mfaRecoveryHashes = recoveryHashes;
  await u.save();

  logAuthIntento({ req, canal: 'staff', identificador: u.username, ok: true, motivo: 'mfa_enroll_ok' });

  const token = signAccessToken(u);
  const user = await enriquecerUsuarioDoc(u);
  return { token, user, recoveryCodes: recoveryPlain };
}

async function verifyMfaLogin(req, mfaToken, code) {
  const { sub } = verifyMfaToken(mfaToken, 'mfa_verify');
  const u = await loadUsuarioById(sub);
  if (!isUserMfaEnrolled(u)) {
    const err = new Error('2FA no configurado. Inicie sesión de nuevo.');
    err.status = 400;
    throw err;
  }

  const secret = decryptSecret(u.totpSecretEnc);
  if (!verifyTotpCode(secret, code)) {
    logAuthIntento({ req, canal: 'staff', identificador: u.username, ok: false, motivo: 'mfa_codigo_invalido' });
    const err = new Error('Código de autenticación incorrecto');
    err.status = 401;
    throw err;
  }

  logAuthIntento({ req, canal: 'staff', identificador: u.username, ok: true, motivo: 'mfa_ok' });
  const token = signAccessToken(u);
  const user = await enriquecerUsuarioDoc(u);
  return { token, user };
}

async function verifyMfaRecovery(req, mfaToken, recoveryCode) {
  const { sub } = verifyMfaToken(mfaToken, 'mfa_verify');
  const u = await loadUsuarioById(sub);
  const hashes = Array.isArray(u.mfaRecoveryHashes) ? u.mfaRecoveryHashes : [];
  if (!hashes.length) {
    const err = new Error('No hay códigos de recuperación disponibles');
    err.status = 400;
    throw err;
  }

  const plain = String(recoveryCode || '').trim().toUpperCase();
  let matchIdx = -1;
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(plain, hashes[i])) {
      matchIdx = i;
      break;
    }
  }
  if (matchIdx < 0) {
    logAuthIntento({ req, canal: 'staff', identificador: u.username, ok: false, motivo: 'mfa_recovery_invalido' });
    const err = new Error('Código de recuperación inválido');
    err.status = 401;
    throw err;
  }

  hashes.splice(matchIdx, 1);
  u.mfaRecoveryHashes = hashes;
  await u.save();

  logAuthIntento({ req, canal: 'staff', identificador: u.username, ok: true, motivo: 'mfa_recovery_ok' });
  const token = signAccessToken(u);
  const user = await enriquecerUsuarioDoc(u);
  return { token, user, recoveryRemaining: hashes.length };
}

module.exports = {
  mfaAppliesToRequest,
  isUserMfaEnrolled,
  resolvePostPasswordLogin,
  getSetupInfo,
  confirmMfaSetup,
  verifyMfaLogin,
  verifyMfaRecovery,
  signAccessToken,
  verifyTotpCode,
};
