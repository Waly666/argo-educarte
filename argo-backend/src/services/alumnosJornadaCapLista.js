const mongoose = require('mongoose');
const JornadaCap = require('../models/JornadaCap');
const ClaseJornadaCap = require('../models/ClaseJornadaCap');
const InscripcionClase = require('../models/InscripcionClase');
const AsisClasJorCap = require('../models/AsisClasJorCap');
const Certificado = require('../models/Certificado');
const { parseNumDoc } = require('../utils/numDoc');
const { parseFechaCalendario } = require('../utils/fechaCalendario');

function toObjectId(raw) {
  if (!raw) return null;
  try {
    return raw instanceof mongoose.Types.ObjectId ? raw : new mongoose.Types.ObjectId(String(raw));
  } catch {
    return null;
  }
}

function expandNumDocQueryValues(numDocs) {
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
  return valores;
}

function filtroAlumnosPorNumDocs(numDocs) {
  const valores = expandNumDocQueryValues(numDocs);
  if (!valores.length) return null;
  return { numDoc: { $in: valores } };
}

async function resolverJornadasFiltro({ idJornada, fechaJornada, idContrato }) {
  if (idJornada) {
    const oid = toObjectId(idJornada);
    if (!oid) return [];
    const q = { _id: oid };
    if (idContrato) q.idContrato = toObjectId(idContrato) || idContrato;
    const row = await JornadaCap.findOne(q).select('_id').lean();
    return row ? [row._id] : [];
  }
  if (fechaJornada) {
    const d = parseFechaCalendario(fechaJornada);
    if (!d) return [];
    const fin = new Date(d);
    fin.setHours(23, 59, 59, 999);
    const q = { fechaProgramacion: { $gte: d, $lte: fin } };
    if (idContrato) q.idContrato = toObjectId(idContrato) || idContrato;
    return JornadaCap.find(q).distinct('_id');
  }
  return [];
}

async function numDocsParticipantesJornadas(jornadaIds) {
  if (!jornadaIds?.length) return [];
  const claseIds = await ClaseJornadaCap.find({ idJornada: { $in: jornadaIds } }).distinct('_id');
  if (!claseIds.length) return [];
  const [inscritos, asistentes] = await Promise.all([
    InscripcionClase.find({ idClase: { $in: claseIds } }).distinct('numDoc'),
    AsisClasJorCap.find({ idclaseJornada: { $in: claseIds } }).distinct('numDocAlumno'),
  ]);
  const set = new Set();
  for (const raw of [...inscritos, ...asistentes]) {
    const n = parseNumDoc(raw);
    if (n != null) set.add(n);
  }
  return [...set];
}

async function numDocsConCertificadoJornada(jornadaIds) {
  if (!jornadaIds?.length) return [];
  const docs = await Certificado.find({
    idJornada: { $in: jornadaIds },
    generadoAutoJornada: true,
    estado: { $ne: 'anulado' },
  }).distinct('numDoc');
  return docs.map(parseNumDoc).filter((n) => n != null);
}

async function mapaCertificadosJornada(jornadaIds) {
  if (!jornadaIds?.length) return new Map();
  const certs = await Certificado.find({
    idJornada: { $in: jornadaIds },
    generadoAutoJornada: true,
    estado: { $ne: 'anulado' },
  })
    .sort({ fechaEmision: -1 })
    .lean();
  const map = new Map();
  for (const c of certs) {
    const nd = parseNumDoc(c.numDoc);
    if (nd == null || map.has(nd)) continue;
    map.set(nd, {
      generado: true,
      codigoCert: c.codigoCert || '',
      fechaEmision: c.fechaEmision,
      idJornada: c.idJornada ? String(c.idJornada) : undefined,
    });
  }
  return map;
}

async function enriquecerCertificadoJornada(items, jornadaIds) {
  if (!items?.length || !jornadaIds?.length) return items;
  const map = await mapaCertificadosJornada(jornadaIds);
  return items.map((it) => {
    const nd = parseNumDoc(it.numDoc);
    const cert = nd != null ? map.get(nd) : null;
    return {
      ...it,
      certificadoJornada: cert || { generado: false },
    };
  });
}

module.exports = {
  resolverJornadasFiltro,
  numDocsParticipantesJornadas,
  numDocsConCertificadoJornada,
  filtroAlumnosPorNumDocs,
  enriquecerCertificadoJornada,
};
