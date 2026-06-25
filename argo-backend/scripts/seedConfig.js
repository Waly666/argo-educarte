require('dotenv').config();
const { connectDB } = require('../src/config/db');
const Config = require('../src/models/Config');
const { DEFAULTS, CLAVE } = require('../src/services/configRecibo');

(async () => {
  try {
    await connectDB();
    await Config.findOneAndUpdate({ clave: CLAVE }, { $set: { ...DEFAULTS } }, { upsert: true });
    console.log('[seedConfig] Configuración de recibos OK');
    process.exit(0);
  } catch (e) {
    console.error('[seedConfig] Error:', e);
    process.exit(1);
  }
})();
