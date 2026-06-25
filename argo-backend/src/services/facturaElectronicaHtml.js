const FacturaElectronica = require('../models/FacturaElectronica');
const NotaCredito = require('../models/NotaCredito');
const { obtenerConfigFacturacionInterno } = require('./configFacturacion');
const { obtenerConfigRecibo } = require('./configRecibo');
const { fmtFechaSolo } = require('../utils/timezoneColombia');
const { esc, fmtMoney, fmtFecha } = require('./reciboHtmlShared');
const { ESTADO_ANULADA } = require('../constants/facturacionElectronica');
const { bloqueComprobanteAnulado, estilosMarcaAguaAnulado } = require('./reciboHtmlShared');
const {
  buildTextoQrFactura,
  buildTextoQrNotaCredito,
  resolverCufeFactura,
  resolverCudeNota,
  generarQrDataUrl,
} = require('./facturaQrDian');

function num(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
  return Number(v) || 0;
}

function fmtFechaDoc(d) {
  if (!d) return '—';
  return fmtFechaSolo(d) || '—';
}

async function emisorDesdeConfig(idSede) {
  const [fe, rec] = await Promise.all([
    obtenerConfigFacturacionInterno(),
    obtenerConfigRecibo(idSede || null).catch(() => null),
  ]);
  const nitRaw = String(fe.emisorNit || '').trim();
  const nitRec = String(rec?.nit || '').trim();
  const nitSinDv = nitRaw || nitRec.replace(/-\d$/, '').replace(/\D/g, '');
  const dv = fe.emisorDv || '';
  const nitDisplay = dv ? `${nitSinDv}-${dv}` : nitSinDv || nitRec;
  return {
    razonSocial: fe.emisorRazonSocial || rec?.nombreEmpresa || 'ARGO — Centro de Formación',
    nit: nitDisplay,
    nitSinDv,
    direccion: rec?.direccion || '',
    ciudad: rec?.ciudad || '',
    telefono: rec?.telefono || '',
    email: rec?.email || '',
    regimen: fe.emisorRegimen || '',
    urlLogo: rec?.urlLogoDataUrl || null,
  };
}

function labelCondicion(c) {
  if (c === 'excluido') return 'Excluido';
  if (c === 'exento') return 'Exento';
  return 'Gravado';
}

function labelFormaPago(code) {
  return String(code) === '1' ? 'Contado' : 'Crédito';
}

function bloqueEmisor(em) {
  const logoHtml = em.urlLogo
    ? `<img class="emisor-logo" src="${esc(em.urlLogo)}" alt="${esc(em.razonSocial || 'Logo')}" />`
    : '';
  const lineas = [
    logoHtml,
    em.razonSocial ? `<div class="emisor-nombre">${esc(em.razonSocial)}</div>` : '',
    em.nit ? `<div>NIT: ${esc(em.nit)}</div>` : '',
    em.direccion ? `<div>${esc(em.direccion)}</div>` : '',
    em.ciudad ? `<div>${esc(em.ciudad)}</div>` : '',
    em.telefono ? `<div>Tel: ${esc(em.telefono)}</div>` : '',
    em.email ? `<div>${esc(em.email)}</div>` : '',
    em.regimen ? `<div class="regimen">${esc(em.regimen)}</div>` : '',
  ].filter(Boolean);
  return lineas.join('\n') || '<div class="emisor-nombre">ARGO</div>';
}

function bloqueAdquirente(adq = {}) {
  const nombre = adq.razonSocial || adq.nombres || adq.nombre || '—';
  const id = adq.identificacion || '—';
  const dv = adq.dv ? `-${adq.dv}` : '';
  return `
    <div class="bloque">
      <div class="bloque-titulo">Adquirente</div>
      <div><strong>${esc(nombre)}</strong></div>
      <div>Identificación: ${esc(id)}${esc(dv)}</div>
      ${adq.direccion ? `<div>${esc(adq.direccion)}</div>` : ''}
      ${adq.correo ? `<div>${esc(adq.correo)}</div>` : ''}
      ${adq.telefono ? `<div>Tel: ${esc(adq.telefono)}</div>` : ''}
    </div>`;
}

