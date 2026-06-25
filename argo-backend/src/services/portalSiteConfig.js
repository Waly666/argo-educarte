const {
  SITE_DEFAULTS,
  HOME_SECCIONES_ORDEN,
  paginasDefault,
} = require('../constants/portalSiteDefaults');
const { publicUploadUrl } = require('../utils/uploadPublicUrl');

function str(v, fallback = '') {
  return String(v ?? fallback).trim();
}

function hexColor(v, fallback) {
  const s = str(v, fallback);
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : fallback;
}

function normalizarPaginas(raw, navFallback = {}) {
  const base = paginasDefault(navFallback);
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const key of Object.keys(base)) {
    const fb = base[key];
    const item = src[key] && typeof src[key] === 'object' ? src[key] : {};
    out[key] = {
      activa: item.activa !== false,
      etiquetaMenu: str(item.etiquetaMenu, fb.etiquetaMenu) || fb.etiquetaMenu,
      ruta: fb.ruta,
    };
  }
  return out;
}

function normalizarTema(raw) {
  const d = SITE_DEFAULTS.tema;
  const src = raw && typeof raw === 'object' ? raw : {};
  const urlHero = str(src.urlHero);
  return {
    colorPrimario: hexColor(src.colorPrimario, d.colorPrimario),
    colorPrimarioOscuro: hexColor(src.colorPrimarioOscuro, d.colorPrimarioOscuro),
    colorAcento: hexColor(src.colorAcento, d.colorAcento),
    colorFondo: hexColor(src.colorFondo, d.colorFondo),
    colorSuperficie: hexColor(src.colorSuperficie, d.colorSuperficie),
    colorTexto: hexColor(src.colorTexto, d.colorTexto),
    colorTextoSecundario: hexColor(src.colorTextoSecundario, d.colorTextoSecundario),
    fuente: str(src.fuente, d.fuente) || d.fuente,
    urlHero: urlHero,
    urlHeroAbsoluta: urlHero ? publicUploadUrl(urlHero) || urlHero : '',
  };
}

function normalizarMarca(raw, landingFooter = {}) {
  const d = SITE_DEFAULTS.marca;
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    textoCopyright: str(src.textoCopyright, landingFooter.copyright || ''),
    ocultarMarcaDesarrollador: src.ocultarMarcaDesarrollador !== false,
    textoPieDesarrollador: str(src.textoPieDesarrollador),
  };
}

function normalizarHome(raw) {
  const d = SITE_DEFAULTS.home;
  const src = raw && typeof raw === 'object' ? raw : {};
  const seccionesSrc = src.secciones && typeof src.secciones === 'object' ? src.secciones : {};
  const secciones = {};
  for (const key of HOME_SECCIONES_ORDEN) {
    secciones[key] = seccionesSrc[key] !== false;
  }
  const ordenRaw = Array.isArray(src.orden) ? src.orden : [];
  const ordenSet = new Set(HOME_SECCIONES_ORDEN);
  const orden = [];
  for (const id of ordenRaw) {
    const k = str(id);
    if (ordenSet.has(k) && !orden.includes(k)) orden.push(k);
  }
  for (const k of HOME_SECCIONES_ORDEN) {
    if (!orden.includes(k)) orden.push(k);
  }
  // Migración: intercambiar valores ↔ carreras si persiste el orden anterior en BD
  const iv = orden.indexOf('valores');
  const ic = orden.indexOf('carreras');
  if (iv !== -1 && ic !== -1 && iv < ic) {
    orden[iv] = 'carreras';
    orden[ic] = 'valores';
  }
  // Migración: testimonios justo antes de FAQ
  const it = orden.indexOf('testimonios');
  const ifaq = orden.indexOf('faq');
  const ipasos = orden.indexOf('pasos');
  if (it !== -1 && ifaq !== -1 && it !== ifaq - 1 && !(ipasos !== -1 && it > ipasos && it < ifaq)) {
    const sinTestimonios = orden.filter((id) => id !== 'testimonios');
    const idxFaq = sinTestimonios.indexOf('faq');
    if (idxFaq !== -1) {
      sinTestimonios.splice(idxFaq, 0, 'testimonios');
      orden.length = 0;
      orden.push(...sinTestimonios);
    }
  }
  return { orden, secciones };
}

function normalizarPortalSite(raw, { nav, footer } = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    paginas: normalizarPaginas(src.paginas, nav),
    tema: normalizarTema(src.tema),
    marca: normalizarMarca(src.marca, footer),
    home: normalizarHome(src.home),
  };
}

function mergePortalSite(raw, opts = {}) {
  return normalizarPortalSite(raw, opts);
}

/** Sincroniza etiquetas del menú legacy (landing.nav) con páginas del constructor. */
function sincronizarNavLanding(landing, site) {
  if (!landing?.nav || !site?.paginas) return landing;
  const nav = { ...landing.nav };
  const map = {
    home: 'home',
    tienda: 'tienda',
    cursos: 'cursos',
    aula: 'aula',
    fundacion: 'fundacion',
    consultaCertificados: 'consultaCertificados',
    acerca: 'acerca',
  };
  for (const [navKey, pageKey] of Object.entries(map)) {
    const p = site.paginas[pageKey];
    if (p?.etiquetaMenu) nav[navKey] = p.etiquetaMenu;
  }
  return { ...landing, nav };
}

function copyrightPublico(site, landing, nombreCea) {
  const custom = str(site?.marca?.textoCopyright);
  if (custom) return custom;
  const fb = str(landing?.footer?.copyright);
  if (site?.marca?.ocultarMarcaDesarrollador && fb) {
    return fb.replace(/\s*designed by.*$/i, '').replace(/\s*desarrollado por.*$/i, '').trim();
  }
  if (fb) return fb;
  const year = new Date().getFullYear();
  return `© ${year} ${nombreCea || 'Centro de formación'}. Todos los derechos reservados.`;
}

module.exports = {
  normalizarPortalSite,
  mergePortalSite,
  sincronizarNavLanding,
  copyrightPublico,
  HOME_SECCIONES_ORDEN,
};
