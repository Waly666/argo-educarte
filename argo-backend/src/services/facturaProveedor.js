const {
  PROVEEDOR_STUB,
  PROVEEDOR_FACTUS,
  ESTADO_VALIDADA,
  ESTADO_PENDIENTE_ENVIO,
  ESTADO_RECHAZADA,
} = require('../constants/facturacionElectronica');
const { credencialesEfectivas, credencialesCompletas } = require('./configFacturacion');
const { generarUuidDev } = require('./facturaQrDian');

function erroresValidacionFactus(details) {
  return details?.data?.errors || details?.errors || null;
}

/**
 * Cliente Factus — integración real pendiente de credenciales/resolución DIAN.
 * Por ahora expone la interfaz y devuelve errores claros si se intenta usar sin config.
 */
async function obtenerTokenFactus() {
  const cfg = await credencialesEfectivas();
  if (!credencialesCompletas(cfg)) {
    const err = new Error('Credenciales Factus incompletas. Configure client_id, secret, usuario y contraseña.');
    err.status = 428;
    err.code = 'FACTUS_SIN_CREDENCIALES';
    throw err;
  }

  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    username: cfg.username,
    password: cfg.password,
  });

  const res = await fetch(`${cfg.baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: params,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || 'Error al autenticar con Factus');
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    err.code = 'FACTUS_AUTH_ERROR';
    err.details = data;
    throw err;
  }
  return data;
}

async function validarFacturaFactus(payload) {
  const cfg = await credencialesEfectivas();
  const tokenData = await obtenerTokenFactus();
  const token = tokenData.access_token;
  if (!token) {
    const err = new Error('Factus no devolvió access_token');
    err.status = 502;
    throw err;
  }

  const res = await fetch(`${cfg.baseUrl}/v2/bills/validate`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let msg = data?.message || 'Factus rechazó la factura';
    if (res.status === 409 && /pendiente/i.test(String(msg))) {
      msg = `${msg} Elimine las facturas no validadas en Factus (o use «Limpiar pendientes» en esta pantalla) e intente de nuevo.`;
    }
    const err = new Error(msg);
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    err.code = res.status === 409 ? 'FACTUS_PENDIENTE_DIAN' : 'FACTUS_EMISION_ERROR';
    err.details = data;
    throw err;
  }
  return data;
}

/** DELETE /v2/bills/destroy/reference/:reference_code — solo facturas no validadas. */
async function eliminarFacturaFactusPorReferencia(referenceCode, tokenIn = null, cfgIn = null) {
  const cfg = cfgIn || (await credencialesEfectivas());
  const token = tokenIn || (await obtenerTokenFactus()).access_token;
  if (!token) {
    const err = new Error('Factus no devolvió access_token');
    err.status = 502;
    throw err;
  }
  const ref = encodeURIComponent(String(referenceCode || '').trim());
  if (!ref) {
    const err = new Error('Código de referencia vacío');
    err.status = 400;
    throw err;
  }
  const res = await fetch(`${cfg.baseUrl}/v2/bills/destroy/reference/${ref}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || 'No se pudo eliminar la factura en Factus');
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    err.details = data;
    throw err;
  }
  return data;
}

