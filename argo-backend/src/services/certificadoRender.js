const QRCode = require('qrcode');
const { clasificarPrograma } = require('./clasificacionCertificado');
const { numDocToString } = require('../utils/numDoc');
const { resolverLayout, resolverQr, CAMPOS_IDS } = require('./certificadoLayout');
const { fsToPrintSizes } = require('../utils/certificadoTipografia');
const { fmtFechaSolo: fmtFecha } = require('../utils/timezoneColombia');
const { cssFontFamily, googleFontsHeadHtml } = require('../constants/certificadoFuentes');
const { bloqueComprobanteAnulado, estilosMarcaAguaAnulado } = require('./reciboHtmlShared');

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fechaIso(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function payloadQrCertificado(certificado, alumno, encabezado, nombres) {
  return {
    _id: String(certificado._id),
    numDoc: numDocToString(alumno?.numDoc ?? certificado.numDoc),
    fechaEmision: fechaIso(certificado.fechaEmision || certificado.createdAt),
    fechaVencimiento: fechaIso(certificado.fechaVencimiento),
    estado: (certificado.estado || 'vigente').trim(),
    nombres: nombres || nombreCompleto(alumno),
    encabezado: encabezado || '',
  };
}

function nombreCompleto(a) {
  if (!a) return '';
  return [a.nombre1, a.nombre2, a.apellido1, a.apellido2].filter(Boolean).join(' ').trim();
}

function encabezadoCurso(prog, certificado) {
  const guardado = (certificado?.encabezado || '').trim();
  if (guardado) return guardado;
  return (prog?.nomCert || prog?.descripcion || prog?.nombreProg || '').trim();
}

function resolvePublicOrigin(publicOrigin) {
  const env = (process.env.PUBLIC_URL || '').trim();
  if (env) return env.replace(/\/$/, '');
  if (publicOrigin) return String(publicOrigin).replace(/\/$/, '');
  return 'http://localhost:3000';
}

function uploadsBase(publicOrigin) {
  return `${resolvePublicOrigin(publicOrigin)}/uploads`;
}

function urlUpload(rel, publicOrigin) {
  if (!rel) return '';
  const s = String(rel).trim();
  if (/^https?:\/\//i.test(s)) return s;
  const p = s.replace(/^\/+/, '');
  const base = resolvePublicOrigin(publicOrigin).replace(/\/$/, '');
  if (p.startsWith('uploads/')) return `${base}/${p}`;
  return `${base}/uploads/${p}`;
}


const CAMPOS_MULTILINEA = new Set(['nombre', 'curso']);

function declFontSize(pos, orientacion) {
  if (!pos?.fs) return [];
  const sizes = fsToPrintSizes(pos.fs, orientacion);
  if (!sizes) return [`font-size:${pos.fs} !important`];
  return [
    `font-size:${sizes.mm} !important`,
    `font-size:${sizes.cqh} !important`,
  ];
}

function reglasTipografia(L, orientacion) {
  const rules = [];
  for (const id of CAMPOS_IDS) {
    const pos = L[id];
    if (!pos || pos.visible === false) continue;
    const decl = [...declFontSize(pos, orientacion)];
    if (pos.fw) decl.push(`font-weight:${pos.fw} !important`);
    if (pos.fontFamily) decl.push(`font-family:${cssFontFamily(pos.fontFamily)} !important`);
    if (pos.ls) decl.push(`letter-spacing:${pos.ls}`);
    if (pos.color) decl.push(`color:${pos.color} !important`);
    const sel = id === 'certId' ? '.cert-id.dato' : `.dato.${id}`;
    if (decl.length) rules.push(`${sel}{${decl.join(';')}}`);
  }
  return rules.join('\n    ');
}

function tieneAnclaPct(v) {
  return v != null && String(v).trim() !== '';
}

/** Posicionamiento alineado con el editor (left/right + text-align, sin ignorar left por align). */
function blockStyle(pos, colorDefault, orientacion, multiline = false) {
  if (!pos || pos.visible === false) return '';
  const color = pos.color || colorDefault;
  const align = pos.align || 'center';
  const anclaLeft = tieneAnclaPct(pos.left);
  const anclaRight = !anclaLeft && tieneAnclaPct(pos.right);
  const centrado = !anclaLeft && !anclaRight && align !== 'left' && align !== 'right';
  const parts = [
    'position:absolute',
    'z-index:2',
    `color:${color}`,
  ];

  if (pos.bottom) {
    parts.push(`bottom:${pos.bottom}`, 'top:auto');
  } else if (pos.top) {
    parts.push(`top:${pos.top}`);
  }

  if (centrado) {
    parts.push('left:50%', 'transform:translateX(-50%)', `width:${pos.w || '82%'}`, 'text-align:center');
  } else if (anclaLeft) {
    parts.push(`left:${pos.left}`, 'right:auto', 'transform:none', `width:${pos.w || '40%'}`, `text-align:${align}`);
  } else if (anclaRight) {
    parts.push(`right:${pos.right}`, 'left:auto', 'transform:none', `width:${pos.w || '40%'}`, `text-align:${align}`);
  } else if (align === 'left') {
    parts.push(`left:${pos.left || '8%'}`, 'right:auto', 'transform:none', `width:${pos.w || '40%'}`, 'text-align:left');
  } else if (align === 'right') {
    parts.push(`right:${pos.right || '8%'}`, 'left:auto', 'transform:none', `width:${pos.w || '40%'}`, 'text-align:right');
  } else {
    parts.push(`left:${pos.left || '34%'}`, 'transform:none', `width:${pos.w || '40%'}`, `text-align:${align}`);
  }

  if (pos.fs) {
    const sizes = fsToPrintSizes(pos.fs, orientacion);
    if (sizes) {
      parts.push(`font-size:${sizes.mm}`, `font-size:${sizes.cqh}`);
    } else {
      parts.push(`font-size:${pos.fs}`);
    }
  }
  if (pos.fw) parts.push(`font-weight:${pos.fw}`);
  if (pos.ls) parts.push(`letter-spacing:${pos.ls}`);
  if (pos.fontFamily) parts.push(`font-family:${cssFontFamily(pos.fontFamily)}`);

  if (multiline) {
    parts.push(
      'white-space:normal',
      'word-wrap:break-word',
      'overflow-wrap:break-word',
      'word-break:break-word',
      'line-height:1.2',
      'overflow:visible',
    );
  } else {
    parts.push('white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis');
  }

  return parts.join(';');
}

function campoDesdeClase(className) {
  const m = String(className || '').match(/\bdato\s+(\w+)/);
  return m ? m[1] : '';
}

function datoHtml(pos, value, className, colorDefault, orientacion) {
  const v = String(value ?? '').trim();
  if (!v || !pos || pos.visible === false) return '';
  const campo = campoDesdeClase(className);
  const multiline = CAMPOS_MULTILINEA.has(campo);
  const st = blockStyle(pos, colorDefault, orientacion, multiline);
  if (!st) return '';
  return `<div class="${className}" style="${st}">${esc(v)}</div>`;
}

function certIdHtml(pos, codigo, colorDefault, orientacion) {
  const v = String(codigo ?? '').trim();
  if (!v || !pos || pos.visible === false) return '';
  const st = blockStyle(pos, colorDefault, orientacion);
  if (!st) return '';
  return `<div class="cert-id dato" style="${st}">${esc(v)}</div>`;
}

async function generarHtmlCertificado(data, options = {}) {
  const publicOrigin = options.publicOrigin;
  const { config, plantilla, certificado, alumno, programa } = data;
  const horizontal = plantilla?.orientacion === 'horizontal';
  const orientacion = horizontal ? 'horizontal' : 'vertical';
  const tipo =
    data.tipoFormatoCert ||
    certificado?.tipoFormatoCert ||
    data.tipoCertificado ||
    certificado?.tipoCertificado ||
    clasificarPrograma(programa);
  const L = resolverLayout(config, tipo, orientacion);
  const oriKey = orientacion;
  const fondo = urlUpload(plantilla?.urlFondo, publicOrigin);
  const color = L.color;

  const nombre = nombreCompleto(alumno);
  const numDoc = numDocToString(alumno?.numDoc);
  const tipoDoc = String(data.tipoDocCod || '').trim().toUpperCase();
  const curso = encabezadoCurso(programa, certificado);
  const horasCertStr = String(certificado?.horasCert || '').trim();
  const horasProg = programa?.horas != null ? Number(programa.horas) : null;
  const horasTxt =
    horasCertStr ||
    (horasProg != null && !isNaN(horasProg) ? String(horasProg) : '');
  const fechaEm = fmtFecha(certificado.fechaEmision || certificado.createdAt);
  const fechaVe = fmtFecha(certificado.fechaVencimiento);
  const numActa = (certificado.numActa || '').trim();
  const numFolio = (certificado.numFolio || '').trim();
  const numRunt = (certificado.numRunt || '').trim();
  const observaciones = (certificado.observaciones || '').trim();
  const codigo = (certificado.codigoCert || String(certificado._id)).trim();
  const ciudadTxt = (config?.ciudad || '').trim();
  const expedidaTxt = String(alumno?.expedida || '').trim();

  const valores = {
    nombre,
    tipoDoc,
    doc: numDoc,
    expedida: expedidaTxt,
    curso,
    ciudad: ciudadTxt,
    horas: horasTxt,
    fecha: fechaEm,
    vence: fechaVe,
    acta: numActa,
    folio: numFolio,
    runt: numRunt,
    obs: observaciones,
    certId: codigo,
  };

  const qrPayload = JSON.stringify(
    payloadQrCertificado(certificado, alumno, curso, nombre),
  );
  const mostrarQr = config?.mostrarQr !== false;
  const qrEstilo = resolverQr(config, tipo, orientacion);
  let qrDataUrl = '';
  if (mostrarQr) {
    try {
      qrDataUrl = await QRCode.toDataURL(qrPayload, {
        width: qrEstilo.rasterPx,
        margin: 0,
        errorCorrectionLevel: 'M',
      });
    } catch {
      qrDataUrl = '';
    }
  }

  const fondoImg = fondo ? `<img class="bg-fondo" src="${esc(fondo)}" alt="" />` : '';

  const datosHtml = CAMPOS_IDS.filter((id) => id !== 'certId')
    .map((id) => datoHtml(L[id], valores[id], `dato ${id}`, color, oriKey))
    .join('\n');

  const fontBase = cssFontFamily(L.nombre?.fontFamily);
  const tipografiaCss = reglasTipografia(L, oriKey);
  const googleFonts = googleFontsHeadHtml();
  const anulado = bloqueComprobanteAnulado(certificado);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Certificado ${esc(codigo)}</title>
  ${googleFonts}
  <style>
    @page { size: ${L.pageW} ${L.pageH}; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${L.pageW};
      height: ${L.pageH};
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      position: relative;
      width: ${L.pageW};
      height: ${L.pageH};
      overflow: hidden;
      background: #fff;
      container-type: size;
    }
    .bg-fondo {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: fill;
      object-position: center;
      z-index: 1;
      pointer-events: none;
    }
    .content {
      position: absolute;
      inset: 0;
      z-index: 2;
      font-family: ${fontBase};
      container-type: size;
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
    }
    ${tipografiaCss}
    .dato {
      line-height: 1.25;
      text-transform: uppercase;
    }
    .dato.nombre, .dato.curso {
      text-transform: uppercase;
      white-space: normal;
      word-wrap: break-word;
      overflow-wrap: break-word;
      word-break: break-word;
      line-height: 1.2;
      overflow: visible;
    }
    .dato.tipoDoc, .dato.doc, .dato.expedida, .dato.fecha, .dato.vence, .dato.ciudad, .dato.obs { text-transform: none; }
    .cert-id { font-family: Consolas, monospace; line-height: 1.2; }
    .qr-wrap img { display: block; width: 100%; height: 100%; object-fit: contain; }
    .no-print {
      position: fixed;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99;
    }
    ${estilosMarcaAguaAnulado()}
    body.doc-anulado .anulado-banner {
      position: absolute;
      top: 8mm;
      left: 8mm;
      right: 8mm;
      z-index: 20;
      font-size: 9px;
    }
    body.doc-anulado .marca-agua-anulado span {
      font-size: 88px;
    }
    @media print {
      .no-print { display: none !important; }
      .sheet { page-break-after: avoid; }
      html, body {
        width: ${L.pageW} !important;
        height: ${L.pageH} !important;
        -webkit-text-size-adjust: none !important;
        text-size-adjust: none !important;
      }
    }
  </style>
</head>
<body class="${anulado.bodyClass.trim()}">
  ${anulado.html}
  <div class="sheet">
    ${fondoImg}
    <div class="content">
      ${datosHtml}
      ${certIdHtml(L.certId, codigo, color, oriKey)}
      ${
        qrDataUrl
          ? `<div class="qr-wrap" style="${qrEstilo.css}"><img src="${qrDataUrl}" alt="QR verificación"/></div>`
          : ''
      }
    </div>
  </div>
  <div class="no-print">
    <p style="font:14px/1.4 sans-serif;color:#333;margin-bottom:8px;text-align:center">
      En el diálogo de impresión use escala <strong>100%</strong> (sin «Ajustar a página»).
    </p>
    <button type="button" onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>
</body>
</html>`;
}

module.exports = { generarHtmlCertificado, uploadsBase };
