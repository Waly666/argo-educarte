const Matricula = require('../models/Matricula');
const Ingreso = require('../models/Ingreso');
const Liquidacion = require('../models/Liquidacion');
const { esTarifaVirtual } = require('../constants/tarifa');
const { TIPO_PAGO_EN_LINEA } = require('../constants/pasarela');
const { ymdCalendario } = require('./cajaVirtualDiaria');

function num(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
  return Number(v) || 0;
}

function parseRango(desde, hasta) {
  const d0 = desde ? new Date(`${String(desde).slice(0, 10)}T00:00:00`) : null;
  const d1 = hasta ? new Date(`${String(hasta).slice(0, 10)}T23:59:59.999`) : null;
  return { d0, d1 };
}

async function informeMatriculasVirtuales({ desde, hasta } = {}) {
  const { d0, d1 } = parseRango(desde, hasta);
  const filtroMat = { tarifa: 4 };
  if (d0 || d1) {
    filtroMat.fechaMat = {};
    if (d0) filtroMat.fechaMat.$gte = d0;
    if (d1) filtroMat.fechaMat.$lte = d1;
  }

  const mats = await Matricula.find(filtroMat).sort({ fechaMat: -1, createdAt: -1 }).lean();
  const idMats = mats.map((m) => m._id);
  const liqs = idMats.length
    ? await Liquidacion.find({ idMat: { $in: idMats } }).lean()
    : [];
  const liqPorMat = new Map();
  for (const l of liqs) {
    const k = String(l.idMat);
    if (!liqPorMat.has(k)) liqPorMat.set(k, []);
    liqPorMat.get(k).push(l);
  }

  const filas = mats.map((m) => {
    const liqsMat = liqPorMat.get(String(m._id)) || [];
    const liq = liqsMat[0];
    const valor = liqsMat.reduce((a, x) => a + num(x.valor), 0);
    const abonado = liqsMat.reduce((a, x) => a + num(x.abonado), 0);
    const saldo = liqsMat.reduce((a, x) => a + num(x.saldo), 0);
    return {
      idMatricula: String(m._id),
      numDoc: m.numDoc,
      idPrograma: m.idPrograma || m.idProg,
      fechaMatricula: m.fechaMat || m.createdAt,
      valorMatricula: num(m.valorMat) || valor,
      pagada: m.pagada || (saldo <= 0.0001 ? 'Pagada' : 'No Pago'),
      saldo,
      abonado,
      origenMatricula: m.origenMatricula || null,
      idLiquidacion: liq ? String(liq._id) : null,
    };
  });

  const resumen = {
    totalMatriculas: filas.length,
    pagadas: filas.filter((f) => f.saldo <= 0.0001).length,
    pendientes: filas.filter((f) => f.saldo > 0.0001).length,
    valorTotal: filas.reduce((a, f) => a + f.valorMatricula, 0),
    saldoPendiente: filas.reduce((a, f) => a + f.saldo, 0),
  };

  return { resumen, filas, desde: desde || null, hasta: hasta || null };
}

async function informeIngresosEnLinea({ desde, hasta } = {}) {
  const { d0, d1 } = parseRango(desde, hasta);
  const filtro = {
    $or: [{ origenPasarela: true }, { idTipoPago: TIPO_PAGO_EN_LINEA }],
  };
  if (d0 || d1) {
    filtro.fecha = {};
    if (d0) filtro.fecha.$gte = d0;
    if (d1) filtro.fecha.$lte = d1;
  }

  const rows = await Ingreso.find(filtro).sort({ fecha: -1 }).lean();
  const filas = rows.map((r) => ({
    idIngreso: String(r._id),
    numDoc: r.numDoc,
    numRecibo: r.numRecibo,
    valor: num(r.valor),
    fecha: r.fecha || r.createdAt,
    concepto: r.concepto,
    idTipoPago: r.idTipoPago,
    formaPago: r.formaPago,
    idSesion: r.idSesion,
    wompiTransactionId: r.wompiTransactionId || null,
    pagoEnLineaReference: r.pagoEnLineaReference || null,
  }));

  const porDia = new Map();
  for (const f of filas) {
    const dia = ymdCalendario(f.fecha);
    porDia.set(dia, (porDia.get(dia) || 0) + f.valor);
  }

  return {
    resumen: {
      cantidad: filas.length,
      total: filas.reduce((a, f) => a + f.valor, 0),
    },
    porDia: [...porDia.entries()].map(([dia, total]) => ({ dia, total })).sort((a, b) => a.dia.localeCompare(b.dia)),
    filas,
    desde: desde || null,
    hasta: hasta || null,
  };
}

function filasMatriculasCsv(filas) {
  const header = ['Documento', 'Programa', 'Fecha matrícula', 'Valor', 'Abonado', 'Saldo', 'Estado'];
  const lines = [header.join(';')];
  for (const f of filas) {
    lines.push(
      [
        f.numDoc,
        f.idPrograma,
        f.fechaMatricula ? new Date(f.fechaMatricula).toISOString().slice(0, 10) : '',
        Math.round(f.valorMatricula),
        Math.round(f.abonado),
        Math.round(f.saldo),
        f.pagada,
      ].join(';'),
    );
  }
  return lines.join('\n');
}

function filasIngresosCsv(filas) {
  const header = ['Fecha', 'Recibo', 'Documento', 'Valor', 'Concepto', 'Ref Wompi'];
  const lines = [header.join(';')];
  for (const f of filas) {
    lines.push(
      [
        f.fecha ? new Date(f.fecha).toISOString().slice(0, 10) : '',
        f.numRecibo,
        f.numDoc,
        Math.round(f.valor),
        String(f.concepto || '').replace(/;/g, ','),
        f.pagoEnLineaReference || f.wompiTransactionId || '',
      ].join(';'),
    );
  }
  return lines.join('\n');
}

module.exports = {
  informeMatriculasVirtuales,
  informeIngresosEnLinea,
  filasMatriculasCsv,
  filasIngresosCsv,
};