function extraerListaFacturasFactus(raw) {
  if (Array.isArray(raw?.data?.data)) return raw.data.data;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

/** Lista facturas Factus (filter[status]=0 → pendientes de validar DIAN). */
async function listarFacturasFactus({ status = '0', page = 1, perPage = 50 } = {}) {
  const cfg = await credencialesEfectivas();
  const token = (await obtenerTokenFactus()).access_token;
  const q = new URLSearchParams({
    'filter[status]': String(status),
    'filter[per_page]': String(perPage),
    page: String(page),
  });
  const res = await fetch(`${cfg.baseUrl}/v2/bills?${q.toString()}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || 'No se pudo listar facturas en Factus');
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    err.details = data;
    throw err;
  }
  return {
    items: extraerListaFacturasFactus(data),
    meta: data?.data?.meta || data?.meta || null,
    raw: data,
  };
}

/**
 * Elimina facturas no validadas en Factus que bloquean nuevos envíos (HTTP 409).
 * En sandbox puede borrar todas las pendientes; en producción solo referencias ARGO-*.
 */
async function limpiarFacturasPendientesFactus(opts = {}) {
  const cfg = await credencialesEfectivas();
  if (cfg.proveedor !== PROVEEDOR_FACTUS) {
    return { eliminadas: 0, omitidas: 0, message: 'Proveedor no es Factus' };
  }
  const prefijos = opts.prefijos || ['ARGO-SB-TEST', 'ARGO-FE-'];
  const todasPendientes = opts.todasPendientes === true || cfg.ambiente === 'sandbox';
  const token = (await obtenerTokenFactus()).access_token;
  let eliminadas = 0;
  let omitidas = 0;
  const referencias = [];

  for (let page = 1; page <= 10; page += 1) {
    const { items, meta } = await listarFacturasFactus({ status: '0', page, perPage: 50 });
    if (!items.length) break;

    for (const bill of items) {
      const ref = String(bill.reference_code || bill.referenceCode || '').trim();
      if (!ref) {
        omitidas += 1;
        continue;
      }
      if (!todasPendientes && !prefijos.some((p) => ref.startsWith(p))) {
        omitidas += 1;
        continue;
      }
      try {
        await eliminarFacturaFactusPorReferencia(ref, token, cfg);
        eliminadas += 1;
        referencias.push(ref);
      } catch {
        omitidas += 1;
      }
    }

    const lastPage = meta?.last_page ?? meta?.lastPage;
    if (lastPage != null && page >= Number(lastPage)) break;
    if (items.length < 50) break;
  }

  return {
    eliminadas,
    omitidas,
    referencias,
    message:
      eliminadas > 0
        ? `Se eliminaron ${eliminadas} factura(s) pendiente(s) en Factus.`
        : 'No había facturas pendientes de ARGO para eliminar en Factus.',
  };
}

function extraerListaRangosFactus(raw) {
  if (Array.isArray(raw?.data?.data)) return raw.data.data;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw)) return raw;
  return [];
}

function normalizarRangosFactus(raw, opts = {}) {
  const soloFacturas = opts.soloFacturas === true;
  const lista = extraerListaRangosFactus(raw);
  return lista
    .map((r) => {
      const id = r.id ?? r.numbering_range_id ?? r.numberingRangeId;
      const prefix = String(r.prefix || r.prefijo || '').trim();
      const resolucion = String(r.resolution_number || r.resolutionNumber || r.resolucion || '').trim();
      const desde = r.from ?? r.desde ?? null;
      const hasta = r.to ?? r.hasta ?? null;
      const activo = r.is_active ?? r.isActive ?? r.activo;
      const documento = String(r.document_type?.name || r.documentType || r.document || '').trim();
      const esFactura =
        /factura/i.test(documento) &&
        !/nota|ajuste|soporte|nómina|nomina|débito|debito/i.test(documento);
      const partes = [];
      if (documento) partes.push(documento);
      if (prefix) partes.push(prefix);
      if (resolucion) partes.push(`Res. ${resolucion}`);
      if (desde != null && hasta != null) partes.push(`${desde}–${hasta}`);
      return {
        id: id != null ? Number(id) : null,
        prefix,
        resolutionNumber: resolucion,
        from: desde,
        to: hasta,
        current: r.current ?? null,
        isActive: activo !== false && r.is_expired !== true,
        esFacturaVenta: esFactura,
        documentType: documento || null,
        label: partes.length ? partes.join(' · ') : `Rango #${id}`,
        raw: r,
      };
    })
    .filter((r) => r.id != null && r.isActive)
    .filter((r) => (soloFacturas ? r.esFacturaVenta : true));
}

function rangoFacturaPreferido(rangos = []) {
  const lista = Array.isArray(rangos) ? rangos : [];
  return (
    lista.find((r) => r.esFacturaVenta) ||
    lista.find((r) => /factura/i.test(r.documentType || '')) ||
    lista[0] ||
    null
  );
}

async function listarRangosFactus() {
  const cfg = await credencialesEfectivas();
  const tokenData = await obtenerTokenFactus();
  const token = tokenData.access_token;
  const res = await fetch(`${cfg.baseUrl}/v2/numbering-ranges?filter[is_active]=1`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || 'No se pudieron listar rangos Factus');
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    err.details = data;
    throw err;
  }
  const todos = normalizarRangosFactus(data, { soloFacturas: false });
  const facturas = normalizarRangosFactus(data, { soloFacturas: true });
  const sugerido = rangoFacturaPreferido(facturas.length ? facturas : todos);
  return {
    ok: true,
    rangos: facturas.length ? facturas : todos,
    rangosTodos: todos,
    sugeridoId: sugerido?.id ?? null,
    sugeridoLabel: sugerido?.label ?? null,
    raw: data,
  };
}

