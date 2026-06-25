function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const { fmtFecha } = require('../utils/timezoneColombia');

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function lineaHtml(ancho = 32) {
  return `<div class="line">${'─'.repeat(ancho)}</div>`;
}

function nombreSedeVisible(config) {
  return String(config?.nombreSede || '').trim();
}

/** Inserta fila «Sede» en tabla de recibo (después de comprobante/fecha si existen). */
function filasConSede(filas, config) {
  const nombre = nombreSedeVisible(config);
  if (!nombre) return filas;
  const row = ['Sede', nombre];
  const idx = filas.findIndex(([k]) => k === 'Fecha');
  if (idx >= 0) return [...filas.slice(0, idx + 1), row, ...filas.slice(idx + 1)];
  return [row, ...filas];
}

function bloqueEmpresaHtml(config) {
  const v = (x) => esc((x || '').toString().trim());
  const ciudadLine = [config.ciudad, config.departamento].filter((x) => String(x || '').trim()).join(', ');
  const lineas = [];
  const logoSrc = config.urlLogoDataUrl || null;
  if (logoSrc) {
    lineas.push(`<div class="center logo"><img src="${esc(logoSrc)}" alt="Logo" /></div>`);
  }
  if (v(config.nombreEmpresa)) {
    lineas.push(`<div class="center empresa">${v(config.nombreEmpresa)}</div>`);
  }
  if (v(config.nombreSede)) {
    lineas.push(`<div class="center sede-nombre">${v(config.nombreSede)}</div>`);
  }
  if (v(config.nit)) lineas.push(`<div class="center dato">NIT: ${v(config.nit)}</div>`);
  if (v(config.telefono)) lineas.push(`<div class="center dato">Tel: ${v(config.telefono)}</div>`);
  if (v(config.direccion)) lineas.push(`<div class="center dato">Dir: ${v(config.direccion)}</div>`);
  if (ciudadLine) lineas.push(`<div class="center dato">${esc(ciudadLine)}</div>`);
  if (v(config.email)) lineas.push(`<div class="center dato">${v(config.email)}</div>`);
  if (!lineas.length) {
    lineas.push(`<div class="center empresa">${v('ARGO')}</div>`);
  }
  return lineas.join('\n');
}

function estilosRecibo(mm, w) {
  return `
    @page { size: ${mm}mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Courier New", Consolas, monospace;
      font-size: 11px;
      line-height: 1.35;
      margin: 0;
      padding: 8px;
      width: ${w}px;
      max-width: ${w}px;
      color: #000;
      background: #fff;
    }
    .center { text-align: center; }
    .logo { margin: 0 0 5px; }
    .logo img { max-height: 56px; max-width: 130px; object-fit: contain; display: inline-block; }
    .empresa { font-weight: bold; font-size: 12px; margin-bottom: 2px; }
    .sede-nombre { font-weight: bold; font-size: 11px; margin-bottom: 3px; }
    .dato { font-size: 10px; line-height: 1.3; }
    .titulo { font-weight: bold; margin: 6px 0 2px; letter-spacing: 0.5px; font-size: 11px; }
    .slogan { font-size: 10px; margin-bottom: 4px; font-style: italic; }
    .line { text-align: center; color: #333; margin: 4px 0; overflow: hidden; white-space: nowrap; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; padding: 2px 0; }
    td.k { width: 42%; font-weight: bold; }
    td.v { width: 58%; text-align: right; word-break: break-word; }
    .total { font-size: 13px; font-weight: bold; margin-top: 6px; text-align: center; }
    .pie { font-size: 9px; text-align: center; margin-top: 8px; color: #333; }
    .firma { margin-top: 14px; font-size: 10px; }
    .firma .linea-firma { border-top: 1px solid #000; margin: 28px 8px 4px; }
    .firma p { margin: 2px 0; text-align: center; }
    .nota-legal { font-size: 9px; margin-top: 8px; text-align: center; color: #444; }
    .qr { text-align: center; margin: 8px 0; }
    .qr img { width: 100px; height: 100px; }
    .no-print { margin-top: 12px; text-align: center; }
    ${estilosMarcaAguaAnulado()}
    @media print {
      .no-print { display: none !important; }
      body { width: ${w}px; }
    }
  `;
}

