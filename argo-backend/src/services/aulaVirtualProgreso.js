const Matricula = require('../models/Matricula');
const ProgresoVirtualCurso = require('../models/ProgresoVirtualCurso');
const { parseNumDoc, numDocQuery } = require('../utils/numDoc');
const { TARIFA_VIRTUAL } = require('../constants/tarifa');
const {
  buscarPrograma,
  esCapacitacionVirtualServicio,
} = require('./programaServicio');
const {
  configPorPrograma,
  obtenerCursoVirtual,
  servicioMatriculaPrograma,
} = require('./aulaVirtualCatalogo');
const { intentarCertificadoVirtualAprobar } = require('./certificadoVirtualAuto');
const { puedeCursarVirtual, requierePagoParaCursar } = require('./aulaVirtualConfig');
const { estadoPagoVirtual, buscarMatriculaVirtual } = require('./aulaVirtualMatricula');

const QUERY_MATRICULA_ACTIVA = { estado: { $regex: /^activo?a?$/i } };
const UMBRAL_CLASE_APROBADA = 70;

function clampPct(v, def = 0) {
  const n = Number(v);
  if (Number.isNaN(n)) return def;
  return Math.min(100, Math.max(0, n));
}

function relaxarMatricula() {
  return process.env.AULA_VIRTUAL_RELAXAR_MATRICULA === '1';
}

function normalizarClases(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    const numero = Number(item?.numero ?? item?.num ?? item?.clase ?? item?.id);
    if (!Number.isFinite(numero) || numero < 1) continue;
    const pct = clampPct(item?.pct ?? item?.nota ?? item?.porcentaje ?? 0);
    out.push({
      numero,
      pct,
      aprobada: item?.aprobada === true || pct >= UMBRAL_CLASE_APROBADA,
    });
  }
  out.sort((a, b) => a.numero - b.numero);
  return out;
}

function metricasDesdeClases(clases, totalSlots = 7) {
  if (!clases.length) {
    return { pctCompletitud: 0, promedioClases: null, clasesAprobadas: 0 };
  }
  const slots = Math.max(totalSlots, ...clases.map((c) => c.numero));
  const map = new Map(clases.map((c) => [c.numero, c.pct]));
  let suma = 0;
  let sumaConNota = 0;
  let countConNota = 0;
  let aprobadas = 0;
  for (let i = 1; i <= slots; i++) {
    const pct = map.get(i) || 0;
    suma += pct;
    if (pct > 0) {
      sumaConNota += pct;
      countConNota++;
    }
    if (pct >= UMBRAL_CLASE_APROBADA) aprobadas++;
  }
  return {
    pctCompletitud: Math.round(suma / slots),
    promedioClases: countConNota ? Math.round(sumaConNota / countConNota) : null,
    clasesAprobadas: aprobadas,
    totalClases: slots,
  };
}

function mapIntentosPublicos(intentos) {
  if (!Array.isArray(intentos)) return [];
  return intentos.map((it, idx) => ({
    numero: idx + 1,
    nota: clampPct(it.nota),
    pctCompletitud: clampPct(it.pctCompletitud),
    aprobado: !!it.aprobado,
    fecha: it.fecha ? new Date(it.fecha).toISOString() : null,
  }));
}

function mapProgresoPublico(progreso, estadoExtra = {}) {
  const clasesEstado = Array.isArray(estadoExtra.clases) ? estadoExtra.clases : [];
  const clasesDoc = Array.isArray(progreso?.clases) ? progreso.clases : [];
  const clases = clasesEstado.length ? clasesEstado : clasesDoc;
  return {
    pctCompletitud: clampPct(estadoExtra.pctCompletitud ?? progreso?.pctCompletitud),
    promedioClases:
      estadoExtra.promedioClases != null
        ? clampPct(estadoExtra.promedioClases)
        : progreso?.promedioClases != null
          ? clampPct(progreso.promedioClases)
          : null,
    clases,
    clasesAprobadas: estadoExtra.clasesAprobadas ?? clases.filter((c) => c.aprobada).length,
    totalClases: estadoExtra.totalClases ?? (clases.length || null),
    mejorNotaEval: progreso?.mejorNotaEval != null ? clampPct(progreso.mejorNotaEval) : null,
    ultimaNotaEval: progreso?.ultimaNotaEval,
    intentosEval: progreso?.intentosEval || 0,
    intentos: mapIntentosPublicos(progreso?.intentos),
    aprobado: !!(estadoExtra.aprobado ?? progreso?.aprobado),
    certificadoEmitido: !!(estadoExtra.certificadoEmitido ?? progreso?.certificadoEmitido),
  };
}

