const {
  esc,
  fmtMoney,
  fmtFecha,
  lineaHtml,
  filasConSede,
  bloqueEmpresaHtml,
  estilosRecibo,
  estilosMarcaAguaAnulado,
  bloqueComprobanteAnulado,
  filasAnulacionComprobante,
} = require('./reciboHtmlShared');
const { FORMATOS, MEDIA_CARTA_ANCHO_MM, MEDIA_CARTA_ALTO_MM, formatoIngreso, formatoEgreso } =
  require('./comprobanteFormato');

function estilosValidadoraIngreso(mm, w) {
  return `${estilosRecibo(mm, w)}
    .detalle-titulo { font-weight: bold; font-size: 11px; margin: 4px 0 2px; }
    table.detalle td.k { width: 62%; font-weight: normal; }
    table.detalle td.v { width: 38%; font-weight: bold; }
    table.detalle .saldo-pend { font-weight: normal; font-size: 9px; color: #555; }`;
}

function estilosMediaCarta() {
  return `
    @page { size: ${MEDIA_CARTA_ANCHO_MM}mm ${MEDIA_CARTA_ALTO_MM}mm; margin: 7mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      font-size: 10px;
      line-height: 1.4;
      margin: 0;
      padding: 0;
      color: #111;
      background: #fff;
      max-width: ${MEDIA_CARTA_ANCHO_MM}mm;
    }
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      padding-bottom: 8px;
      border-bottom: 2px solid #1e3a5f;
      margin-bottom: 10px;
    }
    .doc-emisor { flex: 1; min-width: 0; display: flex; flex-direction: row; align-items: center; gap: 10px; }
    .doc-emisor-logo { flex-shrink: 0; }
    .doc-logo { max-height: 64px; max-width: 160px; object-fit: contain; display: block; }
    .doc-emisor-texto { flex: 1; min-width: 0; }
    .doc-razon { font-size: 13px; font-weight: 700; color: #1e3a5f; margin-bottom: 2px; }
    .doc-sede { font-size: 11px; font-weight: 600; margin-bottom: 4px; }
    .doc-emisor div, .doc-emisor-texto div { font-size: 9px; color: #444; margin: 1px 0; }
    .doc-badge {
      text-align: right;
      min-width: 120px;
    }
    .doc-badge .tipo {
      background: #1e3a5f;
      color: #fff;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.4px;
      padding: 6px 10px;
      border-radius: 4px;
      margin-bottom: 6px;
    }
    .doc-badge .num { font-size: 11px; font-weight: 700; }
    .doc-badge .fecha { font-size: 9px; color: #555; margin-top: 2px; }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 14px;
      margin-bottom: 10px;
    }
    .meta-box {
      border: 1px solid #d1d5db;
      border-radius: 4px;
      padding: 8px;
      background: #f9fafb;
    }
    .meta-box h3 {
      margin: 0 0 6px;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      font-weight: 700;
    }
    .meta-box p { margin: 2px 0; font-size: 10px; }
    .meta-box .destacado { font-weight: 700; font-size: 11px; margin-bottom: 4px; color: #1e3a5f; }
    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
      margin: 3px 0;
      font-size: 9px;
    }
    .meta-row .lbl { color: #6b7280; font-weight: 600; flex-shrink: 0; }
    .meta-row .val { text-align: right; font-weight: 500; color: #111; word-break: break-word; }
    table.datos {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 9px;
    }
    table.datos td {
      padding: 4px 6px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
    }
    table.datos td.k { width: 38%; font-weight: 600; color: #374151; }
    table.datos td.v { width: 62%; text-align: right; word-break: break-word; }
    table.items {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 9px;
    }
    table.items th {
      background: #1e3a5f;
      color: #fff;
      padding: 5px 6px;
      text-align: left;
      font-weight: 600;
    }
    table.items th:last-child { text-align: right; }
    table.items td {
      padding: 5px 6px;
      border-bottom: 1px solid #e5e7eb;
    }
    table.items td.monto { text-align: right; font-weight: 600; white-space: nowrap; }
    table.items .saldo-pend { font-weight: normal; font-size: 8px; color: #6b7280; }
    .total-box {
      border: 2px solid #1e3a5f;
      border-radius: 4px;
      padding: 10px;
      text-align: center;
      margin: 10px 0;
    }
    .total-box .label { font-size: 9px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
    .total-box .valor { font-size: 16px; font-weight: 800; color: #1e3a5f; margin-top: 2px; }
    .nota-legal {
      font-size: 8px;
      color: #555;
      text-align: center;
      margin: 8px 0;
      font-style: italic;
    }
    .firma {
      margin-top: 16px;
      padding-top: 8px;
      border-top: 1px dashed #9ca3af;
      font-size: 9px;
    }
    .firma .linea-firma { border-top: 1px solid #000; margin: 24px 20px 6px; }
    .firma p { margin: 2px 0; text-align: center; }
    .pie {
      font-size: 8px;
      text-align: center;
      margin-top: 10px;
      color: #555;
      border-top: 1px solid #e5e7eb;
      padding-top: 8px;
    }
    .qr { text-align: center; margin: 8px 0; }
    .qr img { width: 72px; height: 72px; }
    .no-print { margin-top: 12px; text-align: center; }
    @media print {
      .no-print { display: none !important; }
      body { max-width: ${MEDIA_CARTA_ANCHO_MM}mm; }
    }
    ${estilosMarcaAguaAnulado()}
  `;
}

