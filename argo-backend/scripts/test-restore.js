/**
 * Prueba de restauración (CLI). Uso:
 *   node scripts/test-restore.js [nombre.zip]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const { connectDB } = require('../src/config/db');
const respaldos = require('../src/services/respaldos');

const archivo = process.argv[2] || 'argo-respaldo-20260612-201355-pre-reset.zip';
const ruta = path.join(__dirname, '..', 'backups', archivo);

(async () => {
  console.log('[test-restore] Conectando…');
  await connectDB();
  console.log('[test-restore] Restaurando', ruta);
  const t0 = Date.now();
  try {
    const r = await respaldos.restaurarRespaldo(ruta, {
      usuario: 'test-cli',
      crearSeguridad: false,
    });
    console.log('[test-restore] OK en', Math.round((Date.now() - t0) / 1000), 's');
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('[test-restore] FALLO en', Math.round((Date.now() - t0) / 1000), 's');
    console.error(e.message);
    if (e.stack) console.error(e.stack);
    process.exit(1);
  }
})();
