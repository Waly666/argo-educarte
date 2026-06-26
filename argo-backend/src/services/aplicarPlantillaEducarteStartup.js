/**
 * Aplica plantilla Educarte en MongoDB al arrancar el backend (stack Educarte).
 * Idempotente: actualiza tema verde MISIÓN + landing; conserva logo y contacto.
 */
const Config = require('../models/Config');
const { LANDING_DEFAULTS } = require('../constants/aulaVirtualLandingDefaults');
const { PORTAL_TEMA_EDUCARTE } = require('../constants/portalTemaEducarte');
const { normalizarLanding } = require('./aulaVirtualPortalLanding');
const { mergePortalSite } = require('./portalSiteConfig');
const { DEFAULTS_AULA } = require('./aulaVirtualPortal');

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

async function aplicarPlantillaEducarteStartup() {
  if (process.env.EDUCARTE_SKIP_PORTAL_MIGRATION === '1') return;

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
    userChangeRecord: 'startup:aplicarPlantillaEducarte',
  };

  for (const key of PRESERVE_KEYS) {
    if (doc[key] !== undefined && doc[key] !== null && String(doc[key]).trim() !== '') {
      update[key] = doc[key];
    }
  }

  await Config.updateOne({ clave: CLAVE }, { $set: { clave: CLAVE, ...update } }, { upsert: true });
  console.log('[ARGO] Plantilla Educarte aplicada en MongoDB (tema verde + landing).');
}

module.exports = { aplicarPlantillaEducarteStartup };