function bloqueEmpresaMediaCarta(config) {
  const v = (x) => esc((x || '').toString().trim());
  const ciudadLine = [config.ciudad, config.departamento].filter((x) => String(x || '').trim()).join(', ');
  const logoSrc = config.urlLogoDataUrl || null;

  const textoLineas = [];
  if (v(config.nombreEmpresa)) textoLineas.push(`<div class="doc-razon">${v(config.nombreEmpresa)}</div>`);
  if (v(config.nombreSede)) textoLineas.push(`<div class="doc-sede">${v(config.nombreSede)}</div>`);
  if (v(config.nit)) textoLineas.push(`<div>NIT ${v(config.nit)}</div>`);
  if (v(config.direccion)) textoLineas.push(`<div>${v(config.direccion)}</div>`);
  if (ciudadLine) textoLineas.push(`<div>${esc(ciudadLine)}</div>`);
  if (v(config.telefono)) textoLineas.push(`<div>Tel: ${v(config.telefono)}</div>`);
  if (v(config.email)) textoLineas.push(`<div>${v(config.email)}</div>`);
  if (!textoLineas.length) textoLineas.push(`<div class="doc-razon">ARGO</div>`);

  if (logoSrc) {
    return `<div class="doc-emisor-logo"><img class="doc-logo" src="${esc(logoSrc)}" alt="${v(config.nombreEmpresa) || 'Logo'}" /></div><div class="doc-emisor-texto">${textoLineas.join('\n')}</div>`;
  }
  return textoLineas.join('\n');
}

function badgeComprobante(titulo, numeroRecibo, fecha) {
  return `
  <div class="doc-badge">
    <div class="tipo">${esc(titulo)}</div>
    <div class="num">N° ${esc(numeroRecibo)}</div>
    <div class="fecha">${esc(fmtFecha(fecha))}</div>
  </div>`;
}

function botonImprimir() {
  return `<div class="no-print"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>`;
}

function metaRowHtml(label, value) {
  const v = String(value ?? '').trim();
  if (!v || v === '—') return '';
  return `<div class="meta-row"><span class="lbl">${esc(label)}</span><span class="val">${esc(v)}</span></div>`;
}

/** Filas adicionales en media carta (sin duplicar lo del bloque superior). */
function buildFilasIngresoMediaCartaExtra(data) {
  const { ingreso, liquidacion, esIngresoCaja } = data;
  const detalleItems = Array.isArray(data.detalle) && data.detalle.length ? data.detalle : null;
  const esMulti = !!detalleItems;

  return [
    ...(esIngresoCaja
      ? [
          ['Tipo ingreso', ingreso.tipoIngresoDescr || 'Ingreso de caja'],
          ['Concepto', liquidacion?.descripcion || ingreso.concepto || '—'],
        ]
      : esMulti
        ? []
        : [['Concepto', liquidacion?.descripcion || 'Pago']]),
    ...(liquidacion && !esIngresoCaja && !esMulti
      ? [
          ['Total ítem', fmtMoney(liquidacion.valor)],
          ['Abonado', fmtMoney(liquidacion.abonado)],
          ['Saldo', fmtMoney(liquidacion.saldo)],
        ]
      : []),
    ...(ingreso.observaciones ? [['Obs.', ingreso.observaciones]] : []),
  ].filter(([, v]) => String(v ?? '').trim() && String(v).trim() !== '—');
}

