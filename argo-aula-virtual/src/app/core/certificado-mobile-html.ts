/** Misma adaptación que apps móviles: certificado idéntico al ERP en pantalla estrecha. */

export function isCertificadoHtml(html: string): boolean {
  return html.includes('class="bg-fondo"') || html.includes("class='bg-fondo'");
}

function certificadoEsHorizontal(html: string): boolean {
  return /@page\s*\{[^}]*size:\s*297mm\s+210mm/i.test(html);
}

function injectViewport(html: string): string {
  if (/name=["']viewport["']/i.test(html)) return html;
  return html.replace(
    /<head([^>]*)>/i,
    `<head$1>\n  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=4"/>`,
  );
}

function injectBeforeHeadClose(html: string, snippet: string): string {
  if (html.includes('</head>')) {
    return html.replace('</head>', `${snippet}\n</head>`);
  }
  return `${html}${snippet}`;
}

function fixCqhUnits(html: string, horizontal: boolean): string {
  const pageW = horizontal ? 297 : 210;
  const pageH = horizontal ? 210 : 297;
  const sheetHeightVw = (pageH / pageW) * 100;
  return html.replace(/(\d+(?:\.\d+)?)\s*cqh/gi, (_, num) => {
    const n = parseFloat(num);
    return `${((n / 100) * sheetHeightVw).toFixed(4)}vw`;
  });
}

function fixCqwUnits(html: string): string {
  return html.replace(/(\d+(?:\.\d+)?)\s*cqw/gi, (_, num) => {
    return `${parseFloat(num).toFixed(4)}vw`;
  });
}

function stripDuplicateMmUnits(html: string): string {
  return html
    .replace(/font-size:\s*[\d.]+mm\s*(?:!important)?;\s*(?=font-size:)/gi, '')
    .replace(/width:\s*[\d.]+mm\s*(?:!important)?;\s*(?=width:)/gi, '');
}

function certificadoMobileCss(horizontal: boolean): string {
  const pageW = horizontal ? 297 : 210;
  const pageH = horizontal ? 210 : 297;
  const sheetHeightVw = (pageH / pageW) * 100;
  return `
<style id="argo-mobile-cert">
  @media screen {
    html, body {
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow-x: hidden !important;
      background: #525659 !important;
      -webkit-text-size-adjust: 100% !important;
      text-size-adjust: 100% !important;
    }
    .no-print { display: none !important; }
    .sheet {
      position: relative !important;
      display: block !important;
      width: 100vw !important;
      max-width: 100vw !important;
      height: ${sheetHeightVw.toFixed(4)}vw !important;
      min-height: ${sheetHeightVw.toFixed(4)}vw !important;
      margin: 0 auto !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
      container-type: size !important;
    }
    .bg-fondo {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: fill !important;
      z-index: 1 !important;
      pointer-events: none !important;
    }
    .content {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100% !important;
      height: 100% !important;
      container-type: size !important;
      z-index: 2 !important;
    }
    .dato, .cert-id, .qr-wrap {
      box-sizing: border-box !important;
    }
    .qr-wrap img {
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: contain !important;
    }
  }
</style>`;
}

/** En popup o pantalla estrecha adapta el HTML al ancho disponible. */
function adaptCertificadoHtml(html: string): string {
  let out = injectViewport(html);
  const horizontal = certificadoEsHorizontal(out);
  out = fixCqhUnits(out, horizontal);
  out = fixCqwUnits(out);
  out = stripDuplicateMmUnits(out);
  return injectBeforeHeadClose(out, certificadoMobileCss(horizontal));
}

/** Vista previa en ventana emergente (ancho fijo ~920px). */
export function rewriteCertificadoHtmlForPreview(html: string): string {
  if (!isCertificadoHtml(html)) return html;
  return adaptCertificadoHtml(html);
}

/** En móvil o ventana estrecha adapta el HTML; en escritorio ancho devuelve el original. */
export function rewriteCertificadoHtmlForScreen(html: string): string {
  if (!isCertificadoHtml(html)) return html;
  const narrow =
    typeof window !== 'undefined' &&
    (window.matchMedia('(max-width: 920px)').matches || window.innerWidth <= 920);
  if (!narrow) return html;
  return adaptCertificadoHtml(html);
}
