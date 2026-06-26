/**
 * Aplica plantilla Educarte en MongoDB al arrancar el backend (stack Educarte).
 * Idempotente: fuerza tema verde MISIÓN; conserva landing, imágenes y contacto del usuario.
 */
const Config = require('../models/Config');
const { LANDING_DEFAULTS } = require('../constants/aulaVirtualLandingDefaults');
const { PORTAL_TEMA_EDUCARTE } = require('../constants/portalTemaEducarte');
const { normalizarLanding, mergeLanding } = require('./aulaVirtualPortalLanding');
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
  'heroTitulo',
  'heroSubtitulo',
  'acercaDeHtml',
];

const EDUCARTE_HOME_ORDEN = [
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
];

const EDUCARTE_HOME_SECCIONES = Object.fromEntries(
  EDUCARTE_HOME_ORDEN.map((k) => [k, true]),
);

async function aplicarPlantillaEducarteStartup() {
  if (process.env.EDUCARTE_SKIP_PORTAL_MIGRATION === '1') return;

  const doc = (await Config.findOne({ clave: CLAVE }).lean()) || {};
  const educarteLanding = normalizarLanding(LANDING_DEFAULTS);
  const landing = doc.landing ? mergeLanding(doc.landing) : educarteLanding;

  const prevSite = doc.site && typeof doc.site === 'object' ? doc.site : {};
  const prevHome = prevSite.home && typeof prevSite.home === 'object' ? prevSite.home : {};
  const prevPaginas = prevSite.paginas && typeof prevSite.paginas === 'object' ? prevSite.paginas : {};

  const site = mergePortalSite(
    {
      tema: {
        ...PORTAL_TEMA_EDUCARTE,
        urlHero: String(prevSite.tema?.urlHero || '').trim(),
      },
      home: {
        orden: prevHome.orden?.length ? prevHome.orden : EDUCARTE_HOME_ORDEN,
        secciones:
          prevHome.secciones && Object.keys(prevHome.secciones).length
            ? prevHome.secciones
            : EDUCARTE_HOME_SECCIONES,
      },
      paginas: {
        tienda: { activa: prevPaginas.tienda?.activa ?? false },
        blog: { activa: prevPaginas.blog?.activa ?? false },
      },
    },
    { nav: landing.nav, footer: landing.footer },
  );

  const update = {
    heroTitulo: String(doc.heroTitulo || '').trim() || DEFAULTS_AULA.heroTitulo,
    heroSubtitulo: String(doc.heroSubtitulo || '').trim() || DEFAULTS_AULA.heroSubtitulo,
    acercaDeHtml: String(doc.acercaDeHtml || '').trim() || DEFAULTS_AULA.acercaDeHtml,
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
  console.log('[ARGO] Plantilla Educarte aplicada en MongoDB (tema verde; landing e imágenes conservadas).');
}

module.exports = { aplicarPlantillaEducarteStartup };
