/**
 * Aplica la plantilla Educarte al portal en MongoDB (tema, landing, textos hero).
 * Conserva datos de negocio: nombre, NIT, contacto, logo, correos.
 *
 * Uso:
 *   cd argo-backend && node scripts/aplicarPlantillaEducartePortal.js
 *
 * En VPS:
 *   docker compose -f docker-compose.educarte.yml exec -T argo-backend \
 *     node scripts/aplicarPlantillaEducartePortal.js
 */
require('dotenv').config();
const { connectDB } = require('../src/config/db');
const { aplicarPlantillaEducarteStartup } = require('../src/services/aplicarPlantillaEducarteStartup');

(async () => {
  try {
    await connectDB();
    await aplicarPlantillaEducarteStartup();
    console.log('[aplicarPlantillaEducarte] OK.');
    process.exit(0);
  } catch (e) {
    console.error('[aplicarPlantillaEducarte] Error:', e);
    process.exit(1);
  }
})();
