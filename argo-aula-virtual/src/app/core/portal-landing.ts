import { PORTAL_SEO_DESCRIPTION, PORTAL_SEO_KEYWORDS } from './portal-seo-defaults';
import { FUNDACION_LANDING_DEFAULTS } from '../pages/fundacion/fundacion-content';
import {
  APP_MOBILE,
  BENEFICIOS_CURSOS,
  CARRERAS_TECNICAS,
  FAQ_CURSOS,
  OFERTAS,
  PASOS_PROGRAMAS,
  PILARES,
  SERVICIOS_EMPRESA,
  TESTIMONIOS,
  VALORES,
} from '../pages/home/home-content';

export interface FundacionDestacado {
  icon: string;
  label: string;
  text: string;
}

export interface FundacionBloque {
  icon: string;
  titulo: string;
  texto: string;
}

export interface PortalFundacionLanding {
  hero: {
    kicker: string;
    titulo: string;
    lead: string;
    imagenUrl: string;
    imagenAlt: string;
    imagenCaption: string;
    btnSitioUrl: string;
    btnSitioLabel: string;
    btnCursosLabel: string;
  };
  quienes: {
    kicker: string;
    titulo: string;
    lead: string;
    destacados: FundacionDestacado[];
    bloques: FundacionBloque[];
    enlaceUrl: string;
    enlaceLabel: string;
  };
  mision: string;
  vision: string;
  compromiso: { kicker: string; titulo: string; texto: string };
  lineas: {
    kicker: string;
    titulo: string;
    lead: string;
    items: { icon: string; title: string; text: string }[];
  };
  cta: {
    kicker: string;
    titulo: string;
    texto: string;
    btnRegistro: string;
    btnServicios: string;
  };
  contacto: { kicker: string; titulo: string; lead: string; sedeNota: string };
}

export interface LandingInfoCard {
  icon: string;
  title: string;
  text: string;
  fuente: 'texto' | 'telefono' | 'direccion';
}

export interface PortalLandingConfig {
  instBarTag: string;
  quoteText: string;
  quoteLabel: string;
  metaDescription: string;
  metaKeywords: string;
  hero: {
    ctaPrincipal: string;
    ctaSecundario: string;
    mostrarBotonLlamar: boolean;
    imagenAlt: string;
  };
  infoCards: LandingInfoCard[];
  nav: {
    home: string;
    tienda: string;
    cursos: string;
    aula: string;
    acerca: string;
    fundacion: string;
    consultaCertificados: string;
    blog: string;
    acceder: string;
    registrarse: string;
    salir: string;
  };
  footer: {
    founded: string;
    copyright: string;
    tituloEnlaces: string;
    tituloServicios: string;
    tituloContacto: string;
  };
  catalogo: {
    tituloCursos: string;
    tituloTienda: string;
    leadCursos: string;
    leadTienda: string;
    placeholderBuscar: string;
  };
  ofertas: { titulo: string; lead: string; items: { icon: string; title: string; text?: string }[] };
  beneficios: {
    kicker: string;
    titulo: string;
    lead: string;
    items: { icon: string; title: string; text?: string }[];
  };
  servicios: { titulo: string; items: { icon: string; title: string; url?: string }[] };
  valores: { titulo: string; lead: string; items: { title: string; text: string }[] };
  testimonios: {
    kicker: string;
    titulo: string;
    lead: string;
    items: { nombre: string; rol: string; texto: string }[];
  };
  pasos: {
    kicker: string;
    titulo: string;
    lead: string;
    items: { paso: string; title: string; text: string }[];
  };
  appMobile: {
    kicker: string;
    titulo: string;
    lead: string;
    features: { icon: string; title: string; text: string }[];
    btnDescargar: string;
    notaInstalacion: string;
    apkUrl: string;
    apkNombre: string;
  };
  faq: {
    kicker: string;
    titulo: string;
    lead: string;
    contactoTexto: string;
    items: { pregunta: string; respuesta: string }[];
  };
  cursos: { kicker: string; titulo: string; emptyTitulo: string; emptyTexto: string };
  blog: {
    kicker: string;
    titulo: string;
    lead: string;
    emptyTitulo: string;
    emptyTexto: string;
  };
  carreras: {
    kicker: string;
    titulo: string;
    lead: string;
    items: { titulo: string; cno: string; horas: number; semestres: number; jornadas: string }[];
  };
  pilares: {
    tabCapacitacion: string;
    tabCampanas: string;
    capacitacion: string[];
    campanas: string[];
  };
  footerServicios: string[];
  fundacion: PortalFundacionLanding;
}