function tipoAbonoTexto(ingreso) {
  if (ingreso.tipoAbonoDescr) return ingreso.tipoAbonoDescr;
  if (ingreso.tipoAbono === 'total') return 'Total';
  if (ingreso.tipoAbono === 'abono') return 'Abono';
  return null;
}

function buildFilasIngreso(data) {
  const { config, ingreso, alumno, liquidacion, esIngresoCaja } = data;
  const detalleItems = Array.isArray(data.detalle) && data.detalle.length ? data.detalle : null;
  const esMulti = !!detalleItems;

  return filasConSede(
    [
      ...(esIngresoCaja
        ? [
            ['Tipo ingreso', ingreso.tipoIngresoDescr || 'Ingreso de caja'],
            ['Recibido de', alumno.nombreCompleto],
            ['Documento', alumno.numDoc],
            ...(alumno.tipoPersona
              ? [['Persona', alumno.tipoPersona === 'juridica' ? 'Jurídica' : 'Natural']]
              : []),
            ['Concepto', liquidacion?.descripcion || ingreso.concepto || '—'],
          ]
        : [
            ['Documento', alumno.numDoc],
            ['Alumno', alumno.nombreCompleto],
            ...(esMulti ? [] : [['Concepto', liquidacion?.descripcion || 'Pago']]),
          ]),
      ...(ingreso.tipoAbonoDescr || ingreso.tipoAbono
        ? [['Pago', ingreso.tipoAbonoDescr || (ingreso.tipoAbono === 'total' ? 'Total' : 'Abono')]]
        : []),
      ['Forma pago', ingreso.tipoPagoDescr],
      ...(ingreso.cuentaBancariaDescr ? [['Cuenta empresa', ingreso.cuentaBancariaDescr]] : []),
      ...(ingreso.bancoDescr ? [['Banco', ingreso.bancoDescr]] : []),
      ...(ingreso.numComprobante ? [['Ref / Comprob.', ingreso.numComprobante]] : []),
      ...(ingreso.urlSoporte ? [['Soporte digital', 'Adjunto en sistema']] : []),
      ...(liquidacion && !esIngresoCaja && !esMulti
        ? [
            ['Total ítem', fmtMoney(liquidacion.valor)],
            ['Abonado', fmtMoney(liquidacion.abonado)],
            ['Saldo', fmtMoney(liquidacion.saldo)],
          ]
        : []),
      ...(ingreso.observaciones ? [['Obs.', ingreso.observaciones]] : []),
    ],
    config,
  );
}

function buildFilasEgresoMediaCartaExtra(data) {
  const { egreso } = data;
  return [
    ...(egreso.placa ? [['Placa vehículo', egreso.placa]] : []),
    ...(egreso.vehiculoMarca || egreso.vehiculoLinea
      ? [['Vehículo', `${egreso.vehiculoMarca || ''} ${egreso.vehiculoLinea || ''}`.trim()]]
      : []),
    ...(egreso.fechaTransferencia ? [['Fecha transfer.', egreso.fechaTransferencia]] : []),
    ...(egreso.cuentaDestino ? [['Cuenta destino', egreso.cuentaDestino]] : []),
    ...(egreso.bancoDestinoDescr ? [['Banco destino', egreso.bancoDestinoDescr]] : []),
    ...(egreso.urlSoporte ? [['Soporte digital', 'Adjunto en sistema']] : []),
    ...(egreso.anticipoNomina
      ? [['Nómina', `Deducción (${egreso.anticipoNomina}) período ${egreso.idPeriodo || '—'}`]]
      : []),
    ...(egreso.nombreAutoriza || egreso.autorizadoPor
      ? [
          [
            'Autorizó',
            egreso.nombreAutoriza
              ? `${egreso.nombreAutoriza} (${egreso.autorizadoPor})`
              : egreso.autorizadoPor,
          ],
        ]
      : []),
    ...(egreso.autorizadoEn ? [['Fecha autorización', fmtFecha(egreso.autorizadoEn)]] : []),
    ...(egreso.userAddReg ? [['Registró', egreso.userAddReg]] : []),
  ].filter(([, v]) => String(v ?? '').trim() && String(v).trim() !== '—');
}

