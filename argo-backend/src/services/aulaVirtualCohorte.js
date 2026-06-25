const InscripcionCohorte = require('../models/InscripcionCohorte');
const Cohorte = require('../models/Cohorte');
const ClaseCohorte = require('../models/ClaseCohorte');
const AsistenciaCohorte = require('../models/AsistenciaCohorte');
const MateriaCohorte = require('../models/MateriaCohorte');
const EvaluacionCohorte = require('../models/EvaluacionCohorte');
const IntentoEvaluacionCohorte = require('../models/IntentoEvaluacionCohorte');
const { buscarPrograma } = require('./programaServicio');
const { labelPrograma, marcarAsistenciaMeet, recalcularMateriaAprobada } = require('./cohortesAcademicas');
const { calificar } = require('./cohortesEvaluaciones');
const { materialesParaCohorte } = require('./cohortesMateriales');

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function asegurarInscrito(numDoc, idCohorte) {
  const insc = await InscripcionCohorte.findOne({ numDoc, idCohorte }).lean();
  if (!insc) throw httpError('No está inscrito en esta cohorte', 403);
  return insc;
}

function evaluacionVigente(e) {
  if (e.estado !== 'PUBLICADA') return false;
  const ahora = new Date();
  if (e.fechaApertura && ahora < new Date(e.fechaApertura)) return false;
  if (e.fechaCierre && ahora > new Date(e.fechaCierre)) return false;
  return true;
}