export const PORTAL_LANDING_FALLBACK: PortalLandingConfig = {
  instBarTag: 'Educación, cultura y desarrollo comunitario en Colombia',
  quoteText:
    'Solidaridad, inclusión y educación de calidad para construir futuro en las comunidades colombianas.',
  quoteLabel: 'O contáctanos',
  metaDescription: PORTAL_SEO_DESCRIPTION,
  metaKeywords: PORTAL_SEO_KEYWORDS,
  hero: {
    ctaPrincipal: 'Ver cursos y programas',
    ctaSecundario: 'Crear cuenta gratis',
    mostrarBotonLlamar: true,
    imagenAlt: 'Participante en programas de formación de Educarte Colombia',
  },
  infoCards: [
    { icon: '🎓', title: 'Capacitación', text: 'Certificamos con calidad', fuente: 'texto' },
    { icon: '📞', title: 'Línea de atención', text: '', fuente: 'telefono' },
    { icon: '📍', title: 'Dirección', text: '', fuente: 'direccion' },
  ],
  nav: {
    home: 'Home',
    tienda: 'Tienda',
    cursos: 'Cursos',
    aula: 'Aula virtual',
    acerca: 'Acerca de',
    fundacion: 'Quiénes somos',
    consultaCertificados: 'Certificados',
    blog: 'Blog',
    acceder: 'Acceder',
    registrarse: 'Registrarse',
    salir: 'Salir',
  },
  footer: {
    founded: 'Est. 2025',
    copyright: 'Copyright © 2026 Fundación Educarte Colombia. Todos los derechos reservados.',
    tituloEnlaces: 'Enlaces rápidos',
    tituloServicios: 'Servicios',
    tituloContacto: 'Contáctanos',
  },
  catalogo: {
    tituloCursos: 'Catálogo de cursos y programas',
    tituloTienda: 'Tienda de formación',
    leadCursos: 'Explore cursos y programas de Fundación Educarte Colombia disponibles en el aula virtual.',
    leadTienda: 'Inscríbase a cursos y programas de formación con impacto social y comunitario.',
    placeholderBuscar: 'Buscar curso o programa…',
  },
  ofertas: {
    titulo: '¿Qué ofrecemos?',
    lead: 'Educación, formación técnica y proyectos sociales para personas, familias y comunidades.',
    items: [...OFERTAS],
  },
  beneficios: {
    kicker: 'Impacto',
    titulo: 'Lo que logra con nuestros programas',
    lead: 'Formación práctica, inclusión y flexibilidad para avanzar sin dejar de lado su vida diaria.',
    items: [...BENEFICIOS_CURSOS],
  },
  servicios: { titulo: 'Nuestros ejes de trabajo', items: [...SERVICIOS_EMPRESA] },
  valores: { titulo: 'Nuestros principios', lead: 'Actuamos con solidaridad, equidad e inclusión en cada programa y proyecto.', items: [...VALORES] },
  testimonios: {
    kicker: 'Voces',
    titulo: 'Experiencias de nuestra comunidad',
    lead: 'Personas y líderes comunitarios que han participado en nuestros programas.',
    items: [...TESTIMONIOS],
  },
  pasos: {
    kicker: 'Empiece hoy',
    titulo: 'Cómo acceder a la formación',
    lead: 'Tres pasos para matricularse en el aula virtual y comenzar su proceso.',
    items: [...PASOS_PROGRAMAS],
  },
  appMobile: { ...APP_MOBILE, features: [...APP_MOBILE.features] },
  faq: {
    kicker: 'Ayuda',
    titulo: 'Preguntas frecuentes',
    lead: 'Resolvemos las dudas más comunes sobre la Fundación y el aula virtual.',
    contactoTexto: '¿Aún tiene dudas sobre un curso o programa?',
    items: [...FAQ_CURSOS],
  },
  cursos: {
    kicker: 'Catálogo en línea',
    titulo: 'Cursos y programas disponibles',
    emptyTitulo: 'Próximamente nuevos programas',
    emptyTexto: 'Estamos publicando más cursos y programas de formación. Vuelva pronto o contáctenos.',
  },
  blog: {
    kicker: 'Blog',
    titulo: 'Noticias y artículos',
    lead: 'Novedades sobre educación, proyectos sociales, emprendimiento y desarrollo comunitario.',
    emptyTitulo: 'Próximamente publicaremos artículos',
    emptyTexto: 'Vuelva pronto para leer las últimas noticias de Educarte Colombia.',
  },
  carreras: {
    kicker: 'Programas formativos',
    titulo: 'Líneas de formación',
    lead: 'Rutas de aprendizaje alineadas con nuestros ejes educativos, sociales y productivos.',
    items: [...CARRERAS_TECNICAS],
  },
  pilares: {
    tabCapacitacion: 'Educación y formación',
    tabCampanas: 'Comunidad y proyectos',
    capacitacion: [...PILARES.capacitacion],
    campanas: [...PILARES.campanas],
  },
  footerServicios: [
    'Educación y pedagogía',
    'Desarrollo social comunitario',
    'Emprendimiento',
    'Formación rural',
    'Seguridad vial y movilidad',
    'Alfabetización digital',
  ],
  fundacion: JSON.parse(JSON.stringify(FUNDACION_LANDING_DEFAULTS)) as PortalFundacionLanding,
};

