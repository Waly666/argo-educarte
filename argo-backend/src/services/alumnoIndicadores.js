const Liquidacion = require('../models/Liquidacion');
const Ingreso = require('../models/Ingreso');
const Egreso = require('../models/Egreso');
const FacturaElectronica = require('../models/FacturaElectronica');
const { parseNumDoc } = require('../utils/numDoc');
const { numeroDocumentoQuery } = require('../utils/empleadoDoc');
const { validarDocumentosPendientesAlumno } = require('./alumnoDocumentos');
const { indicadoresClasesCeaCreadoPorAlumnos } = require('./programacionCeaAuto');
const { detalleTextoIngreso, idsLiquidacionIngreso } = require('./comprobantesAlertas');
const { referenciaPagoTexto } = require('../utils/referenciaPago');

function inicioDia(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function finDia(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function numSaldo(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
  return Number(v) || 0;
}

/** Clave única por documento (número normalizado). */
function claveNumDoc(numDoc) {
  const n = parseNumDoc(numDoc);
  return n != null ? n : numDoc;
}

function groupByNumDoc(rows) {
  const map = new Map();
  for (const r of rows || []) {
    const k = claveNumDoc(r.numDoc);
    if (k == null) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
}

function filtroNumDocsIn(numDocs) {
  const valores = [];
  const seen = new Set();
  for (const raw of numDocs) {
    const n = parseNumDoc(raw);
    if (n == null) continue;
    for (const v of [n, String(n)]) {
      const key = `${typeof v}:${v}`;
      if (!seen.has(key)) {
        seen.add(key);
        valores.push(v);
      }
    }
  }
  if (!valores.length) return null;
  return { numDoc: { $in: valores } };
}

function indicadorSaldos(liquidaciones) {
  let saldosPendientes = 0;
  let saldoTotal = 0;
  const itemsSaldo = [];
  for (const l of liquidaciones) {
    const s = numSaldo(l.saldo);
    if (s > 0.0001) {
      saldosPendientes += 1;
      saldoTotal += s;
      itemsSaldo.push({
        id: String(l._id),
        descripcion: String(l.descripcion || 'Servicio').trim(),
        saldo: s,
      });
    }
  }
  itemsSaldo.sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'));
  return { saldosPendientes, saldoTotal, itemsSaldo };
}

function numValor(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
  return Number(v) || 0;
}

function mapIngresoHoy(ing, descrMap = {}) {
  return {
    id: String(ing._id),
    numRecibo: ing.numRecibo || null,
    valor: numValor(ing.valor),
    detalle: detalleTextoIngreso(ing, descrMap) || null,
    formaPago: ing.formaPago || null,
    tipoPago: ing.formaPago || ing.idTipoPago || null,
    numComprobante: referenciaPagoTexto(ing.numTransferencia, ing.numComprobante),
    fecha: ing.fecha || ing.createdAt || null,
  };
}

function mapEgresoHoy(eg) {
  return {
    id: String(eg._id),
    numRecibo: eg.numRecibo || null,
    valor: numValor(eg.valorEgreso),
    detalle: String(eg.concepto || '').trim() || null,
    formaPago: eg.formaPago || null,
    tipoPago: eg.formaPago || null,
    numComprobante: referenciaPagoTexto(eg.numTransferencia, eg.numComprobante),
    fecha: eg.fechaEgreso || eg.fechaAudi || null,
  };
}

function mapFacturaHoy(f) {
  return {
    id: String(f._id),
    numeroFactura: f.numeroFactura || null,
    valor: numValor(f.valorTotal),
    estado: f.estado || null,
    fecha: f.emitidaAt || f.createdAt || null,
  };
}

/** Comprobantes / facturas emitidos hoy por alumno (para alarmas en lista). */
async function movimientosHoyPorAlumnos(numDocs) {
  const map = new Map();
  for (const nd of numDocs || []) {
    const k = claveNumDoc(nd);
    if (k != null) map.set(k, { ingreso: null, egreso: null, factura: null });
  }
  if (!map.size) return map;

  const hoy = inicioDia();
  const fin = finDia();
  const filtroNum = filtroNumDocsIn(numDocs);
  if (!filtroNum) return map;

  const orEgreso = [];
  for (const nd of numDocs) {
    const q = numeroDocumentoQuery(nd);
    if (q) orEgreso.push(q);
  }

  const [ingresos, facturas, egresos] = await Promise.all([
    Ingreso.find({
      ...filtroNum,
      ingresoCaja: { $ne: true },
      $or: [
        { createdAt: { $gte: hoy, $lte: fin } },
        { fecha: { $gte: hoy, $lte: fin } },
      ],
    })
      .select('_id numDoc numRecibo valor fecha createdAt detalle idLiquidacion concepto tipoIngreso idTipoPago formaPago numTransferencia numComprobante')
      .sort({ createdAt: -1 })
      .lean(),
    FacturaElectronica.find({
      ...filtroNum,
      estado: { $nin: ['borrador', 'anulada'] },
      $or: [
        { createdAt: { $gte: hoy, $lte: fin } },
        { emitidaAt: { $gte: hoy, $lte: fin } },
      ],
    })
      .select('_id numDoc numeroFactura valorTotal estado createdAt emitidaAt')
      .sort({ createdAt: -1 })
      .lean(),
    orEgreso.length
      ? Egreso.find({
          $or: orEgreso,
          fechaEgreso: { $gte: hoy, $lte: fin },
        })
          .select('_id numeroDocumento numDoc numRecibo valorEgreso concepto fechaEgreso fechaAudi formaPago numTransferencia')
          .sort({ fechaEgreso: -1 })
          .lean()
      : [],
  ]);

  const liqIds = [...new Set(ingresos.flatMap((ing) => idsLiquidacionIngreso(ing)))];
  const liqs = liqIds.length
    ? await Liquidacion.find({ _id: { $in: liqIds } }).select('_id descripcion').lean()
    : [];
  const descrMap = Object.fromEntries(liqs.map((l) => [String(l._id), l.descripcion || '']));

  for (const ing of ingresos) {
    const k = claveNumDoc(ing.numDoc);
    if (k == null || !map.has(k)) continue;
    const slot = map.get(k);
    if (!slot.ingreso) slot.ingreso = mapIngresoHoy(ing, descrMap);
  }

  for (const eg of egresos) {
    const k = claveNumDoc(eg.numeroDocumento || eg.numDoc);
    if (k == null || !map.has(k)) continue;
    const slot = map.get(k);
    if (!slot.egreso) slot.egreso = mapEgresoHoy(eg);
  }

  for (const f of facturas) {
    const k = claveNumDoc(f.numDoc);
    if (k == null || !map.has(k)) continue;
    const slot = map.get(k);
    if (!slot.factura) slot.factura = mapFacturaHoy(f);
  }

  return map;
}

async function enriquecerIndicadoresLista(items) {
  if (!items?.length) return items;

  const numDocs = [...new Set(items.map((i) => i.numDoc).filter((n) => n != null))];
  if (!numDocs.length) return items;

  const filtro = filtroNumDocsIn(numDocs);
  const [liquidaciones, ceaPorDoc, movHoyPorDoc] = await Promise.all([
    filtro ? Liquidacion.find(filtro).lean() : [],
    indicadoresClasesCeaCreadoPorAlumnos(numDocs),
    movimientosHoyPorAlumnos(numDocs),
  ]);

  const liqsByNum = groupByNumDoc(liquidaciones);

  return Promise.all(
    items.map(async (item) => {
      const key = claveNumDoc(item.numDoc);
      const liqs = liqsByNum.get(key) || [];
      const { saldosPendientes, saldoTotal, itemsSaldo } = indicadorSaldos(liqs);

      const alumnoDoc = {
        numDoc: item.numDoc,
        urlCedula: item.urlCedula,
        urlLicencia: item.urlLicencia,
        docsAlumno: item.docsAlumno,
      };
      const val = await validarDocumentosPendientesAlumno(alumnoDoc);
      const docsPendientes = (val.pendientes || []).length;
      const cea = ceaPorDoc.get(key) || { clasesCeaCreado: 0, programasCeaCreado: [] };
      const mov = movHoyPorDoc.get(key) || { ingreso: null, egreso: null, factura: null };

      return {
        ...item,
        indicadores: {
          docsPendientes,
          saldosPendientes,
          saldoTotal,
          itemsSaldo,
          clasesCeaCreado: cea.clasesCeaCreado,
          programasCeaCreado: cea.programasCeaCreado,
          comprobanteIngresoHoy: mov.ingreso,
          comprobanteEgresoHoy: mov.egreso,
          facturaHoy: mov.factura,
        },
      };
    }),
  );
}

module.exports = { enriquecerIndicadoresLista, movimientosHoyPorAlumnos };
