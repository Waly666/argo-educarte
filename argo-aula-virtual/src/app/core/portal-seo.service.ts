import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import { CursoVirtual, PortalConfig } from './models';
import {
  ACERCA_SEO_DESCRIPTION,
  ACERCA_SEO_TITLE,
  AULA_SEO_TITLE,
  CONSULTA_CERT_SEO_DESCRIPTION,
  CONSULTA_CERT_SEO_KEYWORDS,
  CONSULTA_CERT_SEO_TITLE,
  BLOG_SEO_DESCRIPTION,
  BLOG_SEO_KEYWORDS,
  BLOG_SEO_TITLE,
  CURSOS_SEO_DESCRIPTION,
  CURSOS_SEO_TITLE,
  FUNDACION_SEO_DESCRIPTION,
  FUNDACION_SEO_KEYWORDS,
  FUNDACION_SEO_TITLE,
  LOGIN_SEO_TITLE,
  PORTAL_SEO_KEYWORDS,
  REGISTRO_SEO_TITLE,
  SEO_BRAND,
  SEO_LOCALITY,
  SEO_REGION,
  TIENDA_SEO_DESCRIPTION,
  TIENDA_SEO_TITLE,
} from './portal-seo-defaults';

type PageMetaOpts = {
  pageTitle: string;
  description: string;
  keywords: string;
  url: string;
  image: string;
  siteName?: string;
  robots?: string;
  themeColor?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[] | null;
};

@Injectable({ providedIn: 'root' })
export class PortalSeoService {
  private title = inject(Title);
  private meta = inject(Meta);
  private doc = inject(DOCUMENT);

  applyHome(config: PortalConfig | null, cursos: CursoVirtual[] = []) {
    const nombre = this.orgName(config);
    const pageTitle = `Cursos virtuales en seguridad vial | ${SEO_BRAND} — ${SEO_LOCALITY}, ${SEO_REGION}`;
    const landing = config?.landing;
    const description = this.truncate(
      landing?.metaDescription?.trim() || this.buildDescription(config, cursos),
    );
    const keywords = landing?.metaKeywords?.trim() || this.buildKeywords(cursos);
    const url = this.pageUrl('/');
    const image = this.defaultImage(config);

    this.applyPageMeta({
      pageTitle,
      description,
      keywords,
      url,
      image,
      siteName: SEO_BRAND,
      themeColor: this.themeColor(config),
      jsonLd: this.buildHomeJsonLd(config, cursos, url, nombre),
    });
  }

  applyCursos(config: PortalConfig | null, modo: 'cursos' | 'tienda' = 'cursos') {
    const isTienda = modo === 'tienda';
    const url = this.pageUrl(isTienda ? '/tienda' : '/cursos');
    this.applyPageMeta({
      pageTitle: isTienda ? TIENDA_SEO_TITLE : CURSOS_SEO_TITLE,
      description: this.truncate(isTienda ? TIENDA_SEO_DESCRIPTION : CURSOS_SEO_DESCRIPTION),
      keywords: PORTAL_SEO_KEYWORDS,
      url,
      image: this.defaultImage(config),
      siteName: SEO_BRAND,
      themeColor: this.themeColor(config),
      jsonLd: this.breadcrumbJsonLd(url, [
        { name: 'Inicio', path: '/' },
        { name: isTienda ? 'Tienda' : 'Cursos', path: isTienda ? '/tienda' : '/cursos' },
      ]),
    });
  }