async function verificarAccesoCurso(numDoc, idPrograma) {
  const mat = await buscarMatriculaVirtual(numDoc, idPrograma);
  if (!mat && !relaxarMatricula()) {
    const err = new Error('Debe matricularse en este curso para acceder al contenido');
    err.status = 403;
    throw err;
  }

  const curso = await obtenerCursoVirtual(idPrograma, { requierePublicado: false });
  if (!curso) {
    const err = new Error('Curso no encontrado');
    err.status = 404;
    throw err;
  }
  if (!curso.tienePaquete) {
    const err = new Error('El curso aún no tiene contenido cargado');
    err.status = 400;
    throw err;
  }

  const cfg = (await configPorPrograma(idPrograma)) || {};
  if (requierePagoParaCursar(cfg)) {
    const pago = await estadoPagoVirtual(numDoc, idPrograma);
    if (!pago.pagado) {
      const err = new Error('Debe completar el pago para acceder al contenido del curso');
      err.status = 403;
      err.code = 'PAGO_REQUERIDO_CURSO';
      throw err;
    }
  }

  return { curso, matricula: mat };
}

async function obtenerProgresoDoc(numDoc, idPrograma) {
  const idProg = String(idPrograma);
  let doc = await ProgresoVirtualCurso.findOne({ ...numDocQuery(numDoc), idPrograma: idProg }).lean();
  if (!doc) {
    doc = {
      numDoc,
      idPrograma: idProg,
      pctCompletitud: 0,
      mejorNotaEval: null,
      ultimaNotaEval: null,
      intentosEval: 0,
      aprobado: false,
      certificadoEmitido: false,
      intentos: [],
      clases: [],
      promedioClases: null,
    };
  }
  return doc;
}

async function evaluarAprobacion(numDoc, idPrograma) {
  const cfg = (await configPorPrograma(idPrograma)) || {};
  const progreso = await obtenerProgresoDoc(numDoc, idPrograma);

  const pctMinCompletitud = clampPct(cfg.pctMinCompletitud, 80);
  const pctMinEvaluaciones = clampPct(cfg.pctMinEvaluaciones, 60);
  const intentosMaxEval = Math.max(1, Number(cfg.intentosMaxEval) || 3);

  const cumpleCompletitud = clampPct(progreso.pctCompletitud) >= pctMinCompletitud;
  const mejorNota = progreso.mejorNotaEval != null ? clampPct(progreso.mejorNotaEval) : null;
  const cumpleNota = mejorNota != null && mejorNota >= pctMinEvaluaciones;
  const intentosRestantes = Math.max(0, intentosMaxEval - (progreso.intentosEval || 0));
  const aprobado = !!(progreso.aprobado || (cumpleCompletitud && cumpleNota));
  const pago = await estadoPagoVirtual(numDoc, idPrograma);

  const metricas = metricasDesdeClases(progreso.clases || []);
  return {
    modoCertificado: cfg.modoCertificado || 'al_pagar',
    pago,
    pctMinCompletitud,
    pctMinEvaluaciones,
    intentosMaxEval,
    pctCompletitud: clampPct(progreso.pctCompletitud),
    promedioClases:
      progreso.promedioClases != null ? clampPct(progreso.promedioClases) : metricas.promedioClases,
    clases: progreso.clases || [],
    clasesAprobadas: metricas.clasesAprobadas,
    totalClases: metricas.totalClases,
    mejorNotaEval: mejorNota,
    ultimaNotaEval: progreso.ultimaNotaEval,
    intentosEval: progreso.intentosEval || 0,
    intentosRestantes,
    cumpleCompletitud,
    cumpleNota,
    aprobado,
    certificadoEmitido: !!progreso.certificadoEmitido,
    puedeReintentar: !aprobado && intentosRestantes > 0,
    puedeCertificarse: pago.pagado,
    certificadoPendientePago: aprobado && !pago.pagado && !progreso.certificadoEmitido,
  };
}

function mensajeCertificadoPendiente(certResult, estado) {
  if (certResult?.creado) return null;
  if (certResult?.motivo === 'sin_liquidacion_pagada' || estado.certificadoPendientePago) {
    return 'Aprobó el curso. El certificado se emitirá cuando complete el pago.';
  }
  if (estado.aprobado && estado.modoCertificado === 'al_pagar' && !estado.pago?.pagado) {
    return 'Completó el curso. Realice el pago para obtener el certificado.';
  }
  return null;
}