function buildFilasEgreso(data) {
  const { config, egreso } = data;
  return filasConSede(
    [
      ['Pagado a', egreso.pagueA || '—'],
      ...(egreso.numeroDocumento ? [['Documento', egreso.numeroDocumento]] : []),
      ...(egreso.empleadoCargo ? [['Cargo', egreso.empleadoCargo]] : []),
      ...(egreso.tipoEgresoDescr ? [['Tipo egreso', egreso.tipoEgresoDescr]] : []),
      ...(egreso.placa ? [['Placa vehículo', egreso.placa]] : []),
      ...(egreso.vehiculoMarca || egreso.vehiculoLinea
        ? [['Vehículo', `${egreso.vehiculoMarca || ''} ${egreso.vehiculoLinea || ''}`.trim()]]
        : []),
      ['Concepto', egreso.concepto],
      ...(egreso.formaPago ? [['Forma pago', egreso.formaPago]] : []),
      ...(egreso.cuentaOrigenDescr ? [['Cuenta origen', egreso.cuentaOrigenDescr]] : []),
      ...(egreso.numTransferencia ? [['Ref / Voucher', egreso.numTransferencia]] : []),
      ...(egreso.fechaTransferencia ? [['Fecha transfer.', egreso.fechaTransferencia]] : []),
      ...(egreso.cuentaDestino ? [['Cuenta destino', egreso.cuentaDestino]] : []),
      ...(egreso.bancoDestinoDescr ? [['Banco destino', egreso.bancoDestinoDescr]] : []),
      ...(egreso.urlSoporte ? [['Soporte digital', 'Adjunto en sistema']] : []),
      ...(egreso.anticipoNomina
        ? [['Nómina', `Deducción (${egreso.anticipoNomina}) período ${egreso.idPeriodo || '—'}`]]
        : []),
      ...(egreso.nombreAutoriza || egreso.autorizadoPor
        ? [
            [
              'Autorizó',
              egreso.nombreAutoriza
                ? `${egreso.nombreAutoriza} (${egreso.autorizadoPor})`
                : egreso.autorizadoPor,
            ],
          ]
        : []),
      ...(egreso.autorizadoEn ? [['Fecha autorización', fmtFecha(egreso.autorizadoEn)]] : []),
      ...(egreso.userAddReg ? [['Registró', egreso.userAddReg]] : []),
    ],
    config,
  );
}

function bloqueTituloValidadora(config, tituloKey, fallback) {
  const titulo = esc((config[tituloKey] || fallback).trim());
  const slogan = (config.slogan1 || '').toString().trim();
  return `
  <div class="center titulo">${titulo}</div>
  ${slogan ? `<div class="center slogan">${esc(slogan)}</div>` : ''}`;
}

