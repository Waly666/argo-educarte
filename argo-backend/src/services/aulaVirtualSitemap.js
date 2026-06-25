const { listarCursosVirtuales } = require('./aulaVirtualCatalogo');

const DEFAULT_SITE_URL = 'https://finstruvial.edu.co';

const STATIC_PAGES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/cursos', changefreq: 'daily', priority: '0.9' },
  { path: '/tienda', changefreq: 'daily', priority: '0.85' },
  { path: '/consulta-certificados', changefreq: 'monthly', priority: '0.8' },
  { path: '/acerca', changefreq: 'monthly', priority: '0.75' },
  { path: '/fundacion', changefreq: 'monthly', priority: '0.75' },
];

function siteBaseUrl(req) {
  const fromEnv = String(process.env.PORTAL_SITE_URL || process.env.PUBLIC_URL || '')
    .trim()
    .replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  if (req) {
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
    const host = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
    if (host) return `${proto}://${host}`;
  }

  return DEFAULT_SITE_URL;
}

function escXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmtLastmod(d = new Date()) {
  return new Date(d).toISOString().slice(0, 10);
}

function urlEntry(loc, { changefreq, priority, lastmod }) {
  const parts = [
    '  <url>',
    `    <loc>${escXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${escXml(lastmod)}</lastmod>` : '',
    changefreq ? `    <changefreq>${escXml(changefreq)}</changefreq>` : '',
    priority ? `    <priority>${escXml(priority)}</priority>` : '',
    '  </url>',
  ];
  return parts.filter(Boolean).join('\n');
}

async function generarSitemapXml(req) {
  const base = siteBaseUrl(req);
  const today = fmtLastmod();
  const cursos = await listarCursosVirtuales({ soloPublicados: true });
  const entries = [
    ...STATIC_PAGES.map((p) =>
      urlEntry(`${base}${p.path}`, {
        changefreq: p.changefreq,
        priority: p.priority,
        lastmod: today,
      }),
    ),
    ...cursos.map((c) =>
      urlEntry(`${base}/cursos/${encodeURIComponent(String(c.idPrograma))}`, {
        changefreq: 'weekly',
        priority: '0.7',
        lastmod: today,
      }),
    ),
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries.join('\n'),
    '</urlset>',
    '',
  ].join('\n');
}

module.exports = {
  generarSitemapXml,
  siteBaseUrl,
};