function mapProgresoRespuesta(progreso, estado, certResult = null) {
  const avisoCert = mensajeCertificadoPendiente(certResult, estado);
  return {
    progreso: {
      pctCompletitud: estado.pctCompletitud,
      promedioClases: estado.promedioClases,
      clases: estado.clases || [],
      clasesAprobadas: estado.clasesAprobadas,
      totalClases: estado.totalClases,
      mejorNotaEval: estado.mejorNotaEval,
      ultimaNotaEval: estado.ultimaNotaEval,
      intentosEval: estado.intentosEval,
      intentos: mapIntentosPublicos(progreso?.intentos),
      aprobado: estado.aprobado,
      certificadoEmitido: estado.certificadoEmitido || !!certResult?.creado,
    },
    reglas: {
      modoCertificado: estado.modoCertificado,
      pctMinCompletitud: estado.pctMinCompletitud,
      pctMinEvaluaciones: estado.pctMinEvaluaciones,
      intentosMaxEval: estado.intentosMaxEval,
      intentosRestantes: estado.intentosRestantes,
      cumpleCompletitud: estado.cumpleCompletitud,
      cumpleNota: estado.cumpleNota,
      puedeReintentar: estado.puedeReintentar,
      puedeCertificarse: estado.puedeCertificarse,
      certificadoPendientePago: estado.certificadoPendientePago,
    },
    pago: estado.pago || null,
    certificado: certResult?.creado
      ? { emitido: true, codigoCert: certResult.certificado?.codigoCert }
      : certResult?.motivo
        ? { emitido: false, motivo: certResult.motivo }
        : null,
    avisoCertificado: avisoCert,
  };
}

async function reportarProgreso(numDoc, idPrograma, body = {}) {
  await verificarAccesoCurso(numDoc, idPrograma);
  const idProg = String(idPrograma);
  const cfg = (await configPorPrograma(idProg)) || {};
  const intentosMaxEval = Math.max(1, Number(cfg.intentosMaxEval) || 3);

  const pctCompletitud =
    body.pctCompletitud != null
      ? clampPct(body.pctCompletitud)
      : body.completitud != null
        ? clampPct(body.completitud)
        : null;

  const notaRaw = body.notaEval != null ? body.notaEval : body.evaluacion != null ? body.evaluacion : body.nota;
  const esEvaluacionFinal =
    body.evaluacionFinal === true ||
    body.esEvaluacionFinal === true ||
    body.final === true;

  let doc = await ProgresoVirtualCurso.findOne({ ...numDocQuery(numDoc), idPrograma: idProg });
  if (!doc) {
    doc = new ProgresoVirtualCurso({ numDoc, idPrograma: idProg });
  }

  const clasesBody = normalizarClases(body.clases);
  if (clasesBody.length) {
    doc.clases = clasesBody;
    const m = metricasDesdeClases(clasesBody);
    doc.pctCompletitud = m.pctCompletitud;
    doc.promedioClases =
      body.promedioClases != null ? clampPct(body.promedioClases) : m.promedioClases;
  } else if (pctCompletitud != null) {
    doc.pctCompletitud = Math.max(doc.pctCompletitud || 0, pctCompletitud);
  }

  let bloqueadoIntento = false;
  if (esEvaluacionFinal && notaRaw != null) {
    const nota = clampPct(notaRaw);
    if (doc.aprobado) {
      bloqueadoIntento = true;
    } else if ((doc.intentosEval || 0) >= intentosMaxEval) {
      bloqueadoIntento = true;
    } else {
      const pctMinCompletitud = clampPct(cfg.pctMinCompletitud, 80);
      const pctMinEvaluaciones = clampPct(cfg.pctMinEvaluaciones, 60);
      const pctAlIntento = pctCompletitud != null ? pctCompletitud : doc.pctCompletitud || 0;
      const aprobadoIntento = pctAlIntento >= pctMinCompletitud && nota >= pctMinEvaluaciones;

      doc.intentosEval = (doc.intentosEval || 0) + 1;
      doc.ultimaNotaEval = nota;
      doc.mejorNotaEval =
        doc.mejorNotaEval == null ? nota : Math.max(doc.mejorNotaEval, nota);
      doc.intentos.push({
        nota,
        pctCompletitud: pctAlIntento,
        aprobado: aprobadoIntento,
        fecha: new Date(),
      });

      if (aprobadoIntento) doc.aprobado = true;
    }
  }

  doc.fechaUltimaActividad = new Date();
  doc.contadorSyncs = (doc.contadorSyncs || 0) + 1;
  await doc.save();

  const estado = await evaluarAprobacion(numDoc, idProg);
  let certResult = null;

  if (estado.aprobado && cfg.modoCertificado === 'al_aprobar' && !estado.certificadoEmitido) {
    certResult = await intentarCertificadoVirtualAprobar({ numDoc, idPrograma: idProg });
    if (certResult.creado) {
      await ProgresoVirtualCurso.updateOne(
        { ...numDocQuery(numDoc), idPrograma: idProg },
        { $set: { certificadoEmitido: true } },
      );
      estado.certificadoEmitido = true;
    }
  }

  const resp = mapProgresoRespuesta(doc.toObject(), estado, certResult);
  if (bloqueadoIntento) {
    resp.aviso = doc.aprobado
      ? 'Ya aprobó la evaluación.'
      : 'Agotó los intentos permitidos para la evaluación.';
  } else if (resp.avisoCertificado) {
    resp.aviso = resp.avisoCertificado;
  }
  return resp;
}

