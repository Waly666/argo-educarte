const mongoose = require('mongoose');
const Certificado = require('../models/Certificado');
const Contratacion = require('../models/Contratacion');
const JornadaCap = require('../models/JornadaCap');
const ClaseJornadaCap = require('../models/ClaseJornadaCap');
const AsisClasJorCap = require('../models/AsisClasJorCap');

/**
 * Infiere la jornada donde se completó el certificado:
 * la asistencia N (numSesCert) del alumno en el contrato, en o antes de emitir el certificado.
 */
async function inferirIdJornadaCertificado(cert) {
  if (cert?.idJornada) return cert.idJornada;
  if (!cert?.idContrato || cert.numDoc == null) return null;

  const contrato = await Contratacion.findById(cert.idContrato).select('numSesCert').lean();
  const numSesCert = Math.max(1, parseInt(contrato?.numSesCert, 10) || 1);

  const jornadaIds = await JornadaCap.find({ idContrato: cert.idContrato }).distinct('_id');
  if (!jornadaIds.length) return null;

  const claseIds = await ClaseJornadaCap.find({ idJornada: { $in: jornadaIds } }).distinct('_id');
  if (!claseIds.length) return null;

  const refFecha = cert.createdAt || cert.fechaEmision || new Date();
  const asistencias = await AsisClasJorCap.find({
    numDocAlumno: cert.numDoc,
    idclaseJornada: { $in: claseIds },
    createdAt: { $lte: refFecha },
  })
    .sort({ createdAt: 1 })
    .select('idclaseJornada createdAt')
    .lean();

  if (!asistencias.length) return null;

  const idx = Math.min(numSesCert, asistencias.length) - 1;
  const disparadora = asistencias[idx];
  const clase = await ClaseJornadaCap.findById(disparadora.idclaseJornada).select('idJornada').lean();
  return clase?.idJornada || null;
}

/**
 * Rellena idJornada en certificados vigentes que aún no lo tienen.
 * @returns {{ total: number, actualizados: number, sinInferir: number }}
 */
async function migrarIdJornadaCertificados(opts = {}) {
  const { dryRun = false, soloJornadaCap = true } = opts;
  const q = {
    idContrato: { $ne: null },
    estado: { $ne: 'anulado' },
    $or: [{ idJornada: null }, { idJornada: { $exists: false } }],
  };
  if (soloJornadaCap) q.generadoAutoJornada = true;

  const certs = await Certificado.find(q).lean();
  let actualizados = 0;
  let sinInferir = 0;

  for (const cert of certs) {
    const idJornada = await inferirIdJornadaCertificado(cert);
    if (!idJornada) {
      sinInferir += 1;
      continue;
    }
    if (!dryRun) {
      await Certificado.updateOne({ _id: cert._id }, { $set: { idJornada } });
    }
    actualizados += 1;
  }

  if (actualizados > 0) {
    console.log(
      `[ARGO] Certificados jornada: ${actualizados} idJornada rellenado(s)${dryRun ? ' (simulación)' : ''}`,
    );
  }

  return { total: certs.length, actualizados, sinInferir };
}

module.exports = { inferirIdJornadaCertificado, migrarIdJornadaCertificados };
