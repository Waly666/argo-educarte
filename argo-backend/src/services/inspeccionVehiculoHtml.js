const { obtenerConfigRecibo } = require('./configRecibo');
const QRCode = require('qrcode');
const { normSi } = require('../utils/inspeccionClaseVehiculo');

function payloadQrInspeccion(inspeccion, vehiculo, empresa, marcaLinea, quienRecibe) {
  return {
    tipo: 'inspeccion_vehiculo',
    consecutivo: inspeccion.consecutivo || null,
    fecha: inspeccion.fecha || null,
    hora: inspeccion.hora || null,
    placa: inspeccion.placa || null,
    combustible: inspeccion.combustible || null,
    clase: inspeccion.claseVehiculo || vehiculo?.claseVehiculo || null,
    marcaLinea: marcaLinea || null,
    quienEntrega: inspeccion.quienEntrega || null,
    quienRecibe: quienRecibe || null,
    empresa: empresa.nombreEmpresa || null,
    nit: empresa.nit || null,
    inspeccionId: inspeccion._id ? String(inspeccion._id) : null,
  };
}

async function generarQrInspeccion(payload) {
  try {
    return await QRCode.toDataURL(JSON.stringify(payload), {
      width: 96,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  } catch {
    return null;
  }
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtSi(val) {
  if (val === true) return '✓';
  if (val === false) return '✗';
  return '—';
}

function filaChecklist(item, incluirObs = true) {
  const obsCol = incluirObs
    ? `<td class="obs">${esc(item.observacion || '')}</td>`
    : '';
  return `<tr>
    <td class="desc">${esc(item.nombre)}</td>
    <td class="c">${fmtSi(item.si === true)}</td>
    <td class="c">${fmtSi(item.si === false)}</td>
    ${obsCol}
  </tr>`;
}

function bloqueSeccion(titulo, items, conObs = false) {
  const filas = (items || []).map((i) => filaChecklist(i, conObs)).join('');
  if (!filas) return '';
  const obsHead = conObs ? '<th>Observaciones</th>' : '';
  return `
  <section class="bloque">
    <h2>${esc(titulo)}</h2>
    <table class="check">
      <thead>
        <tr>
          <th>Descripción</th>
          <th class="c">Sí</th>
          <th class="c">No</th>
          ${obsHead}
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
  </section>`;
}

function filaDocumento(item) {
  const estado =
    item.si === true ? 'Al día' : String(item.observacion || '').trim() || (item.si === false ? 'No cumple' : '—');
  return `<tr>
    <td class="desc">${esc(item.nombre)}</td>
    <td class="c">${fmtSi(item.si === true)}</td>
    <td class="c">${fmtSi(item.si === false)}</td>
    <td class="obs">${esc(estado)}</td>
  </tr>`;
}

function bloqueDocumentos(titulo, items) {
  const filas = (items || []).map((i) => filaDocumento(i)).join('');
  if (!filas) return '';
  return `
  <section class="bloque">
    <h2>${esc(titulo)}</h2>
    <table class="check">
      <thead>
        <tr>
          <th>Descripción</th>
          <th class="c">Sí</th>
          <th class="c">No</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
  </section>`;
}

async function obtenerEmpresa(idSede) {
  return obtenerConfigRecibo(idSede || null);
}

async function renderInspeccionVehiculoHtml(inspeccion, vehiculo) {
  const idSede = vehiculo?.idSede || inspeccion?.idSede || null;
  const empresa = await obtenerEmpresa(idSede);
  const aptoVal = normSi(inspeccion.aptoLaborar);
  const apto = aptoVal === true ? 'Sí' : aptoVal === false ? 'No' : 'Sin marcar';

  const marcaLinea = [vehiculo?.nombreMarca, vehiculo?.nombreLinea, vehiculo?.modelo]
    .filter(Boolean)
    .join(' ');
  const logoSrc = String(empresa.urlLogoDataUrl || empresa.urlLogo || '').trim();
  const logoHtml = logoSrc
    ? `<img class="logo" src="${esc(logoSrc)}" alt="Logo" />`
    : '';
  const nitLine = empresa.nit ? `NIT ${esc(empresa.nit)}` : '';
  const contactoLine = [empresa.telefono, empresa.direccion].filter(Boolean).map((v) => esc(v)).join(' · ');
  const ciudadLine = [empresa.ciudad, empresa.departamento].filter(Boolean).map((v) => esc(v)).join(', ');
  const sedeLine = empresa.nombreSede ? esc(empresa.nombreSede) : '';

  const metaCampo = (label, valor, extraClass = '') => {
    const cls = extraClass ? ` meta-v ${extraClass}` : ' meta-v';
    return `
    <div class="meta-item">
      <span class="meta-k">${esc(label)}</span>
      <span class="${cls.trim()}">${esc(valor || '—')}</span>
    </div>`;
  };

  const esPrimera = String(inspeccion.quienEntrega || '').toLowerCase().includes('primera revisión');
  const quienRecibe = inspeccion.quienRecibe || inspeccion.nombreInstructor || '';
  const qrPayload = payloadQrInspeccion(inspeccion, vehiculo, empresa, marcaLinea, quienRecibe);
  const qrDataUrl = await generarQrInspeccion(qrPayload);
  const qrHtml = qrDataUrl
    ? `<div class="qr-box" title="Datos de verificación de la inspección">
        <img src="${qrDataUrl}" alt="QR inspección" width="96" height="96" />
        <span class="qr-lbl">Verificación</span>
      </div>`
    : '';

  const docsVehi = bloqueDocumentos(
    'Documentos de cumplimiento obligatorio — Vehículo',
    inspeccion.documentosVehiculo,
  );
  const docsInst = bloqueDocumentos(
    'Documentos de cumplimiento obligatorio — Instructor / conductor',
    inspeccion.documentosInstructor,
  );

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Inspección vehículo ${esc(inspeccion.placa)} — ${esc(inspeccion.fecha)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 16px; }
    h1 { text-align: center; font-size: 15px; margin: 0; letter-spacing: 0.4px; text-transform: uppercase; }
    h2 { font-size: 12px; margin: 14px 0 6px; border-bottom: 1px solid #333; padding-bottom: 3px; }
    .report-header {
      border: 1.5px solid #222;
      border-radius: 4px;
      margin-bottom: 14px;
      overflow: hidden;
    }
    .header-top {
      display: flex;
      align-items: stretch;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px 10px;
      border-bottom: 1px solid #bbb;
      background: #fafafa;
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1;
    }
    .logo {
      max-height: 52px;
      max-width: 120px;
      object-fit: contain;
    }
    .brand-text strong {
      display: block;
      font-size: 14px;
      line-height: 1.25;
      margin-bottom: 2px;
    }
    .brand-text .sede {
      display: block;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .brand-text .nit {
      font-size: 10px;
      color: #444;
    }
    .brand-text .extra {
      font-size: 9px;
      color: #666;
      margin-top: 2px;
    }
    .header-title {
      text-align: center;
      padding: 10px 14px 8px;
      border-bottom: 1px solid #bbb;
      background: #fff;
    }
    .header-title p {
      margin: 4px 0 0;
      font-size: 9px;
      color: #555;
      letter-spacing: 0.3px;
    }
    .consecutivo-box {
      flex-shrink: 0;
      align-self: center;
      text-align: center;
      border: 1.5px solid #222;
      border-radius: 4px;
      padding: 8px 12px;
      background: #fff;
      min-width: 118px;
    }
    .consecutivo-box .lbl {
      display: block;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #555;
      margin-bottom: 3px;
    }
    .consecutivo-box .num {
      display: block;
      font-size: 14px;
      font-weight: 700;
      font-family: ui-monospace, 'Courier New', monospace;
      letter-spacing: 0.5px;
    }
    .header-side {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .qr-box {
      text-align: center;
      border: 1px solid #bbb;
      border-radius: 4px;
      padding: 4px 4px 2px;
      background: #fff;
    }
    .qr-box img {
      display: block;
      width: 96px;
      height: 96px;
    }
    .qr-lbl {
      display: block;
      font-size: 7px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #666;
      margin-top: 2px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
    .meta-item {
      display: grid;
      grid-template-columns: 118px 1fr;
      border-top: 1px solid #ccc;
      border-right: 1px solid #ccc;
      min-height: 28px;
    }
    .meta-item:nth-child(2n) { border-right: none; }
    .meta-k {
      padding: 5px 8px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.25px;
      background: #f3f3f3;
      border-right: 1px solid #ccc;
      display: flex;
      align-items: center;
    }
    .meta-v {
      padding: 5px 8px;
      font-size: 11px;
      display: flex;
      align-items: center;
      word-break: break-word;
    }
    .meta-v.primera {
      font-style: italic;
      color: #444;
    }
    table.check { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    table.check th, table.check td { border: 1px solid #999; padding: 4px 6px; vertical-align: top; }
    table.check th { background: #f0f0f0; font-size: 10px; }
    table.check .c { width: 36px; text-align: center; }
    table.check .obs { width: 22%; font-size: 10px; }
    .bloque { page-break-inside: avoid; }
    .legal { margin-top: 16px; font-size: 10px; text-align: center; font-weight: bold; line-height: 1.4; }
    .apto { margin: 12px 0; font-size: 12px; font-weight: bold; }
    .firmas { display: flex; gap: 24px; margin-top: 28px; }
    .firma { flex: 1; text-align: center; }
    .firma .linea { border-top: 1px solid #000; margin: 40px 12px 6px; }
    .no-print { margin: 16px 0; text-align: center; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <header class="report-header">
    <div class="header-top">
      <div class="header-brand">
        ${logoHtml}
        <div class="brand-text">
          <strong>${esc(empresa.nombreEmpresa || 'ARGO — Centro de Formación')}</strong>
          ${sedeLine ? `<span class="sede">${sedeLine}</span>` : ''}
          ${nitLine ? `<span class="nit">${nitLine}</span>` : ''}
          ${contactoLine ? `<span class="extra">${contactoLine}</span>` : ''}
          ${ciudadLine ? `<span class="extra">${ciudadLine}</span>` : ''}
        </div>
      </div>
      <div class="header-side">
        ${qrHtml}
        <div class="consecutivo-box">
          <span class="lbl">Consecutivo</span>
          <span class="num">${esc(inspeccion.consecutivo || '—')}</span>
        </div>
      </div>
    </div>
    <div class="header-title">
      <h1>Inspección de vehículos de enseñanza</h1>
      <p>Formato preoperacional diario · Placa ${esc(inspeccion.placa)}</p>
    </div>
    <div class="meta-grid">
      ${metaCampo('Fecha', inspeccion.fecha)}
      ${metaCampo('Hora', inspeccion.hora)}
      ${metaCampo('Placa', inspeccion.placa)}
      ${metaCampo('Combustible', inspeccion.combustible)}
      ${metaCampo('Clase', inspeccion.claseVehiculo || vehiculo?.claseVehiculo)}
      ${metaCampo('Marca / línea', marcaLinea)}
      ${metaCampo('Quien entrega', inspeccion.quienEntrega, esPrimera ? 'primera' : '')}
      ${metaCampo('Quien recibe (instructor)', quienRecibe)}
      ${metaCampo('Inspector', inspeccion.inspector || '—')}
      ${metaCampo('Documento inspector', inspeccion.documentoInspector || '—')}
      ${metaCampo('Apto para laborar', apto)}
    </div>
  </header>

  ${docsVehi}
  ${docsInst}
  ${(inspeccion.grupos || [])
    .map((g) => bloqueSeccion(g.titulo, g.lineas, true))
    .join('')}

  <p class="legal">
    LA RESPONSABILIDAD DE QUE ESTA OBSERVACIÓN Y QUE LOS ANTERIORES ITEMS SE CUMPLAN,
    ES DE LA PERSONA QUE ADELANTA LA INSPECCIÓN.
  </p>

  <p class="apto">¿Apto para laborar? <strong>${esc(apto)}</strong></p>

  ${
    inspeccion.observacionesGenerales
      ? `<p><strong>Observaciones generales:</strong> ${esc(inspeccion.observacionesGenerales)}</p>`
      : ''
  }

  <div class="firmas">
    <div class="firma">
      <div class="linea"></div>
      <div>Nombre y firma del inspector</div>
      <div>${esc(inspeccion.inspector || '—')}</div>
      <div class="doc-firma">${esc(inspeccion.documentoInspector || '')}</div>
    </div>
    <div class="firma">
      <div class="linea"></div>
      <div>Nombre y firma de quien recibe el vehículo</div>
      <div>${esc(quienRecibe)}</div>
    </div>
    <div class="firma">
      <div class="linea"></div>
      <div>Nombre y firma de quien entrega el vehículo</div>
      <div>${esc(inspeccion.quienEntrega || '—')}</div>
    </div>
  </div>

  <div class="no-print">
    <button type="button" onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>
</body>
</html>`;
}

module.exports = { renderInspeccionVehiculoHtml };
