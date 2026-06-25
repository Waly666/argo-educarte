const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function encryptionKey() {
  const raw = String(process.env.TOTP_ENCRYPTION_KEY || process.env.JWT_SECRET || '').trim();
  if (!raw) throw new Error('TOTP_ENCRYPTION_KEY o JWT_SECRET requerido para MFA');
  return crypto.createHash('sha256').update(raw).digest();
}

function encryptSecret(plain) {
  const key = encryptionKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

function decryptSecret(payload) {
  const key = encryptionKey();
  const [ivB64, tagB64, dataB64] = String(payload || '').split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Secreto TOTP inválido');
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return dec.toString('utf8');
}

module.exports = { encryptSecret, decryptSecret };