  applyCursoDetalle(config: PortalConfig | null, curso: CursoVirtual) {
    const nombre = curso.nombreProg?.trim() || 'Curso virtual';
    const pageTitle = `${nombre} | ${SEO_BRAND} — ${SEO_LOCALITY}`;
    const rawDesc =
      curso.descripcionVirtual?.trim() ||
      curso.descripcion?.trim() ||
      `Programa virtual de ${nombre} en seguridad vial. Matricúlese en FINSTRUVIAL, Villavicencio, Meta.`;
    const url = this.pageUrl(`/cursos/${curso.idPrograma}`);
    const image = curso.urlPortadaAbsoluta || curso.urlPortadaVirtual || this.defaultImage(config);
    const keywords = [nombre, SEO_BRAND, `curso virtual ${SEO_LOCALITY}`, PORTAL_SEO_KEYWORDS]
      .filter(Boolean)
      .join(', ');

    this.applyPageMeta({
      pageTitle: this.truncateTitle(pageTitle),
      description: this.truncate(rawDesc),
      keywords,
      url,
      image,
      siteName: SEO_BRAND,
      themeColor: this.themeColor(config),
      jsonLd: [
        ...this.breadcrumbJsonLd(url, [
          { name: 'Inicio', path: '/' },
          { name: 'Cursos', path: '/cursos' },
          { name: nombre, path: `/cursos/${curso.idPrograma}` },
        ]),
        {
          '@type': 'Course',
          name: nombre,
          description: this.truncate(rawDesc, 300),
          provider: { '@type': 'EducationalOrganization', name: this.orgName(config) },
          url,
          image,
          inLanguage: 'es-CO',
          offers:
            curso.tarifaVirtual > 0
              ? {
                  '@type': 'Offer',
                  price: curso.tarifaVirtual,
                  priceCurrency: 'COP',
                  availability: 'https://schema.org/InStock',
                }
              : undefined,
        },
      ],
    });
  }

  applyAcerca(config: PortalConfig | null) {
    const url = this.pageUrl('/acerca');
    this.applyPageMeta({
      pageTitle: ACERCA_SEO_TITLE,
      description: this.truncate(ACERCA_SEO_DESCRIPTION),
      keywords: PORTAL_SEO_KEYWORDS,
      url,
      image: this.defaultImage(config),
      siteName: SEO_BRAND,
      themeColor: this.themeColor(config),
      jsonLd: this.breadcrumbJsonLd(url, [
        { name: 'Inicio', path: '/' },
        { name: 'Acerca de', path: '/acerca' },
      ]),
    });
  }

  applyConsultaCertificados(config: PortalConfig | null) {
    const url = this.pageUrl('/consulta-certificados');
    this.applyPageMeta({
      pageTitle: CONSULTA_CERT_SEO_TITLE,
      description: this.truncate(CONSULTA_CERT_SEO_DESCRIPTION),
      keywords: CONSULTA_CERT_SEO_KEYWORDS,
      url,
      image: this.defaultImage(config),
      siteName: SEO_BRAND,
      themeColor: this.themeColor(config),
      jsonLd: [
        ...this.breadcrumbJsonLd(url, [
          { name: 'Inicio', path: '/' },
          { name: 'Consulta certificados', path: '/consulta-certificados' },
        ]),
        {
          '@type': 'WebPage',
          name: CONSULTA_CERT_SEO_TITLE,
          description: CONSULTA_CERT_SEO_DESCRIPTION,
          url,
          isPartOf: { '@type': 'WebSite', name: `${SEO_BRAND} — Aula virtual`, url: this.pageUrl('/') },
        },
      ],
    });
  }

  applyBlog(config: PortalConfig | null) {
    const landing = config?.landing;
    const pageTitle = landing?.blog?.titulo
      ? `${landing.blog.titulo} | ${SEO_BRAND}`
      : BLOG_SEO_TITLE;
    const description = this.truncate(landing?.blog?.lead?.trim() || BLOG_SEO_DESCRIPTION);
    const url = this.pageUrl('/blog');
    this.applyPageMeta({
      pageTitle,
      description,
      keywords: BLOG_SEO_KEYWORDS,
      url,
      image: this.defaultImage(config),
      siteName: SEO_BRAND,
      themeColor: this.themeColor(config),
      jsonLd: this.breadcrumbJsonLd(url, [
        { name: 'Inicio', path: '/' },
        { name: landing?.blog?.titulo || 'Blog', path: '/blog' },
      ]),
    });
  }