/** Quita la marca de opción correcta para enviar la evaluación al alumno. */
function preguntasParaAlumno(evaluacion) {
  return (evaluacion.preguntas || []).map((p) => ({
    idPregunta: String(p._id),
    enunciado: p.enunciado,
    tipo: p.tipo,
    puntos: p.puntos,
    opciones: (p.opciones || []).map((o) => ({ texto: o.texto })),
  }));
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Cohortes en las que está inscrito el alumno, con su avance por materia. */
async function misClasesPresenciales(numDoc) {
  const inscripciones = await InscripcionCohorte.find({ numDoc }).sort({ fechaInscripcion: -1 }).lean();
  if (!inscripciones.length) return [];

  const out = [];
  for (const insc of inscripciones) {
    const cohorte = await Cohorte.findById(insc.idCohorte).lean();
    if (!cohorte) continue;
    const prog = await buscarPrograma(cohorte.idProg);

    const [materias, asistencias, totalClases] = await Promise.all([
      MateriaCohorte.find({ idProg: cohorte.idProg, numSemestre: cohorte.numSemestre, activo: { $ne: false } })
        .sort({ orden: 1 })
        .lean(),
      AsistenciaCohorte.find({ idCohorte: cohorte._id, numDoc }).lean(),
      ClaseCohorte.countDocuments({ idCohorte: cohorte._id }),
    ]);

    const horasPorMateria = new Map();
    for (const a of asistencias) {
      const k = String(a.idMateria);
      horasPorMateria.set(k, num(horasPorMateria.get(k)) + num(a.horasConsumidas));
    }
    const presentes = asistencias.filter((a) => a.estado === 'PRESENTE').length;

    const materiasAvance = materias.map((m) => {
      const cubiertas = num(horasPorMateria.get(String(m._id)));
      const total = num(m.horas);
      return {
        idMateria: String(m._id),
        nombre: m.nombre,
        horas: total,
        horasCubiertas: cubiertas,
        pct: total > 0 ? Math.min(100, Math.round((cubiertas / total) * 100)) : 0,
      };
    });

    const horasTotal = materias.reduce((acc, m) => acc + num(m.horas), 0);
    const horasCubiertas = materiasAvance.reduce((acc, m) => acc + m.horasCubiertas, 0);

    out.push({
      idCohorte: String(cohorte._id),
      idProg: cohorte.idProg,
      nombreProg: labelPrograma(prog),
      cohorteNombre: cohorte.nombre || cohorte.codigo,
      codigo: cohorte.codigo,
      numSemestre: cohorte.numSemestre,
      anio: cohorte.anio,
      periodo: cohorte.periodo,
      estado: cohorte.estado,
      estadoInscripcion: insc.estado,
      totalClases,
      clasesPresente: presentes,
      horasTotal,
      horasCubiertas,
      pctAvance: horasTotal > 0 ? Math.min(100, Math.round((horasCubiertas / horasTotal) * 100)) : 0,
      materias: materiasAvance,
    });
  }
  return out;
}

/** Calendario de clases de una cohorte con la asistencia propia del alumno. */
async function calendarioCohorte(numDoc, idCohorte) {
  const insc = await InscripcionCohorte.findOne({ numDoc, idCohorte }).lean();
  if (!insc) {
    const err = new Error('No está inscrito en esta cohorte');
    err.status = 403;
    throw err;
  }
  const cohorte = await Cohorte.findById(idCohorte).lean();
  const [clases, materias, asistencias] = await Promise.all([
    ClaseCohorte.find({ idCohorte }).sort({ fechaClase: 1 }).lean(),
    MateriaCohorte.find({ idProg: cohorte.idProg, numSemestre: cohorte.numSemestre }).lean(),
    AsistenciaCohorte.find({ idCohorte, numDoc }).lean(),
  ]);
  const matMap = new Map(materias.map((m) => [String(m._id), m]));
  const asisMap = new Map(asistencias.map((a) => [String(a.idClase), a]));

  return {
    idCohorte: String(idCohorte),
    cohorteNombre: cohorte.nombre || cohorte.codigo,
    clases: clases.map((c) => {
      const a = asisMap.get(String(c._id));
      return {
        idClase: String(c._id),
        materiaNombre: matMap.get(String(c.idMateria))?.nombre || '—',
        fechaClase: c.fechaClase,
        horaDesde: c.horaDesde,
        horaHasta: c.horaHasta,
        urlMeet: c.urlMeet || '',
        estado: c.estado,
        miAsistencia: a?.estado || 'PENDIENTE',
      };
    }),
  };
}

/** Marca asistencia al entrar al Meet desde el portal. */
async function asistirMeet(numDoc, idClase) {
  return marcarAsistenciaMeet(idClase, numDoc, 'portal');
}

/* ------------------------------------------------------------------ */
/* Evaluaciones del alumno                                             */
/* ------------------------------------------------------------------ */

/** Lista las evaluaciones publicadas de una cohorte con el estado del alumno. */
async function evaluacionesAlumno(numDoc, idCohorte) {
  await asegurarInscrito(numDoc, idCohorte);
  const [evals, intentos] = await Promise.all([
    EvaluacionCohorte.find({ idCohorte, estado: { $ne: 'BORRADOR' } }).sort({ createdAt: -1 }).lean(),
    IntentoEvaluacionCohorte.find({ idCohorte, numDoc }).lean(),
  ]);
  const matIds = [...new Set(evals.map((e) => e.idMateria).filter(Boolean).map(String))];
  const matDocs = matIds.length
    ? await MateriaCohorte.find({ _id: { $in: matIds } }).select('nombre').lean()
    : [];
  const matMap = new Map(matDocs.map((m) => [String(m._id), m.nombre]));

  return evals.map((e) => {
    const mios = intentos.filter((i) => String(i.idEvaluacion) === String(e._id));
    const calificados = mios.filter((i) => i.estado === 'CALIFICADO');
    const mejor = calificados.length ? Math.max(...calificados.map((i) => Number(i.nota) || 0)) : null;
    const enCurso = mios.find((i) => i.estado === 'EN_CURSO');
    const intentosUsados = mios.length;
    return {
      idEvaluacion: String(e._id),
      titulo: e.titulo,
      descripcion: e.descripcion,
      materiaNombre: e.idMateria ? matMap.get(String(e.idMateria)) || '—' : 'General',
      numPreguntas: e.preguntas?.length || 0,
      notaAprobacion: e.notaAprobacion,
      duracionMin: e.duracionMin,
      intentosPermitidos: e.intentosPermitidos,
      intentosUsados,
      vigente: evaluacionVigente(e),
      estado: e.estado,
      fechaApertura: e.fechaApertura,
      fechaCierre: e.fechaCierre,
      miMejorNota: mejor,
      aprobado: mejor != null ? mejor >= e.notaAprobacion : false,
      tieneIntentoEnCurso: !!enCurso,
      idIntentoEnCurso: enCurso ? String(enCurso._id) : null,
      puedeIniciar: evaluacionVigente(e) && intentosUsados < e.intentosPermitidos && !enCurso,
    };
  });
}

/** Inicia (o retoma) un intento y devuelve las preguntas sin las respuestas correctas. */
async function iniciarIntento(numDoc, idEvaluacion) {
  const e = await EvaluacionCohorte.findById(idEvaluacion).lean();
  if (!e) throw httpError('Evaluación no encontrada', 404);
  await asegurarInscrito(numDoc, e.idCohorte);
  if (!evaluacionVigente(e)) throw httpError('La evaluación no está disponible en este momento');

  let intento = await IntentoEvaluacionCohorte.findOne({ idEvaluacion, numDoc, estado: 'EN_CURSO' });
  if (!intento) {
    const previos = await IntentoEvaluacionCohorte.countDocuments({ idEvaluacion, numDoc });
    if (previos >= e.intentosPermitidos) throw httpError('Ya agotó los intentos permitidos');
    intento = await IntentoEvaluacionCohorte.create({
      idEvaluacion,
      idCohorte: e.idCohorte,
      idMateria: e.idMateria || null,
      numDoc,
      numeroIntento: previos + 1,
      estado: 'EN_CURSO',
      fechaInicio: new Date(),
    });
  }

  return {
    idIntento: String(intento._id),
    idEvaluacion: String(e._id),
    titulo: e.titulo,
    descripcion: e.descripcion,
    duracionMin: e.duracionMin,
    numeroIntento: intento.numeroIntento,
    fechaInicio: intento.fechaInicio,
    preguntas: preguntasParaAlumno(e),
  };
}

/** Recibe respuestas, califica y guarda el intento. */
async function enviarIntento(numDoc, idEvaluacion, respuestas, usuario = 'portal') {
  const e = await EvaluacionCohorte.findById(idEvaluacion).lean();
  if (!e) throw httpError('Evaluación no encontrada', 404);
  await asegurarInscrito(numDoc, e.idCohorte);

  const intento = await IntentoEvaluacionCohorte.findOne({ idEvaluacion, numDoc, estado: 'EN_CURSO' });
  if (!intento) throw httpError('No tiene un intento en curso. Inícielo primero.');

  const res = calificar(e, respuestas);
  intento.respuestas = res.detalle;
  intento.puntajeObtenido = res.puntajeObtenido;
  intento.puntajeTotal = res.puntajeTotal;
  intento.nota = res.nota;
  intento.aprobado = res.nota >= e.notaAprobacion;
  intento.estado = 'CALIFICADO';
  intento.fechaEnvio = new Date();
  await intento.save();

  // Realimenta la nota de la materia (si la evaluación está ligada a una).
  if (e.idMateria) {
    const cohorte = await Cohorte.findById(e.idCohorte).lean();
    const materia = await MateriaCohorte.findById(e.idMateria).lean();
    await recalcularMateriaAprobada(numDoc, e.idMateria, cohorte, materia, usuario);
  }

  return {
    idIntento: String(intento._id),
    nota: intento.nota,
    aprobado: intento.aprobado,
    puntajeObtenido: intento.puntajeObtenido,
    puntajeTotal: intento.puntajeTotal,
    mostrarResultados: e.mostrarResultados,
    correccion: e.mostrarResultados
      ? e.preguntas.map((p) => {
          const r = res.detalle.find((d) => String(d.idPregunta) === String(p._id));
          return {
            idPregunta: String(p._id),
            enunciado: p.enunciado,
            opciones: (p.opciones || []).map((o, idx) => ({
              texto: o.texto,
              correcta: o.correcta,
              elegida: (r?.seleccion || []).includes(idx),
            })),
            correcta: r?.correcta || false,
          };
        })
      : [],
  };
}

/** Materiales de apoyo visibles para el alumno en una cohorte. */
async function materialesAlumno(numDoc, idCohorte) {
  await asegurarInscrito(numDoc, idCohorte);
  return materialesParaCohorte(idCohorte);
}

module.exports = {
  misClasesPresenciales,
  calendarioCohorte,
  asistirMeet,
  evaluacionesAlumno,
  iniciarIntento,
  enviarIntento,
  materialesAlumno,
};