function htmlIngresoValidadora(data) {
  const { config, ingreso, numeroRecibo, qrDataUrl } = data;
  const mm = config.anchoReciboMm || 80;
  const w = Math.round(mm * 3.78);
  const detalleItems = Array.isArray(data.detalle) && data.detalle.length ? data.detalle : null;
  const esMulti = !!detalleItems;
  const filas = buildFilasIngreso(data);
  const anulado = bloqueComprobanteAnulado(ingreso, { compact: true });

  const filasConMeta = [
    ['Comprobante N°', numeroRecibo],
    ['Fecha', fmtFecha(ingreso.fecha || ingreso.createdAt)],
    ...filas,
    ...filasAnulacionComprobante(ingreso),
    ['Valor pagado', fmtMoney(ingreso.valor)],
  ];

  const bodyRows = filasConMeta
    .map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`)
    .join('');

  const detalleHtml = esMulti
    ? `${lineaHtml(32)}
  <div class="detalle-titulo">SERVICIOS PAGADOS</div>
  <table class="detalle">${detalleItems
    .map(
      (d) =>
        `<tr><td class="k">${esc(d.descripcion)}${
          d.saldo != null && d.saldo > 0.0001
            ? ` <span class="saldo-pend">(saldo ${esc(fmtMoney(d.saldo))})</span>`
            : ''
        }</td><td class="v">${esc(fmtMoney(d.valor))}</td></tr>`,
    )
    .join('')}</table>`
    : '';

  const titulo = (config.mensajeEncabezado || 'COMPROBANTE DE INGRESO').trim();

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Recibo ${esc(numeroRecibo)}</title>
  <style>${estilosValidadoraIngreso(mm, w)}</style>
</head>
<body class="${anulado.bodyClass.trim()}">
  ${anulado.html}
  ${bloqueEmpresaHtml(config)}
  ${lineaHtml(32)}
  ${bloqueTituloValidadora(config, 'mensajeEncabezado', 'COMPROBANTE DE INGRESO')}
  ${lineaHtml(32)}
  <table>${bodyRows}</table>
  ${detalleHtml}
  ${lineaHtml(32)}
  <div class="total">RECIBIDO: ${esc(fmtMoney(ingreso.valor))}</div>
  ${qrDataUrl ? `<div class="qr"><img src="${qrDataUrl}" alt="QR"/></div>` : ''}
  <div class="pie">${esc(config.mensajePie)}</div>
  ${botonImprimir()}
</body>
</html>`;
}

function htmlIngresoMediaCarta(data) {
  const { config, ingreso, alumno, liquidacion, numeroRecibo, qrDataUrl, esIngresoCaja } = data;
  const detalleItems = Array.isArray(data.detalle) && data.detalle.length ? data.detalle : null;
  const esMulti = !!detalleItems;
  const titulo = (config.mensajeEncabezado || 'COMPROBANTE DE INGRESO').trim();
  const fecha = ingreso.fecha || ingreso.createdAt;
  const filasExtra = [
    ...buildFilasIngresoMediaCartaExtra(data),
    ...filasAnulacionComprobante(ingreso),
  ];
  const anulado = bloqueComprobanteAnulado(ingreso);

  const bodyRows = filasExtra
    .map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`)
    .join('');

  const itemsHtml = esMulti
    ? `<table class="items">
    <thead><tr><th>Descripción</th><th>Valor</th></tr></thead>
    <tbody>${detalleItems
      .map(
        (d) =>
          `<tr><td>${esc(d.descripcion)}${
            d.saldo != null && d.saldo > 0.0001
              ? `<br><span class="saldo-pend">Saldo pendiente: ${esc(fmtMoney(d.saldo))}</span>`
              : ''
          }</td><td class="monto">${esc(fmtMoney(d.valor))}</td></tr>`,
      )
      .join('')}</tbody>
  </table>`
    : liquidacion
      ? `<table class="items">
    <thead><tr><th>Concepto</th><th>Valor</th></tr></thead>
    <tbody><tr><td>${esc(liquidacion.descripcion || 'Pago')}</td><td class="monto">${esc(fmtMoney(ingreso.valor))}</td></tr></tbody>
  </table>`
      : '';

  const clienteTitulo = esIngresoCaja ? 'Recibido de' : 'Cliente / alumno';
  const clienteNombre = alumno.nombreCompleto || '—';
  const clienteDoc = alumno.numDoc || '—';
  const sedeNombre = config.nombreSede || '';
  const tipoPago = tipoAbonoTexto(ingreso);

  const metaCliente = esIngresoCaja
    ? `
      <p class="destacado">${esc(clienteNombre)}</p>
      ${metaRowHtml('Documento', clienteDoc)}
      ${metaRowHtml('Sede', sedeNombre)}
      ${alumno.tipoPersona ? metaRowHtml('Persona', alumno.tipoPersona === 'juridica' ? 'Jurídica' : 'Natural') : ''}
    `
    : `
      <p class="destacado">${esc(clienteNombre)}</p>
      ${metaRowHtml('Documento', clienteDoc)}
      ${metaRowHtml('Sede', sedeNombre)}
      ${alumno.celular ? metaRowHtml('Teléfono', alumno.celular) : ''}
    `;

  const metaPago = `
      ${metaRowHtml('Pago', tipoPago)}
      ${metaRowHtml('Forma pago', ingreso.tipoPagoDescr)}
      ${ingreso.cuentaBancariaDescr ? metaRowHtml('Cuenta empresa', ingreso.cuentaBancariaDescr) : ''}
      ${ingreso.bancoDescr ? metaRowHtml('Banco', ingreso.bancoDescr) : ''}
      ${ingreso.numComprobante ? metaRowHtml('Ref / Comprob.', ingreso.numComprobante) : ''}
      ${ingreso.urlSoporte ? metaRowHtml('Soporte digital', 'Adjunto en sistema') : ''}
    `;

  const tablaExtra = bodyRows ? `<table class="datos">${bodyRows}</table>` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Recibo ${esc(numeroRecibo)}</title>
  <style>${estilosMediaCarta()}</style>
</head>
<body class="${anulado.bodyClass.trim()}">
  ${anulado.html}
  <header class="doc-header">
    <div class="doc-emisor">${bloqueEmpresaMediaCarta(config)}</div>
    ${badgeComprobante(titulo, numeroRecibo, fecha)}
  </header>
  <div class="meta-grid">
    <div class="meta-box">
      <h3>${esc(clienteTitulo)}</h3>
      ${metaCliente}
    </div>
    <div class="meta-box">
      <h3>Datos del pago</h3>
      ${metaPago}
    </div>
  </div>
  ${itemsHtml}
  ${tablaExtra}
  <div class="total-box">
    <div class="label">Total recibido</div>
    <div class="valor">${esc(fmtMoney(ingreso.valor))}</div>
  </div>
  ${qrDataUrl ? `<div class="qr"><img src="${qrDataUrl}" alt="QR"/></div>` : ''}
  <div class="pie">${esc(config.mensajePie || '')}</div>
  ${botonImprimir()}
</body>
</html>`;
}