function filasItems(items = []) {
  if (!items.length) {
    return '<tr><td colspan="6" class="center muted">Sin ítems</td></tr>';
  }
  return items
    .map(
      (it) => `<tr>
        <td>${esc(it.descripcion || 'Servicio')}</td>
        <td class="c">${labelCondicion(it.condicionIva)}</td>
        <td class="r">${num(it.porcentajeIva) || 0}%</td>
        <td class="r">${fmtMoney(num(it.base))}</td>
        <td class="r">${fmtMoney(num(it.valorIva))}</td>
        <td class="r">${fmtMoney(num(it.total))}</td>
      </tr>`,
    )
    .join('');
}

function estilosDocumento() {
  return `
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      font-size: 12px;
      line-height: 1.45;
      color: #111;
      background: #fff;
      margin: 0;
      padding: 16px;
      max-width: 210mm;
    }
    .doc-head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 2px solid #059669;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .emisor-logo { max-height: 70px; max-width: 200px; object-fit: contain; display: block; margin-bottom: 10px; }
    .emisor-nombre { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
    .regimen { font-size: 11px; color: #444; margin-top: 4px; }
    .doc-tipo { text-align: right; }
    .doc-tipo h1 {
      margin: 0;
      font-size: 18px;
      color: #047857;
      letter-spacing: 0.03em;
    }
    .doc-num { font-size: 15px; font-weight: 700; margin-top: 4px; }
    .doc-meta { font-size: 11px; color: #555; margin-top: 6px; }
    .dev-banner {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      color: #92400e;
      padding: 8px 12px;
      border-radius: 8px;
      margin-bottom: 12px;
      font-size: 11px;
    }
    .anulada-banner {
      background: #fee2e2;
      border: 1px solid #ef4444;
      color: #991b1b;
      padding: 8px 12px;
      border-radius: 8px;
      margin-bottom: 12px;
      font-size: 11px;
    }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
    .bloque { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; }
    .bloque-titulo { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin-bottom: 6px; }
    table.items { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11px; }
    table.items th {
      background: #ecfdf5;
      border-bottom: 2px solid #a7f3d0;
      padding: 8px 6px;
      text-align: left;
    }
    table.items td { border-bottom: 1px solid #e5e7eb; padding: 7px 6px; vertical-align: top; }
    .r { text-align: right; }
    .c { text-align: center; }
    .totales { margin-left: auto; width: min(280px, 100%); margin-top: 8px; }
    .totales table { width: 100%; }
    .totales td { padding: 4px 0; }
    .totales .k { color: #374151; }
    .totales .total-row td { font-weight: 700; font-size: 14px; border-top: 2px solid #059669; padding-top: 8px; }
    .rete { color: #b91c1c; font-size: 11px; }
    .cufe {
      flex: 1;
      font-size: 10px;
      word-break: break-all;
      color: #374151;
    }
    .qr-pie {
      display: flex;
      justify-content: flex-end;
      align-items: flex-start;
      gap: 14px;
      margin-top: 14px;
      border-top: 1px dashed #d1d5db;
      padding-top: 12px;
    }
    .qr-box {
      flex-shrink: 0;
      text-align: center;
    }
    .qr-box img {
      width: 2.5cm;
      height: 2.5cm;
      min-width: 76px;
      min-height: 76px;
      display: block;
    }
    .qr-lbl {
      font-size: 9px;
      color: #6b7280;
      margin-top: 4px;
    }
    .pie {
      margin-top: 18px;
      font-size: 10px;
      color: #6b7280;
      text-align: center;
    }
    .no-print { margin-top: 20px; text-align: center; }
    .no-print button {
      background: #059669;
      color: #fff;
      border: none;
      padding: 10px 22px;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      margin: 0 6px;
    }
    .no-print button.sec { background: #374151; }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
    }
    ${estilosMarcaAguaAnulado()}
  `;
}

function botonesImpresion(titulo) {
  return `
    <div class="no-print">
      <button type="button" onclick="window.print()">Imprimir / Guardar PDF</button>
      <button type="button" class="sec" onclick="window.close()">Cerrar</button>
    </div>`;
}

