const { roundMoney } = require('../utils/coerceTypes');
const {
  ADQUIRENTE_CLIENTE,
  FORMA_PAGO_CREDITO,
  FORMA_PAGO_CONTADO,
} = require('../constants/facturacionElectronica');

/** Factus exige due_date (YYYY-MM-DD) cuando payment_form es crédito. */
function fechaVencimientoCredito(diasPlazo = 30) {
  const d = new Date();
  d.setDate(d.getDate() + diasPlazo);
  return d.toISOString().slice(0, 10);
}

/** Mapeo tipo documento ARGO → código DIAN/Factus (identification_document_code). */
const MAP_TIPO_DOC = {
  '1': '13',
  '13': '13',
  CC: '13',
  CEDULA: '13',
  '2': '31',
  '31': '31',
  NIT: '31',
  '3': '22',
  '22': '22',
  CE: '22',
  '4': '12',
  '12': '12',
  TI: '12',
  '5': '41',
  '41': '41',
  PP: '41',
  PAS: '41',
};

function num(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
  return Number(v) || 0;
}

function codigoTipoDoc(tipoDoc) {
  const t = String(tipoDoc || '1').trim().toUpperCase();
  return MAP_TIPO_DOC[t] || MAP_TIPO_DOC[String(tipoDoc || '').trim()] || '13';
}

function nombreAlumno(a) {
  if (!a) return '';
  return [a.nombre1, a.nombre2, a.apellido1, a.apellido2].filter(Boolean).join(' ').trim();
}

/** Condición de IVA efectiva del servicio (default según % si no está definida). */
function condicionIvaServicio(serv) {
  const c = String(serv?.condicionIva || '').trim().toLowerCase();
  if (['gravado', 'exento', 'excluido'].includes(c)) return c;
  return num(serv?.iva) > 0 ? 'gravado' : 'excluido';
}

/**
 * Desglosa el valor de la liquidación (IVA incluido) en base + IVA.
 * - gravado: base = valor / (1 + iva%), IVA = valor - base
 * - exento: tarifa 0% → base = valor, IVA = 0
 * - excluido: sin IVA → base = valor, IVA = 0
 */
function desglosarItem(valorLiquidacion, condicionIva, porcentajeIva) {
  const total = roundMoney(num(valorLiquidacion));
  const pct = Math.max(0, Number(porcentajeIva) || 0);
  if (condicionIva === 'gravado' && pct > 0) {
    const base = roundMoney(total / (1 + pct / 100));
    const iva = roundMoney(total - base);
    return { base, valorIva: iva, total, porcentajeIva: pct };
  }
  return { base: total, valorIva: 0, total, porcentajeIva: condicionIva === 'exento' ? 0 : 0 };
}

function referenceCodeFactura(numDoc) {
  const ts = Date.now();
  return `ARGO-FE-${numDoc || 'X'}-${ts}`;
}

/** Construye el bloque taxes de Factus según condición de IVA. */
function taxesItem(condicionIva, porcentajeIva) {
  if (condicionIva === 'excluido') return [{ is_excluded: true }];
  if (condicionIva === 'exento') return [{ code: '01', rate: '0.00' }];
  return [{ code: '01', rate: (Number(porcentajeIva) || 0).toFixed(2) }];
}

/** Redondeo a 2 decimales (misma precisión que Factus en líneas e IVA). */
function round2(v) {
  return Math.round(Number(v) * 100) / 100;
}

/** IVA de una línea según taxes[] de Factus (base ya en pesos con 2 decimales). */
function ivaLineaFactus(base, taxes = []) {
  const t = taxes[0];
  if (!t || t.is_excluded) return 0;
  const rate = Number(t.rate) || 0;
  if (rate <= 0) return 0;
  return round2((base * rate) / 100);
}

/** Total de línea: base × cantidad + IVA (criterio Factus /v2/bills/validate). */
function totalLineaFactus(item) {
  const qty = Number(item?.quantity) || 1;
  const base = round2((Number(item?.price) || 0) * qty);
  const iva = ivaLineaFactus(base, item?.taxes);
  return round2(base + iva);
}

/** Suma de totales por línea — debe coincidir con payment_details.amount. */
function totalFactusDesdeItems(items = []) {
  return round2(items.reduce((s, it) => s + totalLineaFactus(it), 0));
}

function customerDesdeAlumno(al) {
  const docCode = codigoTipoDoc(al?.tipoDoc);
  const esJuridica = docCode === '31';
  const customer = {
    identification_document_code: docCode,
    identification: String(al?.numDoc || ''),
    legal_organization_code: esJuridica ? '1' : '2',
    tribute_code: 'ZZ',
  };
  if (esJuridica) customer.company = nombreAlumno(al) || 'Cliente';
  else customer.names = nombreAlumno(al) || 'Cliente';
  if (al?.direccion) customer.address = String(al.direccion).trim();
  if (al?.correo) customer.email = String(al.correo).trim();
  if (al?.celular) customer.phone = String(al.celular).trim();
  if (al?.codMunicipio) customer.municipality_code = String(al.codMunicipio).trim();
  return customer;
}