function htmlEgresoValidadora(data) {
  const { config, egreso, numeroRecibo, qrDataUrl } = data;
  const mm = config.anchoReciboMm || 80;
  const w = Math.round(mm * 3.78);
  const titulo = esc(config.mensajeEncabezadoEgreso || 'COMPROBANTE DE EGRESO');
  const slogan = (config.slogan1 || '').toString().trim();
  const anulado = bloqueComprobanteAnulado(egreso, { compact: true });

  const filas = [
    ['Comprobante N°', numeroRecibo],
    ['Fecha pago', fmtFecha(egreso.fechaEgreso)],
    ...buildFilasEgreso(data),
    ...filasAnulacionComprobante(egreso),
    ['Valor pagado', fmtMoney(egreso.valorEgreso)],
  ];

  const bodyRows = filas
    .map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`)
    .join('');

  const beneficiario = esc(egreso.pagueA || 'Beneficiario');
  const docBenef = esc(egreso.numeroDocumento || '________________');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Egreso ${esc(numeroRecibo)}</title>
  <style>${estilosRecibo(mm, w)}</style>
</head>
<body class="${anulado.bodyClass.trim()}">
  ${anulado.html}
  ${bloqueEmpresaHtml(config)}
  ${lineaHtml(32)}
  <div class="center titulo">${titulo}</div>
  ${slogan ? `<div class="center slogan">${esc(slogan)}</div>` : ''}
  ${lineaHtml(32)}
  <table>${bodyRows}</table>
  ${lineaHtml(32)}
  <div class="total">VALOR PAGADO: ${esc(fmtMoney(egreso.valorEgreso))}</div>
  <div class="nota-legal">
    Prueba de pago: factura, voucher bancario o firma del beneficiario en este recibo.
  </div>
  <div class="firma">
    <div class="linea-firma"></div>
    <p><strong>Recibí conforme el valor indicado</strong></p>
    <p>${beneficiario}</p>
    <p>CC / NIT: ${docBenef}</p>
    <p>Fecha: _________________________</p>
  </div>
  ${qrDataUrl ? `<div class="qr"><img src="${qrDataUrl}" alt="QR"/></div>` : ''}
  <div class="pie">${esc(config.mensajePieEgreso)}</div>
  ${botonImprimir()}
</body>
</html>`;
}

