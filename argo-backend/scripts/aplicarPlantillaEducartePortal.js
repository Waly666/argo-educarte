/**
 * Aplica la plantilla Educarte al portal en MongoDB (tema, landing, textos hero).
 * Conserva datos de negocio: nombre, NIT, contacto, logo, correos.
 *
 * Uso local:
 *   cd argo-backend && node scripts/aplicarPlantillaEducartePortal.js
 *
 * En VPS (contenedor backend):
 *   docker compose -f docker-compose.educarte.yml exec -T argo-backend \
 *     node scripts/aplicarPlantillaEducartePortal.js
 */
require('dotenv').config();
const { connectDB } = require('../src/config/db');
const Config = require('../src/models/Config');
const { LANDING_DEFAULTS } = require('../src/constants/aulaVirtualLandingDefaults');
const { PORTAL_TEMA_EDUCARTE } = require('../src/constants/portalTemaEducarte');
const { normalizarLanding } = require('../src/services/aulaVirtualPortalLanding');
const { mergePortalSite } = require('../src/services/portalSiteConfig');
const { DEFAULTS_AULA } = require('../src/services/aulaVirtualPortal');

const CLAVE = 'aula_virtual';

const PRESERVE_KEYS = [
  'nombreEmpresa',
  'nit',
  'direccion',
  'ciudad',
  'telefono',
  'email',
  'emailContacto',
  'emailConfirmacion',
  'emailPqr',
  'telefonoWhatsapp',
  'urlLogo',
];

(async () => {
  try {
    await connectDB();
    const doc = (await Config.findOne({ clave: CLAVE }).lean()) || {};

    const landing = normalizarLanding(LANDING_DEFAULTS);
    const site = mergePortalSite(
      {
        tema: { ...PORTAL_TEMA_EDUCARTE },
        home: {
          orden: [
            'instBar',
            'hero',
            'infoCards',
            'ofertas',
            'beneficios',
            'quoteBand',
            'serviciosEmpresa',
            'carreras',
            'cursosVirtuales',
            'valores',
            'pasos',
            'appMobile',
            'testimonios',
            'faq',
            'pilares',
          ],
          secciones: Object.fromEntries(
            [
              'instBar',
              'hero',
              'infoCards',
              'ofertas',
              'beneficios',
              'quoteBand',
              'serviciosEmpresa',
              'carreras',
              'cursosVirtuales',
              'valores',
              'pasos',
              'appMobile',
              'testimonios',
              'faq',
              'pilares',
            ].map((k) => [k, true]),
          ),
        },
        paginas: {
          tienda: { activa: false },
          blog: { activa: false },
        },
      },
      { nav: landing.nav, footer: landing.footer },
    );

    const update = {
      heroTitulo: DEFAULTS_AULA.heroTitulo,
      heroSubtitulo: DEFAULTS_AULA.heroSubtitulo,
      acercaDeHtml: DEFAULTS_AULA.acercaDeHtml,
      landing,
      site,
      userChangeRecord: 'script:aplicarPlantillaEducartePortal',
    };

    for (const key of PRESERVE_KEYS) {
      if (doc[key] !== undefined && doc[key] !== null && String(doc[key]).trim() !== '') {
        update[key] = doc[key];
      }
    }

    await Config.updateOne({ clave: CLAVE }, { $set: { clave: CLAVE, ...update } }, { upsert: true });

    console.log('[aplicarPlantillaEducarte] Plantilla Educarte aplicada en MongoDB.');
    console.log('  - site.tema: verde institucional + Montserrat');
    console.log('  - landing + hero + acercaDeHtml actualizados');
    console.log('  - Conservados: nombre, contacto, logo (si existían)');
    console.log(`  - Institución: ${update.nombreEmpresa || doc.nombreEmpresa || '(sin nombre)'}`);
    process.exit(0);
  } catch (e) {
    console.error('[aplicarPlantillaEducarte] Error:', e);
    process.exit(1);
  }
})();