  applyBlogPost(
    config: PortalConfig | null,
    post: { titulo: string; slug: string; contenido?: string; autorNombre?: string; publicadoAt?: string | null },
  ) {
    const url = this.pageUrl(`/blog/${post.slug}`);
    const description = this.truncate(
      (post.contenido || '').replace(/\s+/g, ' ').trim().slice(0, 160) ||
        config?.landing?.blog?.lead ||
        BLOG_SEO_DESCRIPTION,
    );
    this.applyPageMeta({
      pageTitle: `${post.titulo} | ${SEO_BRAND}`,
      description,
      keywords: BLOG_SEO_KEYWORDS,
      url,
      image: this.defaultImage(config),
      siteName: SEO_BRAND,
      themeColor: this.themeColor(config),
      jsonLd: [
        ...this.breadcrumbJsonLd(url, [
          { name: 'Inicio', path: '/' },
          { name: config?.landing?.blog?.titulo || 'Blog', path: '/blog' },
          { name: post.titulo, path: `/blog/${post.slug}` },
        ]),
        {
          '@type': 'BlogPosting',
          headline: post.titulo,
          description,
          url,
          datePublished: post.publicadoAt || undefined,
          author: post.autorNombre
            ? { '@type': 'Person', name: post.autorNombre }
            : { '@type': 'Organization', name: SEO_BRAND },
          publisher: { '@type': 'Organization', name: SEO_BRAND },
          isPartOf: { '@type': 'WebSite', name: `${SEO_BRAND} — Aula virtual`, url: this.pageUrl('/') },
        },
      ],
    });
  }

  applyFundacion(config: PortalConfig | null) {
    const url = this.pageUrl('/fundacion');
    this.applyPageMeta({
      pageTitle: FUNDACION_SEO_TITLE,
      description: this.truncate(FUNDACION_SEO_DESCRIPTION),
      keywords: FUNDACION_SEO_KEYWORDS,
      url,
      image: this.defaultImage(config),
      siteName: SEO_BRAND,
      themeColor: this.themeColor(config),
      jsonLd: [
        ...this.breadcrumbJsonLd(url, [
          { name: 'Inicio', path: '/' },
          { name: 'Fundación', path: '/fundacion' },
        ]),
        {
          '@type': 'NGO',
          name: this.orgName(config),
          url,
          description: FUNDACION_SEO_DESCRIPTION,
          address: this.postalAddress(config),
          areaServed: [
            { '@type': 'City', name: SEO_LOCALITY },
            { '@type': 'AdministrativeArea', name: SEO_REGION },
            { '@type': 'Country', name: 'Colombia' },
          ],
        },
      ],
    });
  }

  applyLogin(config: PortalConfig | null) {
    this.applyPrivatePage(LOGIN_SEO_TITLE, 'Acceda a su aula virtual con correo y contraseña.', '/login', config);
  }

  applyRegistro(config: PortalConfig | null) {
    this.applyPrivatePage(
      REGISTRO_SEO_TITLE,
      'Cree su cuenta en el portal estudiantil de FINSTRUVIAL para cursar programas virtuales.',
      '/registro',
      config,
    );
  }

  applyAula(config: PortalConfig | null) {
    this.applyPrivatePage(
      AULA_SEO_TITLE,
      'Panel del estudiante: cursos, progreso y certificados del aula virtual FINSTRUVIAL.',
      '/aula',
      config,
    );
  }

  private applyPrivatePage(
    pageTitle: string,
    description: string,
    path: string,
    config: PortalConfig | null,
  ) {
    this.applyPageMeta({
      pageTitle,
      description: this.truncate(description),
      keywords: SEO_BRAND,
      url: this.pageUrl(path),
      image: this.defaultImage(config),
      siteName: SEO_BRAND,
      robots: 'noindex, follow',
      themeColor: this.themeColor(config),
      jsonLd: null,
    });
  }