const ETIQUETA_TIPO_DOC = {
  '13': 'CC',
  '31': 'NIT',
  '22': 'CE',
  '12': 'TI',
  '41': 'PP',
};

function etiquetaTipoDoc(tipoDoc) {
  return ETIQUETA_TIPO_DOC[codigoTipoDoc(tipoDoc)] || 'DOC';
}

function truncarTexto(texto, max) {
  const t = String(texto || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 3)}...`;
}

/** Línea única Factus al facturar capacitación de un alumno a empresa/tercero. */
function nombreItemCapacitacionTercero(alumno, servicios = []) {
  const nombre = nombreAlumno(alumno);
  const doc = String(alumno?.numDoc || '').trim();
  const tipo = etiquetaTipoDoc(alumno?.tipoDoc);
  const lista = servicios.filter(Boolean).join('; ');
  return truncarTexto(`Capacitacion ${tipo} ${doc} ${nombre} - ${lista}`, 250);
}

function observacionCapacitacionTercero(alumno, servicios = [], valorTotal = 0) {
  const nombre = nombreAlumno(alumno);
  const doc = String(alumno?.numDoc || '').trim();
  const tipo = etiquetaTipoDoc(alumno?.tipoDoc);
  const lista = servicios.filter(Boolean).join('; ');
  const valor = roundMoney(num(valorTotal)).toLocaleString('es-CO');
  return truncarTexto(
    `Participante: ${nombre} (${tipo} ${doc}). Servicios: ${lista}. Valor total capacitacion: $${valor}.`,
    500,
  );
}

function claveIvaLinea(condicion, porcentajeIva) {
  return `${condicion}|${Number(porcentajeIva) || 0}`;
}

function validarIvaUniforme(lineas = []) {
  if (!lineas.length) return null;
  const ref = claveIvaLinea(lineas[0].condicion, lineas[0].porcentajeIva);
  const mixto = lineas.some((l) => claveIvaLinea(l.condicion, l.porcentajeIva) !== ref);
  if (mixto) {
    const err = new Error(
      'Para facturar a empresa en un solo ítem, todos los servicios deben tener la misma condición de IVA. Seleccione servicios compatibles o facture al alumno.',
    );
    err.status = 400;
    err.code = 'FE_IVA_MIXTO';
    throw err;
  }
  return lineas[0];
}

function itemFactusConsolidadoTercero(alumno, lineas, baseTotal) {
  const ref = validarIvaUniforme(lineas);
  const servicios = lineas.map((l) => l.descripcion);
  return {
    code_reference: `CAP-${alumno?.numDoc || 'X'}`,
    name: nombreItemCapacitacionTercero(alumno, servicios),
    quantity: '1.00',
    discount_rate: '0.00',
    price: roundMoney(baseTotal).toFixed(2),
    unit_measure_code: '94',
    standard_code: '999',
    taxes: taxesItem(ref.condicion, ref.porcentajeIva),
  };
}

function customerDesdeCliente(cli) {
  const esJuridica = String(cli?.legalOrganizationCode || '1') === '1';
  const customer = {
    identification_document_code: cli?.identificationDocumentCode || '31',
    identification: String(cli?.identificacion || ''),
    legal_organization_code: cli?.legalOrganizationCode || '1',
    tribute_code: cli?.tributeCode || 'ZZ',
  };
  if (cli?.dv) customer.dv = String(cli.dv).trim();
  if (esJuridica) customer.company = cli?.razonSocial || cli?.nombres || 'Cliente';
  else customer.names = cli?.nombres || cli?.razonSocial || 'Cliente';
  if (cli?.nombreComercial) customer.trade_name = String(cli.nombreComercial).trim();
  if (cli?.direccion) customer.address = String(cli.direccion).trim();
  if (cli?.correo) customer.email = String(cli.correo).trim();
  if (cli?.telefono) customer.phone = String(cli.telefono).trim();
  if (cli?.municipioCodigo) customer.municipality_code = String(cli.municipioCodigo).trim();
  return customer;
}

/**
 * Arma el payload Factus POST /v2/bills/validate a partir de varias liquidaciones.
 * @param {Object} p
 * @param {Array}  p.itemsCtx - [{ liquidacion, servicio }]
 * @param {Object} p.adquirente - { tipo, alumno?, cliente? }
 * @param {Object} p.configFacturacion
 * @param {Number} p.totalAbonado - suma de abonos ya recibidos (para payment_details)
 */
function armarPayloadFactus({
  itemsCtx = [],
  adquirente = {},
  configFacturacion = {},
  numDoc,
  totalAbonado = 0,
  dueDate = null,
  customerFactus = null,
}) {
  const cfg = configFacturacion || {};
  const detalle = [];
  const lineasInternas = [];
  let base = 0;
  let valorIva = 0;
  let total = 0;

  for (const ctx of itemsCtx) {
    const liq = ctx.liquidacion || {};
    const serv = ctx.servicio || {};
    const condicion = condicionIvaServicio(serv);
    const pct = num(serv.iva);
    const m = desglosarItem(liq.valor, condicion, pct);
    const descripcion = String(liq.descripcion || serv.descrServicio || 'Servicio CEA').trim();

    lineasInternas.push({
      condicion,
      porcentajeIva: m.porcentajeIva,
      descripcion,
      codeReference: String(serv.idServ || liq.idServ || liq._id || 'SERV'),
      m,
    });

    detalle.push({
      idLiquidacion: liq._id,
      idServ: liq.idServ || serv.idServ || null,
      idProg: liq.idProg || null,
      descripcion,
      condicionIva: condicion,
      porcentajeIva: m.porcentajeIva,
      valorLiquidacion: m.total,
      base: m.base,
      valorIva: m.valorIva,
      total: m.total,
    });

    base = roundMoney(base + m.base);
    valorIva = roundMoney(valorIva + m.valorIva);
    total = roundMoney(total + m.total);
  }

  const esCliente = adquirente.tipo === ADQUIRENTE_CLIENTE && adquirente.cliente;
  const items = esCliente
    ? [itemFactusConsolidadoTercero(adquirente.alumno, lineasInternas, base)]
    : lineasInternas.map((l) => ({
        code_reference: l.codeReference,
        name: l.descripcion,
        quantity: '1.00',
        discount_rate: '0.00',
        price: l.m.base.toFixed(2),
        unit_measure_code: '94',
        standard_code: '999',
        taxes: taxesItem(l.condicion, l.porcentajeIva),
      }));
  const customer =
    customerFactus ||
    (esCliente ? customerDesdeCliente(adquirente.cliente) : customerDesdeAlumno(adquirente.alumno));

  // Total que Factus calcula desde ítems (base + IVA por línea con 2 decimales).
  const totalFactus = totalFactusDesdeItems(items);
  const valorIvaFactus = round2(totalFactus - base);

  // Forma de pago: crédito si queda saldo, contado si ya está todo pagado.
  const abonado = roundMoney(num(totalAbonado));
  const esCredito = abonado < totalFactus - 0.0001;
  const formaPago = esCredito ? FORMA_PAGO_CREDITO : FORMA_PAGO_CONTADO;

  const pago = {
    payment_form: formaPago,
    payment_method_code: esCredito ? '47' : '10',
    amount: totalFactus.toFixed(2),
  };
  if (esCredito) {
    pago.due_date = dueDate || fechaVencimientoCredito(30);
  }

  const payload = {
    reference_code: referenceCodeFactura(numDoc),
    document: '01',
    operation_type: '10',
    send_email: cfg.sendEmail !== false,
    payment_details: [pago],
    cash_rounding_amount: '0.00',
    customer,
    items,
  };
  if (cfg.numberingRangeId) payload.numbering_range_id = cfg.numberingRangeId;
  if (esCliente && adquirente.alumno) {
    payload.observation = observacionCapacitacionTercero(
      adquirente.alumno,
      lineasInternas.map((l) => l.descripcion),
      total,
    );
  }

  // ReteIVA informativa cuando el cliente es agente retenedor.
  let reteIva = { aplica: false, porcentaje: 0, valor: 0 };
  if (esCliente && adquirente.cliente?.agenteRetenedorIva) {
    const pctRete = Number(adquirente.cliente.porcentajeReteIva) || 0;
    if (pctRete > 0 && valorIva > 0) {
      reteIva = {
        aplica: true,
        porcentaje: pctRete,
        valor: roundMoney(valorIva * (pctRete / 100)),
      };
    }
  }

  return {
    payload,
    detalle,
    totales: { base, valorIva: valorIvaFactus, total: totalFactus, formaPago, esCredito },
    reteIva,
    lineaFactus:
      esCliente && items[0]
        ? { consolidada: true, nombre: items[0].name, servicios: lineasInternas.length }
        : { consolidada: false, nombre: null, servicios: items.length },
  };
}

module.exports = {
  codigoTipoDoc,
  condicionIvaServicio,
  desglosarItem,
  taxesItem,
  referenceCodeFactura,
  armarPayloadFactus,
  nombreAlumno,
  nombreItemCapacitacionTercero,
  customerDesdeAlumno,
  customerDesdeCliente,
  totalFactusDesdeItems,
  totalLineaFactus,
};