async function listarMisCursos(numDoc) {
  const mats = await Matricula.find({
    ...numDocQuery(numDoc),
    ...QUERY_MATRICULA_ACTIVA,
  })
    .sort({ fechaMat: -1 })
    .lean();

  const vistos = new Set();
  const out = [];

  for (const m of mats) {
    const idProg = String(m.idProg);
    if (vistos.has(idProg)) continue;
    const prog = await buscarPrograma(idProg);
    if (!prog) continue;
    const serv = await servicioMatriculaPrograma(prog);
    if (!esCapacitacionVirtualServicio(serv)) continue;
    const curso = await obtenerCursoVirtual(idProg, { requierePublicado: false });
    if (!curso) continue;
    vistos.add(idProg);
    const docProg = await obtenerProgresoDoc(numDoc, idProg);
    const estado = await evaluarAprobacion(numDoc, idProg);
    const pago = estado.pago;
    const cfg = (await configPorPrograma(idProg)) || {};
    const puedeCursar = puedeCursarVirtual({
      cfg,
      tienePaquete: !!curso.tienePaquete,
      matriculado: true,
      pago,
    });
    out.push({
      ...curso,
      matricula: {
        fechaMat: m.fechaMat,
        pagada: m.pagada,
        tarifa: m.tarifa,
      },
      pago,
      puedeCursar,
      accesoBloqueadoPago: requierePagoParaCursar(cfg) && !pago.pagado,
      progreso: mapProgresoPublico(docProg, estado),
      reglas: {
        modoCertificado: estado.modoCertificado,
        pctMinCompletitud: estado.pctMinCompletitud,
        pctMinEvaluaciones: estado.pctMinEvaluaciones,
        intentosMaxEval: estado.intentosMaxEval,
        intentosRestantes: estado.intentosRestantes,
        cumpleCompletitud: estado.cumpleCompletitud,
        cumpleNota: estado.cumpleNota,
        puedeReintentar: estado.puedeReintentar,
        certificadoPendientePago: estado.certificadoPendientePago,
      },
    });
  }

  if (!out.length && relaxarMatricula()) {
    const { listarCursosVirtuales } = require('./aulaVirtualCatalogo');
    const publicados = await listarCursosVirtuales({ soloPublicados: true });
    for (const c of publicados) {
      if (!c.tienePaquete) continue;
      const docProg = await obtenerProgresoDoc(numDoc, c.idPrograma);
      const estado = await evaluarAprobacion(numDoc, c.idPrograma);
      out.push({
        ...c,
        matricula: null,
        progreso: mapProgresoPublico(docProg, estado),
        reglas: {
          modoCertificado: estado.modoCertificado,
          pctMinCompletitud: estado.pctMinCompletitud,
          pctMinEvaluaciones: estado.pctMinEvaluaciones,
          intentosMaxEval: estado.intentosMaxEval,
          intentosRestantes: estado.intentosRestantes,
          cumpleCompletitud: estado.cumpleCompletitud,
          cumpleNota: estado.cumpleNota,
          puedeReintentar: estado.puedeReintentar,
        },
      });
    }
  }

  return out;
}

module.exports = {
  verificarAccesoCurso,
  obtenerProgresoDoc,
  evaluarAprobacion,
  reportarProgreso,
  listarMisCursos,
  mapProgresoRespuesta,
  mapIntentosPublicos,
};