function htmlEgresoMediaCarta(data) {
  const { config, egreso, numeroRecibo, qrDataUrl } = data;
  const titulo = (config.mensajeEncabezadoEgreso || 'COMPROBANTE DE EGRESO').trim();
  const filasExtra = [
    ...buildFilasEgresoMediaCartaExtra(data),
    ...filasAnulacionComprobante(egreso),
  ];
  const anulado = bloqueComprobanteAnulado(egreso);
  const bodyRows = filasExtra
    .map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`)
    .join('');

  const beneficiario = egreso.pagueA || 'Beneficiario';
  const docBenef = egreso.numeroDocumento || '________________';
  const sedeNombre = config.nombreSede || '';

  const metaBeneficiario = `
      <p class="destacado">${esc(beneficiario)}</p>
      ${metaRowHtml('Documento', docBenef !== '________________' ? docBenef : null)}
      ${egreso.empleadoCargo ? metaRowHtml('Cargo', egreso.empleadoCargo) : ''}
      ${metaRowHtml('Sede', sedeNombre)}
    `;

  const metaPago = `
      ${metaRowHtml('Concepto', egreso.concepto)}
      ${egreso.tipoEgresoDescr ? metaRowHtml('Tipo egreso', egreso.tipoEgresoDescr) : ''}
      ${metaRowHtml('Forma pago', egreso.formaPago)}
      ${egreso.cuentaOrigenDescr ? metaRowHtml('Cuenta origen', egreso.cuentaOrigenDescr) : ''}
      ${egreso.numTransferencia ? metaRowHtml('Ref / Voucher', egreso.numTransferencia) : ''}
    `;

  const tablaExtra = bodyRows ? `<table class="datos">${bodyRows}</table>` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Egreso ${esc(numeroRecibo)}</title>
  <style>${estilosMediaCarta()}</style>
</head>
<body class="${anulado.bodyClass.trim()}">
  ${anulado.html}
  <header class="doc-header">
    <div class="doc-emisor">${bloqueEmpresaMediaCarta(config)}</div>
    ${badgeComprobante(titulo, numeroRecibo, egreso.fechaEgreso)}
  </header>
  <div class="meta-grid">
    <div class="meta-box">
      <h3>Beneficiario</h3>
      ${metaBeneficiario}
    </div>
    <div class="meta-box">
      <h3>Datos del pago</h3>
      ${metaPago}
    </div>
  </div>
  ${tablaExtra}
  <div class="total-box">
    <div class="label">Valor pagado</div>
    <div class="valor">${esc(fmtMoney(egreso.valorEgreso))}</div>
  </div>
  <div class="nota-legal">
    Prueba de pago: factura, voucher bancario o firma del beneficiario en este recibo.
  </div>
  <div class="firma">
    <div class="linea-firma"></div>
    <p><strong>Recibí conforme el valor indicado</strong></p>
    <p>${esc(beneficiario)}</p>
    <p>CC / NIT: ${esc(docBenef)}</p>
    <p>Fecha: _________________________</p>
  </div>
  ${qrDataUrl ? `<div class="qr"><img src="${qrDataUrl}" alt="QR"/></div>` : ''}
  <div class="pie">${esc(config.mensajePieEgreso || '')}</div>
  ${botonImprimir()}
</body>
</html>`;
}

function generarHtmlIngreso(data) {
  const fmt = formatoIngreso(data.config);
  if (fmt === FORMATOS.MEDIA_CARTA) return htmlIngresoMediaCarta(data);
  return htmlIngresoValidadora(data);
}

function generarHtmlEgreso(data) {
  const fmt = formatoEgreso(data.config);
  if (fmt === FORMATOS.MEDIA_CARTA) return htmlEgresoMediaCarta(data);
  return htmlEgresoValidadora(data);
}

module.exports = {
  generarHtmlIngreso,
  generarHtmlEgreso,
  htmlIngresoValidadora,
  htmlIngresoMediaCarta,
  htmlEgresoValidadora,
  htmlEgresoMediaCarta,
};
