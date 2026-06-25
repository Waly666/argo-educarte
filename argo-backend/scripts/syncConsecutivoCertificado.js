/**
 * Sincroniza consecutivoCertificado con el máximo codigoCert existente.
 * Uso: node scripts/syncConsecutivoCertificado.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Config = require('../src/models/Config');
const Certificado = require('../src/models/Certificado');
const { CLAVE, DEFAULTS } = require('../src/services/configCertificado');

function numDesdeCodigo(codigo) {
  const m = String(codigo || '').match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 0;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const certs = await Certificado.find({ codigoCert: { $exists: true, $ne: '' } })
    .select('codigoCert')
    .lean();
  const maxCodigo = certs.reduce((m, c) => Math.max(m, numDesdeCodigo(c.codigoCert)), 0);
  const total = certs.length;

  let cfg = await Config.findOne({ clave: CLAVE });
  if (!cfg) {
    cfg = await Config.create({ ...DEFAULTS, clave: CLAVE, consecutivoCertificado: maxCodigo });
  } else {
    cfg.consecutivoCertificado = Math.max(cfg.consecutivoCertificado || 0, maxCodigo, total);
    await cfg.save();
  }

  console.log(`Certificados en BD: ${total}`);
  console.log(`Máximo en codigoCert: ${maxCodigo}`);
  console.log(`consecutivoCertificado ajustado a: ${cfg.consecutivoCertificado}`);
  console.log(`Próximo código será: ${(cfg.prefijoCertificado || 'CERT').trim()}-${String(cfg.consecutivoCertificado + 1).padStart(6, '0')}`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