/** CSS compartido para marca de agua diagonal «ANULADO» en comprobantes impresos. */
function estilosMarcaAguaAnulado() {
  return `
    body.doc-anulado { position: relative; }
    .anulado-banner {
      background: #fee2e2;
      border: 2px solid #dc2626;
      color: #991b1b;
      padding: 7px 10px;
      margin: 6px 0 8px;
      text-align: center;
      font-weight: 700;
      font-size: 10px;
      line-height: 1.35;
      border-radius: 4px;
      position: relative;
      z-index: 60;
    }
    .marca-agua-anulado {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 55;
    }
    .marca-agua-anulado span {
      transform: rotate(-32deg);
      font-size: 64px;
      font-weight: 900;
      color: rgba(220, 38, 38, 0.16);
      letter-spacing: 0.12em;
      border: 5px solid rgba(220, 38, 38, 0.2);
      padding: 10px 28px;
      text-transform: uppercase;
      font-family: "Segoe UI", system-ui, sans-serif;
      white-space: nowrap;
    }
    .marca-agua-anulado.compact span {
      font-size: 42px;
      padding: 6px 16px;
      border-width: 3px;
    }
    @media print {
      .marca-agua-anulado { position: fixed; }
    }
  `;
}

const { esComprobanteAnulado } = require('../utils/comprobanteEstado');

/** Metadatos de anulación para banner en recibo/HTML. */
function metaAnulacionComprobante(doc) {
  if (!esComprobanteAnulado(doc)) return null;
  const valorRaw = doc.valorAnulado ?? doc.valorOriginal;
  const valorOriginal =
    valorRaw != null && Number(valorRaw) > 0 ? fmtMoney(Number(valorRaw)) : null;
  const fecha = doc.anuladoEn ? fmtFecha(doc.anuladoEn) : null;
  const por = (doc.anuladoPor || '').trim() || null;
  let autorizo = null;
  if (doc.autorizadoPor) {
    autorizo = doc.nombreAutoriza
      ? `${doc.nombreAutoriza} (${doc.autorizadoPor})`
      : doc.autorizadoPor;
  }
  return { valorOriginal, fecha, por, autorizo };
}

/**
 * Banner + marca de agua «ANULADO» para comprobantes (ingreso, egreso, certificado).
 * Devuelve `{ bodyClass, html }` para insertar en `<body>`.
 */
function bloqueComprobanteAnulado(doc, { compact = false } = {}) {
  const meta = metaAnulacionComprobante(doc);
  if (!meta) return { bodyClass: '', html: '' };
  const partes = ['COMPROBANTE ANULADO — Sin validez contable'];
  if (meta.valorOriginal) partes.push(`Valor original: ${meta.valorOriginal}`);
  if (meta.fecha) partes.push(`Anulado: ${meta.fecha}`);
  if (meta.por) partes.push(`Por: ${meta.por}`);
  if (meta.autorizo) partes.push(`Autorizó: ${meta.autorizo}`);
  const banner = `<div class="anulado-banner">${esc(partes.join(' · '))}</div>`;
  const watermark = `<div class="marca-agua-anulado${compact ? ' compact' : ''}" aria-hidden="true"><span>ANULADO</span></div>`;
  return { bodyClass: ' doc-anulado', html: banner + watermark };
}

/** Filas extra de tabla cuando el comprobante está anulado. */
function filasAnulacionComprobante(doc) {
  const meta = metaAnulacionComprobante(doc);
  if (!meta) return [];
  const filas = [['Estado', 'ANULADO']];
  if (meta.valorOriginal) filas.push(['Valor original', meta.valorOriginal]);
  if (meta.fecha) filas.push(['Fecha anulación', meta.fecha]);
  if (meta.por) filas.push(['Anulado por', meta.por]);
  if (meta.autorizo) filas.push(['Autorizó', meta.autorizo]);
  return filas;
}

module.exports = {
  esc,
  fmtMoney,
  fmtFecha,
  lineaHtml,
  nombreSedeVisible,
  filasConSede,
  bloqueEmpresaHtml,
  estilosRecibo,
  estilosMarcaAguaAnulado,
  bloqueComprobanteAnulado,
  filasAnulacionComprobante,
  metaAnulacionComprobante,
};