  private applyPageMeta(opts: PageMetaOpts) {
    const siteName = opts.siteName || SEO_BRAND;
    const robots = opts.robots || 'index, follow';

    this.title.setTitle(this.truncateTitle(opts.pageTitle));
    this.setMeta('description', opts.description);
    this.setMeta('keywords', opts.keywords);
    this.setMeta('robots', robots);
    this.setMeta('author', siteName);
    this.setMeta('application-name', siteName);
    this.setMeta('geo.region', 'CO-MET');
    this.setMeta('geo.placename', SEO_LOCALITY);
    this.setMeta('geo.position', '4.142;-73.626');
    this.setMeta('ICBM', '4.142, -73.626');
    this.setMeta('theme-color', opts.themeColor?.trim() || '#0b1224');

    this.setOg('og:title', this.truncateTitle(opts.pageTitle));
    this.setOg('og:description', opts.description);
    this.setOg('og:type', 'website');
    this.setOg('og:locale', 'es_CO');
    this.setOg('og:site_name', siteName);
    if (opts.url) this.setOg('og:url', opts.url);
    if (opts.image) {
      this.setOg('og:image', opts.image);
      this.setOg('og:image:alt', `${siteName} — ${SEO_LOCALITY}, ${SEO_REGION}`);
    }

    this.setName('twitter:card', 'summary_large_image');
    this.setName('twitter:title', this.truncateTitle(opts.pageTitle));
    this.setName('twitter:description', opts.description);
    if (opts.image) this.setName('twitter:image', opts.image);

    if (opts.url) this.setCanonical(opts.url);
    this.setJsonLd(opts.jsonLd);
  }

  private orgName(config: PortalConfig | null): string {
    return config?.nombreCea?.trim() || 'Fundación Finstruvial';
  }

  private themeColor(config: PortalConfig | null): string {
    return config?.site?.tema?.colorFondo?.trim() || '#0b1224';
  }

  private pageUrl(path: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (!origin) return '';
    const clean = path.startsWith('/') ? path : `/${path}`;
    return `${origin}${clean}`;
  }

  private defaultImage(config: PortalConfig | null, fallback = '/images/hero-estudiante.png'): string {
    const logo = config?.urlLogoAbsoluta?.trim();
    if (logo) return logo;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return origin ? `${origin}${fallback}` : '';
  }

  private postalAddress(config: PortalConfig | null) {
    return {
      '@type': 'PostalAddress',
      streetAddress: config?.direccion || 'Carrera 19c #38-22',
      addressLocality: config?.ciudad?.trim() || SEO_LOCALITY,
      addressRegion: SEO_REGION,
      addressCountry: 'CO',
    };
  }