function mergeFundacionLanding(raw?: Partial<PortalFundacionLanding> | null): PortalFundacionLanding {
  const d = PORTAL_LANDING_FALLBACK.fundacion;
  if (!raw) return JSON.parse(JSON.stringify(d)) as PortalFundacionLanding;
  return {
    hero: {
      ...d.hero,
      ...raw.hero,
      imagenUrl: raw.hero?.imagenUrl?.trim() || d.hero.imagenUrl,
    },
    quienes: {
      ...d.quienes,
      ...raw.quienes,
      destacados: raw.quienes?.destacados?.length ? raw.quienes.destacados : d.quienes.destacados,
      bloques: raw.quienes?.bloques?.length ? raw.quienes.bloques : d.quienes.bloques,
    },
    mision: raw.mision?.trim() ? raw.mision : d.mision,
    vision: raw.vision?.trim() ? raw.vision : d.vision,
    compromiso: { ...d.compromiso, ...raw.compromiso },
    lineas: {
      ...d.lineas,
      ...raw.lineas,
      items: raw.lineas?.items?.length ? raw.lineas.items : d.lineas.items,
    },
    cta: { ...d.cta, ...raw.cta },
    contacto: { ...d.contacto, ...raw.contacto },
  };
}

function mergeServiciosItems(
  rawItems: { icon: string; title: string; url?: string }[] | undefined,
  defaults: { icon: string; title: string; url?: string }[],
) {
  const items = rawItems?.length ? rawItems : defaults;
  const urlByTitle = new Map(defaults.map((item) => [item.title.trim().toLowerCase(), item.url || '']));
  return items.map((item) => ({
    ...item,
    url:
      item.url != null
        ? String(item.url).trim()
        : (urlByTitle.get(item.title.trim().toLowerCase()) || '').trim(),
  }));
}

export function mergePortalLanding(raw?: Partial<PortalLandingConfig> | null): PortalLandingConfig {
  const d = PORTAL_LANDING_FALLBACK;
  if (!raw) return JSON.parse(JSON.stringify(d)) as PortalLandingConfig;
  return {
    ...d,
    ...raw,
    ofertas: { ...d.ofertas, ...raw.ofertas, items: raw.ofertas?.items?.length ? raw.ofertas.items : d.ofertas.items },
    beneficios: {
      ...d.beneficios,
      ...raw.beneficios,
      items: raw.beneficios?.items?.length ? raw.beneficios.items : d.beneficios.items,
    },
    servicios: {
      ...d.servicios,
      ...raw.servicios,
      items: mergeServiciosItems(raw.servicios?.items, d.servicios.items),
    },
    valores: {
      ...d.valores,
      ...raw.valores,
      items: raw.valores?.items?.length ? raw.valores.items : d.valores.items,
    },
    testimonios: {
      ...d.testimonios,
      ...raw.testimonios,
      items: raw.testimonios?.items?.length ? raw.testimonios.items : d.testimonios.items,
    },
    pasos: {
      ...d.pasos,
      ...raw.pasos,
      items: raw.pasos?.items?.length ? raw.pasos.items : d.pasos.items,
    },
    appMobile: {
      ...d.appMobile,
      ...raw.appMobile,
      features: raw.appMobile?.features?.length ? raw.appMobile.features : d.appMobile.features,
    },
    faq: {
      ...d.faq,
      ...raw.faq,
      items: raw.faq?.items?.length ? raw.faq.items : d.faq.items,
    },
    hero: { ...d.hero, ...raw.hero },
    infoCards: raw.infoCards?.length ? raw.infoCards : d.infoCards,
    nav: { ...d.nav, ...raw.nav },
    footer: { ...d.footer, ...raw.footer },
    catalogo: { ...d.catalogo, ...raw.catalogo },
    quoteLabel: raw.quoteLabel ?? d.quoteLabel,
    metaDescription: raw.metaDescription?.trim() || d.metaDescription,
    metaKeywords: raw.metaKeywords?.trim() || d.metaKeywords,
    cursos: { ...d.cursos, ...raw.cursos },
    blog: { ...d.blog, ...raw.blog },
    carreras: {
      ...d.carreras,
      ...raw.carreras,
      items: raw.carreras?.items?.length ? raw.carreras.items : d.carreras.items,
    },
    pilares: {
      tabCapacitacion: raw.pilares?.tabCapacitacion ?? d.pilares.tabCapacitacion,
      tabCampanas: raw.pilares?.tabCampanas ?? d.pilares.tabCampanas,
      capacitacion: raw.pilares?.capacitacion?.length ? raw.pilares.capacitacion : d.pilares.capacitacion,
      campanas: raw.pilares?.campanas?.length ? raw.pilares.campanas : d.pilares.campanas,
    },
    footerServicios: raw.footerServicios?.length ? raw.footerServicios : d.footerServicios,
    fundacion: mergeFundacionLanding(raw.fundacion),
  };
}