async function bloqueQrCufe(doc, em, tipo = 'factura') {
  const esNota = tipo === 'nota';
  const cufeOCude = esNota
    ? resolverCudeNota(doc, em.nitSinDv)
    : resolverCufeFactura(doc, em.nitSinDv);
  const texto = esNota
    ? buildTextoQrNotaCredito({
        numero: doc.numeroNota || doc.referenceCode,
        fechaEmision: doc.emitidaAt || doc.createdAt,
        nitEmisor: em.nitSinDv,
        docAdquirente: doc.adquirente?.identificacion,
        valFac: num(doc.base),
        valIva: num(doc.valorIva),
        valTolFac: num(doc.valorTotal),
        cude: cufeOCude,
      })
    : buildTextoQrFactura({
        numero: doc.numeroFactura || doc.referenceCode,
        fechaEmision: doc.emitidaAt || doc.createdAt,
        nitEmisor: em.nitSinDv,
        docAdquirente: doc.adquirente?.identificacion,
        valFac: num(doc.base),
        valIva: num(doc.valorIva),
        valTolFac: num(doc.valorTotal),
        cufe: cufeOCude,
      });
  const qrDataUrl = await generarQrDataUrl(texto);
  const etiqueta = esNota ? 'CUDE' : 'CUFE';
  const qrImg = qrDataUrl
    ? `<div class="qr-box">
        <img src="${qrDataUrl}" alt="Código QR DIAN" width="96" height="96"/>
        <div class="qr-lbl">Verificar en DIAN</div>
      </div>`
    : '';
  return `
    <div class="qr-pie">
      <div class="cufe"><strong>${etiqueta}:</strong> ${esc(cufeOCude)}</div>
      ${qrImg}
    </div>`;
}