  private truncate(text: string, max = 158): string {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1).trimEnd()}…`;
  }

  private truncateTitle(text: string, max = 62): string {
    const t = String(text || '').trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1).trimEnd()}…`;
  }

  private buildDescription(config: PortalConfig | null, cursos: CursoVirtual[]): string {
    const nombre = this.orgName(config);
    const custom = config?.heroSubtitulo?.trim();
    const ciudad = config?.ciudad?.trim() || SEO_LOCALITY;
    const nombresCursos = cursos
      .slice(0, 2)
      .map((c) => c.nombreProg)
      .filter(Boolean);
    const ejemplos =
      nombresCursos.length > 0 ? ` Programas: ${nombresCursos.join(', ')}.` : '';
    if (custom && custom.length > 40) {
      return `${custom} Cursos virtuales de ${nombre} en ${ciudad}, ${SEO_REGION}, Colombia.${ejemplos}`;
    }
    return `Cursos y programas virtuales en seguridad vial en ${ciudad}, ${SEO_REGION} y Colombia. Estudie con ${SEO_BRAND}, certifique su formación y consulte certificados en línea.${ejemplos}`;
  }

  private buildKeywords(cursos: CursoVirtual[]): string {
    const dinamicos = cursos
      .slice(0, 5)
      .map((c) => c.nombreProg?.trim())
      .filter(Boolean)
      .join(', ');
    return dinamicos ? `${PORTAL_SEO_KEYWORDS}, ${dinamicos}` : PORTAL_SEO_KEYWORDS;
  }

  private breadcrumbJsonLd(
    pageUrl: string,
    items: { name: string; path: string }[],
  ): Record<string, unknown>[] {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return [
      {
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: item.name,
          item: origin ? `${origin}${item.path}` : undefined,
        })),
      },
      {
        '@type': 'WebPage',
        name: items[items.length - 1]?.name,
        url: pageUrl || undefined,
        inLanguage: 'es-CO',
      },
    ];
  }

  private buildHomeJsonLd(
    config: PortalConfig | null,
    cursos: CursoVirtual[],
    url: string,
    nombre: string,
  ): Record<string, unknown>[] {
    const graph: Record<string, unknown>[] = [
      {
        '@type': 'EducationalOrganization',
        name: nombre,
        alternateName: SEO_BRAND,
        url: url || undefined,
        logo: config?.urlLogoAbsoluta || undefined,
        description: this.truncate(FUNDACION_SEO_DESCRIPTION, 220),
        address: this.postalAddress(config),
        areaServed: [
          { '@type': 'City', name: SEO_LOCALITY },
          { '@type': 'AdministrativeArea', name: SEO_REGION },
          { '@type': 'Country', name: 'Colombia' },
        ],
        telephone: config?.telefono || undefined,
        email: config?.email || undefined,
      },
      {
        '@type': 'WebSite',
        name: `${SEO_BRAND} — Aula virtual`,
        alternateName: nombre,
        url: url || undefined,
        description: this.truncate(
          config?.landing?.metaDescription?.trim() ||
            'Catálogo de cursos y programas virtuales en seguridad vial en Villavicencio, Meta y Colombia.',
          200,
        ),
        inLanguage: 'es-CO',
        potentialAction: {
          '@type': 'SearchAction',
          target: url ? `${url}cursos?q={search_term_string}` : undefined,
          'query-input': 'required name=search_term_string',
        },
      },
    ];

    for (const c of cursos.slice(0, 10)) {
      graph.push({
        '@type': 'Course',
        name: c.nombreProg,
        description: this.truncate(
          c.descripcionVirtual || c.descripcion || `Programa virtual: ${c.nombreProg}`,
          220,
        ),
        provider: { '@type': 'EducationalOrganization', name: nombre },
        url: url ? `${url}cursos/${c.idPrograma}` : undefined,
        offers:
          c.tarifaVirtual > 0
            ? {
                '@type': 'Offer',
                price: c.tarifaVirtual,
                priceCurrency: 'COP',
                availability: 'https://schema.org/InStock',
              }
            : undefined,
      });
    }

    return graph;
  }

  private setJsonLd(data: PageMetaOpts['jsonLd']) {
    this.doc.getElementById('argo-portal-jsonld')?.remove();
    if (!data) return;

    const graph = Array.isArray(data) ? data : [data];
    const script = this.doc.createElement('script');
    script.id = 'argo-portal-jsonld';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': graph,
    });
    this.doc.head.appendChild(script);
  }

  private upsertTag(tag: { name?: string; property?: string; content: string }) {
    if (!tag.content) return;
    if (tag.name) {
      this.meta.updateTag({ name: tag.name, content: tag.content }, `name="${tag.name}"`);
      return;
    }
    if (tag.property) {
      this.meta.updateTag({ property: tag.property, content: tag.content }, `property="${tag.property}"`);
    }
  }

  private setMeta(name: string, content: string) {
    this.upsertTag({ name, content });
  }

  private setName(name: string, content: string) {
    this.upsertTag({ name, content });
  }

  private setOg(property: string, content: string) {
    this.upsertTag({ property, content });
  }

  private setCanonical(href: string) {
    let link = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.rel = 'canonical';
      this.doc.head.appendChild(link);
    }
    link.href = href;
  }
}
