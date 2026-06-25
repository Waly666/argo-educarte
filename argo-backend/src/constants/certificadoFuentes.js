/**
 * Catálogo de fuentes para certificados (sistema + Google Fonts).
 * Mantener alineado con argo-frontend/.../certificado-campos-layout.ts
 */
const FUENTES_CERTIFICADO = [
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman, Times, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, sans-serif' },
  { label: 'Courier New', value: 'Courier New, monospace' },
  {
    label: 'Montserrat',
    value: '"Montserrat", Arial, sans-serif',
    googleFamily: 'Montserrat',
    googleWeights: '400;600;700',
  },
  {
    label: 'Open Sans',
    value: '"Open Sans", Arial, sans-serif',
    googleFamily: 'Open Sans',
    googleWeights: '400;600;700',
  },
  {
    label: 'Lato',
    value: '"Lato", Arial, sans-serif',
    googleFamily: 'Lato',
    googleWeights: '400;700',
  },
  {
    label: 'Roboto',
    value: '"Roboto", Arial, sans-serif',
    googleFamily: 'Roboto',
    googleWeights: '400;500;700',
  },
  {
    label: 'Playfair Display',
    value: '"Playfair Display", Georgia, serif',
    googleFamily: 'Playfair Display',
    googleWeights: '400;700',
  },
  {
    label: 'Merriweather',
    value: '"Merriweather", Georgia, serif',
    googleFamily: 'Merriweather',
    googleWeights: '400;700',
  },
  {
    label: 'Oswald',
    value: '"Oswald", Arial, sans-serif',
    googleFamily: 'Oswald',
    googleWeights: '400;600;700',
  },
  {
    label: 'Cinzel',
    value: '"Cinzel", Georgia, serif',
    googleFamily: 'Cinzel',
    googleWeights: '400;600;700',
  },
  {
    label: 'Great Vibes',
    value: '"Great Vibes", cursive',
    googleFamily: 'Great Vibes',
  },
  {
    label: 'Dancing Script',
    value: '"Dancing Script", cursive',
    googleFamily: 'Dancing Script',
    googleWeights: '400;700',
  },
];

function buildGoogleFontsHref() {
  const parts = FUENTES_CERTIFICADO.filter((f) => f.googleFamily).map((f) => {
    const enc = f.googleFamily.replace(/ /g, '+');
    if (f.googleWeights) return `family=${enc}:wght@${f.googleWeights}`;
    return `family=${enc}`;
  });
  if (!parts.length) return '';
  return `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap`;
}

function googleFontsHeadHtml() {
  const href = buildGoogleFontsHref();
  if (!href) return '';
  return [
    '<link rel="preconnect" href="https://fonts.googleapis.com"/>',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>',
    `<link href="${href}" rel="stylesheet"/>`,
  ].join('\n  ');
}

/** Sanitiza el valor font-family guardado en layout (stack CSS completo). */
function cssFontFamily(ff) {
  const s = String(ff ?? '').trim();
  if (!s) return 'Arial, Helvetica, sans-serif';
  return s.replace(/[<>"']/g, '');
}

module.exports = {
  FUENTES_CERTIFICADO,
  buildGoogleFontsHref,
  googleFontsHeadHtml,
  cssFontFamily,
};