function wrapHtml(titulo, bodyInner, { anuladoDoc = null } = {}) {
  const anulado = anuladoDoc ? bloqueComprobanteAnulado(anuladoDoc) : { bodyClass: '', html: '' };
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>${esc(titulo)}</title>
  <style>${estilosDocumento()}</style>
</head>
<body class="${anulado.bodyClass.trim()}">
${anulado.html}
${bodyInner}
${botonesImpresion(titulo)}
</body>
</html>`;
}

async function generarHtmlFactura(id) {
  const doc = await FacturaElectronica.findById(id).lean();
  if (!doc) return null;

  const em = await emisorDesdeConfig(doc.idSede);
  const items = doc.items || [];
  const numero = doc.numeroFactura || doc.referenceCode || '—';
  const titulo = `Factura ${numero}`;

  const banners = [];
  if (doc.modoDesarrollo) {
    banners.push(
      '<div class="dev-banner"><strong>Modo desarrollo</strong> — Documento de referencia local. No tiene validez ante la DIAN hasta integrar Factus y resolución de numeración.</div>',
    );
  }
  if (doc.estado === ESTADO_ANULADA) {
    banners.push('<div class="anulada-banner"><strong>Factura anulada</strong> — Existe nota crédito asociada.</div>');
  }

  const reteHtml =
    doc.reteIvaAplica && num(doc.reteIvaValor) > 0
      ? `<tr class="rete"><td class="k">ReteIVA (${num(doc.reteIvaPorcentaje)}%) — informativa</td><td class="r">-${fmtMoney(num(doc.reteIvaValor))}</td></tr>`
      : '';

  const qrHtml = await bloqueQrCufe(doc, em, 'factura');

  const body = `
    ${banners.join('\n')}
    <div class="doc-head">
      <div class="emisor">${bloqueEmisor(em)}</div>
      <div class="doc-tipo">
        <h1>FACTURA ELECTRÓNICA DE VENTA</h1>
        <div class="doc-num">No. ${esc(numero)}</div>
        <div class="doc-meta">Fecha: ${fmtFechaDoc(doc.emitidaAt || doc.createdAt)}</div>
        <div class="doc-meta">Forma de pago: ${labelFormaPago(doc.formaPago)}</div>
        ${doc.referenceCode ? `<div class="doc-meta">Ref: ${esc(doc.referenceCode)}</div>` : ''}
      </div>
    </div>
    <div class="grid-2">
      ${bloqueAdquirente(doc.adquirente)}
      <div class="bloque">
        <div class="bloque-titulo">Alumno origen</div>
        <div>Documento: ${esc(doc.numDoc || '—')}</div>
        ${doc.idSede ? `<div>Sede: ${esc(doc.idSede)}</div>` : ''}
        <div>Estado: ${esc(doc.estado || '—')}</div>
      </div>
    </div>
    <table class="items">
      <thead>
        <tr>
          <th>Descripción</th>
          <th class="c">IVA</th>
          <th class="r">%</th>
          <th class="r">Base</th>
          <th class="r">Valor IVA</th>
          <th class="r">Total</th>
        </tr>
      </thead>
      <tbody>${filasItems(items)}</tbody>
    </table>
    <div class="totales">
      <table>
        <tr><td class="k">Base gravable</td><td class="r">${fmtMoney(num(doc.base))}</td></tr>
        <tr><td class="k">IVA</td><td class="r">${fmtMoney(num(doc.valorIva))}</td></tr>
        ${reteHtml}
        <tr class="total-row"><td class="k">Total</td><td class="r">${fmtMoney(num(doc.valorTotal))}</td></tr>
      </table>
    </div>
    ${qrHtml}
    <div class="pie">
      Representación impresa de factura electrónica · ${esc(em.razonSocial)}<br/>
      Generado por ARGO · ${fmtFecha(new Date())}
    </div>`;

  return wrapHtml(titulo, body, {
    anuladoDoc: doc.estado === ESTADO_ANULADA ? doc : null,
  });
}

async function generarHtmlNotaCredito(id) {
  const doc = await NotaCredito.findById(id).lean();
  if (!doc) return null;

  const em = await emisorDesdeConfig(doc.idSede);
  const items = doc.items || [];
  const numero = doc.numeroNota || doc.referenceCode || '—';
  const titulo = `Nota crédito ${numero}`;

  const banners = [];
  if (doc.modoDesarrollo) {
    banners.push(
      '<div class="dev-banner"><strong>Modo desarrollo</strong> — Nota crédito de referencia local sin envío DIAN.</div>',
    );
  }

  const qrHtml = await bloqueQrCufe(doc, em, 'nota');

  const body = `
    ${banners.join('\n')}
    <div class="doc-head">
      <div class="emisor">${bloqueEmisor(em)}</div>
      <div class="doc-tipo">
        <h1>NOTA CRÉDITO ELECTRÓNICA</h1>
        <div class="doc-num">No. ${esc(numero)}</div>
        <div class="doc-meta">Fecha: ${fmtFechaDoc(doc.emitidaAt || doc.createdAt)}</div>
        <div class="doc-meta">Tipo: ${doc.tipo === 'parcial' ? 'Devolución parcial' : 'Anulación total'}</div>
        <div class="doc-meta">Concepto DIAN: ${esc(doc.conceptoCorreccion || '—')}</div>
      </div>
    </div>
    <div class="grid-2">
      ${bloqueAdquirente(doc.adquirente)}
      <div class="bloque">
        <div class="bloque-titulo">Factura referenciada</div>
        <div>No. ${esc(doc.facturaNumero || '—')}</div>
        ${doc.facturaReferenceCode ? `<div>Ref: ${esc(doc.facturaReferenceCode)}</div>` : ''}
        ${doc.facturaCufe ? `<div style="font-size:10px;word-break:break-all">CUFE: ${esc(doc.facturaCufe)}</div>` : ''}
        ${doc.motivo ? `<div style="margin-top:6px"><em>${esc(doc.motivo)}</em></div>` : ''}
      </div>
    </div>
    <table class="items">
      <thead>
        <tr>
          <th>Descripción</th>
          <th class="c">IVA</th>
          <th class="r">%</th>
          <th class="r">Base</th>
          <th class="r">Valor IVA</th>
          <th class="r">Total</th>
        </tr>
      </thead>
      <tbody>${filasItems(items)}</tbody>
    </table>
    <div class="totales">
      <table>
        <tr><td class="k">Base</td><td class="r">${fmtMoney(num(doc.base))}</td></tr>
        <tr><td class="k">IVA</td><td class="r">${fmtMoney(num(doc.valorIva))}</td></tr>
        <tr class="total-row"><td class="k">Total a revertir</td><td class="r">${fmtMoney(num(doc.valorTotal))}</td></tr>
      </table>
    </div>
    ${qrHtml}
    <div class="pie">
      Representación impresa de nota crédito electrónica · ${esc(em.razonSocial)}<br/>
      Generado por ARGO · ${fmtFecha(new Date())}
    </div>`;

  return wrapHtml(titulo, body);
}

module.exports = {
  generarHtmlFactura,
  generarHtmlNotaCredito,
};