/** Payload mínimo para probar emisión en sandbox (sin alumno/liquidación). */
function payloadPruebaSandbox(cfg) {
  const rangeId = cfg.numberingRangeId != null ? Number(cfg.numberingRangeId) : null;
  if (!rangeId) {
    const err = new Error('Seleccione un rango de numeración Factus antes de emitir la prueba.');
    err.status = 428;
    err.code = 'FACTUS_SIN_RANGO';
    throw err;
  }
  const ts = Date.now();
  return {
    reference_code: `ARGO-SB-TEST-${ts}`,
    document: '01',
    numbering_range_id: rangeId,
    operation_type: '10',
    send_email: cfg.sendEmail === true,
    observation: 'Prueba sandbox ARGO — documento de integración',
    payment_details: [
      {
        payment_form: '1',
        payment_method_code: '10',
        reference_code: `pago-test-${ts}`,
        amount: '11900.00',
      },
    ],
    cash_rounding_amount: '0.00',
    customer: {
      identification_document_code: '13',
      identification: '1234567890',
      names: 'Cliente Prueba ARGO',
      address: 'Calle prueba 1',
      email: 'prueba@argo.local',
      phone: '3000000000',
      legal_organization_code: '2',
      tribute_code: 'ZZ',
      municipality_code: '11001',
    },
    items: [
      {
        code_reference: 'ARGO-TEST-SERV',
        name: 'Servicio prueba facturación ARGO',
        quantity: '1.00',
        discount_rate: '0.00',
        price: '10000.00',
        unit_measure_code: '94',
        standard_code: '999',
        taxes: [{ code: '01', rate: '19.00' }],
      },
    ],
  };
}

async function emitirPruebaSandboxCore(opts = {}) {
  const cfg = await credencialesEfectivas();
  if (cfg.proveedor !== PROVEEDOR_FACTUS) {
    const err = new Error('Configure el proveedor Factus y active la integración para probar en sandbox.');
    err.status = 428;
    throw err;
  }
  if (!credencialesCompletas(cfg)) {
    const err = new Error('Credenciales Factus incompletas.');
    err.status = 428;
    err.code = 'FACTUS_SIN_CREDENCIALES';
    throw err;
  }
  const rangeOverride =
    opts.numberingRangeId != null && opts.numberingRangeId !== ''
      ? Number(opts.numberingRangeId) || null
      : null;
  const cfgEmision = rangeOverride ? { ...cfg, numberingRangeId: rangeOverride } : cfg;
  const payload = payloadPruebaSandbox(cfgEmision);
  const resp = await validarFacturaFactus(payload);
  const data = resp?.data || {};
  return {
    ok: true,
    message: resp?.message || 'Factura de prueba enviada a Factus.',
    referenceCode: payload.reference_code,
    numeroFactura: data.number || '',
    cufe: data.cufe || '',
    isValidated: !!data.is_validated,
    urlPdf: data.links?.public_url || data.links?.pdf || '',
    urlQr: data.links?.qr || '',
    errors: data.errors || null,
    respuesta: resp,
  };
}

async function emitirPruebaSandbox(opts = {}) {
  await limpiarFacturasPendientesFactus().catch(() => {});

  try {
    return await emitirPruebaSandboxCore(opts);
  } catch (e) {
    if (e.status === 409 || e.code === 'FACTUS_PENDIENTE_DIAN') {
      const limpio = await limpiarFacturasPendientesFactus({ todasPendientes: true });
      if (limpio.eliminadas > 0) {
        return await emitirPruebaSandboxCore(opts);
      }
    }
    throw e;
  }
}

/** Emisión en modo desarrollo: no llama DIAN; simula respuesta mínima. */
function emitirStub(payload, montos) {
  const ts = Date.now();
  const numero = `DEV-${ts}`;
  const cufe = generarUuidDev('FE', [payload.reference_code, numero, montos?.valorTotal]);
  return {
    proveedor: PROVEEDOR_STUB,
    modoDesarrollo: true,
    estado: ESTADO_VALIDADA,
    numeroFactura: numero,
    prefijo: 'DEV',
    cufe,
    validadaAt: new Date(),
    respuestaProveedor: {
      status: 'Created',
      message: 'Modo desarrollo: documento registrado localmente sin envío a DIAN.',
      data: {
        reference_code: payload.reference_code,
        number: numero,
        is_validated: false,
        cufe: null,
        totals: {
          total: String(montos.valorTotal.toFixed(2)),
        },
      },
    },
  };
}

/**
 * Punto único de emisión: stub o Factus según configuración.
 */
async function emitirFactura({ payload, montos, config }) {
  const cfg = config || (await credencialesEfectivas());
  const proveedor = cfg.proveedor || PROVEEDOR_STUB;

  if (proveedor === PROVEEDOR_STUB || !cfg.activo) {
    return emitirStub(payload, montos);
  }

  if (proveedor === PROVEEDOR_FACTUS) {
    try {
      const resp = await validarFacturaFactus(payload);
      const data = resp?.data || {};
      return {
        proveedor: PROVEEDOR_FACTUS,
        modoDesarrollo: false,
        estado: data.is_validated ? ESTADO_VALIDADA : ESTADO_PENDIENTE_ENVIO,
        numeroFactura: data.number || '',
        prefijo: data.numbering_range?.prefix || '',
        cufe: data.cufe || '',
        validadaAt: data.is_validated ? new Date() : null,
        urlPdf: data.links?.public_url || '',
        urlQr: data.links?.qr || '',
        respuestaProveedor: resp,
        erroresValidacion: data.errors || null,
      };
    } catch (e) {
      return {
        proveedor: PROVEEDOR_FACTUS,
        modoDesarrollo: false,
        estado: ESTADO_RECHAZADA,
        respuestaProveedor: e.details || null,
        erroresValidacion: erroresValidacionFactus(e.details) || { message: e.message },
        error: e.message,
      };
    }
  }

  const err = new Error(`Proveedor de facturación no soportado: ${proveedor}`);
  err.status = 400;
  throw err;
}

