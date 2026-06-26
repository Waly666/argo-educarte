/** Configuración visual y estructural del portal (constructor de sitio). */

const HOME_SECCIONES_ORDEN = [
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

const HOME_SECCIONES_LABELS = {
  instBar: 'Barra institucional',
  hero: 'Banner principal (hero)',
  infoCards: 'Tarjetas de contacto',
  ofertas: 'Qué ofrecemos',
  beneficios: 'Beneficios',
  quoteBand: 'Frase destacada',
  serviciosEmpresa: 'Servicios para empresas',
  testimonios: 'Testimonios',
  valores: 'Valores / Somos tu mejor opción',
  cursosVirtuales: 'Cursos virtuales (catálogo)',
  carreras: 'Carreras técnicas',
  pasos: 'Cómo funciona',
  appMobile: 'App Mobile',
  faq: 'Preguntas frecuentes',
  pilares: 'Capacitación y campañas',
};

function paginasDefault(nav = {}) {
  return {
    home: { activa: true, etiquetaMenu: nav.home || 'Inicio', ruta: '/' },
    tienda: { activa: true, etiquetaMenu: nav.tienda || 'Tienda', ruta: '/tienda' },
    cursos: { activa: true, etiquetaMenu: nav.cursos || 'Cursos', ruta: '/cursos' },
    aula: { activa: true, etiquetaMenu: nav.aula || 'Aula virtual', ruta: '/aula' },
    fundacion: { activa: true, etiquetaMenu: nav.fundacion || 'Fundación', ruta: '/fundacion' },
    consultaCertificados: {
      activa: true,
      etiquetaMenu: nav.consultaCertificados || 'Certificados',
      ruta: '/consulta-certificados',
    },
    blog: { activa: true, etiquetaMenu: nav.blog || 'Blog', ruta: '/blog' },
    acerca: { activa: true, etiquetaMenu: nav.acerca || 'Acerca de', ruta: '/acerca' },
  };
}

const { PORTAL_TEMA_EDUCARTE } = require('./portalTemaEducarte');

const SITE_DEFAULTS = {
  tema: { ...PORTAL_TEMA_EDUCARTE },
  marca: {
    textoCopyright: '',
    ocultarMarcaDesarrollador: true,
    textoPieDesarrollador: '',
  },
  home: {
    orden: [...HOME_SECCIONES_ORDEN],
    secciones: Object.fromEntries(HOME_SECCIONES_ORDEN.map((k) => [k, true])),
  },
};

module.exports = {
  SITE_DEFAULTS,
  HOME_SECCIONES_ORDEN,
  HOME_SECCIONES_LABELS,
  paginasDefault,
};
