/**
 * Sincroniza urlLogo del portal (aula_virtual) hacia Config → Recibos.
 * Útil cuando recibos conservan un logo antiguo distinto al del portal.
 *
 * Uso:
 *   cd argo-backend
 *   node scripts/syncLogoPortalRecibo.js
 */
require('dotenv').config();
const { connectDB } = require('../src/config/db');
const Config = require('../src/models/Config');

(async () => {
  try {
    await connectDB();
    const aula = await Config.findOne({ clave: 'aula_virtual' }).lean();
    const logo = String(aula?.urlLogo || '').trim();
    if (!logo) {
      console.error('[syncLogoPortalRecibo] El portal no tiene urlLogo configurado.');
      process.exit(1);
    }
    const antes = await Config.findOne({ clave: 'recibo' }).lean();
    await Config.updateOne(
      { clave: 'recibo' },
      { $set: { urlLogo: logo, userChangeRecord: 'script:syncLogoPortalRecibo' } },
      { upsert: true },
    );
    console.log('[syncLogoPortalRecibo] Logo sincronizado en Config → Recibos.');
    console.log('  - Antes:', antes?.urlLogo || '(vacío)');
    console.log('  - Ahora:', logo);
    process.exit(0);
  } catch (e) {
    console.error('[syncLogoPortalRecibo] Error:', e);
    process.exit(1);
  }
})();