async function validarNotaCreditoFactus(payload) {
  const cfg = await credencialesEfectivas();
  const tokenData = await obtenerTokenFactus();
  const token = tokenData.access_token;
  if (!token) {
    const err = new Error('Factus no devolvió access_token');
    err.status = 502;
    throw err;
  }
  const res = await fetch(`${cfg.baseUrl}/v2/credit-notes/validate`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || 'Factus rechazó la nota crédito');
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    err.code = 'FACTUS_NC_ERROR';
    err.details = data;
    throw err;
  }
  return data;
}

/** Nota crédito en modo desarrollo. */
function emitirNotaCreditoStub(payload, montos) {
  const ts = Date.now();
  const numero = `NC-DEV-${ts}`;
  const cude = generarUuidDev('NC', [payload.reference_code, numero, montos?.valorTotal]);
  return {
    proveedor: PROVEEDOR_STUB,
    modoDesarrollo: true,
    estado: ESTADO_VALIDADA,
    numeroNota: numero,
    prefijo: 'NC',
    cude,
    validadaAt: new Date(),
    respuestaProveedor: {
      status: 'Created',
      message: 'Modo desarrollo: nota crédito registrada localmente sin envío a DIAN.',
      data: {
        reference_code: payload.reference_code,
        number: numero,
        is_validated: false,
        cude: null,
        totals: { total: String(Number(montos?.valorTotal || 0).toFixed(2)) },
      },
    },
  };
}

/** Punto único de emisión de nota crédito: stub o Factus. */
async function emitirNotaCredito({ payload, montos, config }) {
  const cfg = config || (await credencialesEfectivas());
  const proveedor = cfg.proveedor || PROVEEDOR_STUB;

  if (proveedor === PROVEEDOR_STUB || !cfg.activo) {
    return emitirNotaCreditoStub(payload, montos);
  }

  if (proveedor === PROVEEDOR_FACTUS) {
    try {
      const resp = await validarNotaCreditoFactus(payload);
      const data = resp?.data || {};
      return {
        proveedor: PROVEEDOR_FACTUS,
        modoDesarrollo: false,
        estado: data.is_validated ? ESTADO_VALIDADA : ESTADO_PENDIENTE_ENVIO,
        numeroNota: data.number || '',
        prefijo: data.numbering_range?.prefix || '',
        cude: data.cude || '',
        validadaAt: data.is_validated ? new Date() : null,
        urlPdf: data.links?.public_url || '',
        urlQr: data.links?.qr || '',
        respuestaProveedor: resp,
        erroresValidacion: data.errors || null,
      };
    } catch (e) {
      return {
        proveedor: PROVEEDOR_FACTUS,
        modoDesarrollo: false,
        estado: ESTADO_RECHAZADA,
        respuestaProveedor: e.details || null,
        erroresValidacion: erroresValidacionFactus(e.details) || { message: e.message },
        error: e.message,
      };
    }
  }

  const err = new Error(`Proveedor de facturación no soportado: ${proveedor}`);
  err.status = 400;
  throw err;
}

async function probarConexionFactus() {
  const cfg = await credencialesEfectivas();
  if (cfg.proveedor === PROVEEDOR_STUB) {
    return {
      ok: true,
      modo: 'desarrollo',
      message: 'Modo desarrollo activo. No se requiere conexión a Factus.',
    };
  }
  const token = await obtenerTokenFactus();
  return {
    ok: true,
    modo: cfg.ambiente,
    message: 'Conexión con Factus exitosa.',
    expiresIn: token.expires_in,
  };
}

module.exports = {
  emitirFactura,
  emitirStub,
  emitirNotaCredito,
  emitirNotaCreditoStub,
  probarConexionFactus,
  listarRangosFactus,
  normalizarRangosFactus,
  extraerListaRangosFactus,
  rangoFacturaPreferido,
  emitirPruebaSandbox,
  payloadPruebaSandbox,
  validarFacturaFactus,
  validarNotaCreditoFactus,
  limpiarFacturasPendientesFactus,
  eliminarFacturaFactusPorReferencia,
  listarFacturasFactus,
};
