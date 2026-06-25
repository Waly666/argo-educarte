/**
 * Aplica textos Educarte (objeto social) al portal guardado en MongoDB.
 * Conserva: nombre, contacto, logo, site (colores, secciones, imagen hero).
 *
 * Uso:
 *   cd argo-backend
 *   node scripts/aplicarTextosEducartePortal.js
 */
require('dotenv').config();
const { connectDB } = require('../src/config/db');
const Config = require('../src/models/Config');
const { LANDING_DEFAULTS } = require('../src/constants/aulaVirtualLandingDefaults');
const { normalizarLanding } = require('../src/services/aulaVirtualPortalLanding');
const { DEFAULTS_AULA } = require('../src/services/aulaVirtualPortal');

const CLAVE = 'aula_virtual';

(async () => {
  try {
    await connectDB();
    const doc = await Config.findOne({ clave: CLAVE }).lean();
    if (!doc) {
      console.error('[aplicarTextosEducarte] No existe config aula_virtual en MongoDB.');
      process.exit(1);
    }

    const update = {
      heroTitulo: DEFAULTS_AULA.heroTitulo,
      heroSubtitulo: DEFAULTS_AULA.heroSubtitulo,
      acercaDeHtml: DEFAULTS_AULA.acercaDeHtml,
      landing: normalizarLanding(LANDING_DEFAULTS),
      userChangeRecord: 'script:aplicarTextosEducartePortal',
    };

    await Config.updateOne({ clave: CLAVE }, { $set: update });
    console.log('[aplicarTextosEducarte] Textos Educarte aplicados en MongoDB.');
    console.log('  - heroTitulo / heroSubtitulo / acercaDeHtml actualizados');
    console.log('  - landing completo reemplazado (fundación, FAQ, servicios, etc.)');
    console.log('  - Conservados: nombreEmpresa, contacto, urlLogo, site (colores e imagen)');
    console.log(`  - Institución: ${doc.nombreEmpresa || '(sin nombre)'}`);
    process.exit(0);
  } catch (e) {
    console.error('[aplicarTextosEducarte] Error:', e);
    process.exit(1);
  }
})();
