const Cohorte = require('../models/Cohorte');
const InscripcionCohorte = require('../models/InscripcionCohorte');
const ClaseCohorte = require('../models/ClaseCohorte');
const AsistenciaCohorte = require('../models/AsistenciaCohorte');
const MateriaCohorte = require('../models/MateriaCohorte');
const MateriaAprobadaCohorte = require('../models/MateriaAprobadaCohorte');
const EvaluacionCohorte = require('../models/EvaluacionCohorte');
const IntentoEvaluacionCohorte = require('../models/IntentoEvaluacionCohorte');
const DatosAlumno = require('../models/DatosAlumno');
const { buscarPrograma } = require('./programaServicio');
const { labelPrograma, nombreCompletoAlumno } = require('./cohortesAcademicas');
const { CRITERIOS_CERTIFICADO_DEFAULT } = require('../constants/cohortesAcademicas');

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Carga los datos base de una cohorte usados por todos los reportes. */
async function cargarContexto(idCohorte) {
  const cohorte = await Cohorte.findById(idCohorte).lean();
  if (!cohorte) throw httpError('Cohorte no encontrada', 404);
  const prog = await buscarPrograma(cohorte.idProg);
  const [inscripciones, clases, materias, asistencias, materiasAprob, evaluaciones, intentos] = await Promise.all([
    InscripcionCohorte.find({ idCohorte, estado: { $ne: 'RETIRADA' } }).lean(),
    ClaseCohorte.find({ idCohorte }).lean(),
    MateriaCohorte.find({ idProg: cohorte.idProg, numSemestre: cohorte.numSemestre, activo: { $ne: false } })
      .sort({ orden: 1 })
      .lean(),
    AsistenciaCohorte.find({ idCohorte }).lean(),
    MateriaAprobadaCohorte.find({ idProg: cohorte.idProg, numSemestre: cohorte.numSemestre }).lean(),
    EvaluacionCohorte.find({ idCohorte, estado: { $ne: 'BORRADOR' } }).lean(),
    IntentoEvaluacionCohorte.find({ idCohorte, estado: 'CALIFICADO' }).lean(),
  ]);
  const numDocs = inscripciones.map((i) => i.numDoc);
  const alumnos = numDocs.length ? await DatosAlumno.find({ numDoc: { $in: numDocs } }).lean() : [];
  return {
    cohorte,
    prog,
    inscripciones,
    clases,
    materias,
    asistencias,
    materiasAprob,
    evaluaciones,
    intentos,
    alMap: new Map(alumnos.map((a) => [a.numDoc, a])),
  };
}

/** Métricas de un alumno dentro de la cohorte. */
function metricasAlumno(numDoc, ctx) {
  const { clases, asistencias, materias, materiasAprob, evaluaciones, intentos } = ctx;
  const realizadas = clases.filter((c) => c.estado === 'REALIZADA').length;
  const misAsis = asistencias.filter((a) => a.numDoc === numDoc);
  const presentes = misAsis.filter((a) => a.estado === 'PRESENTE' || a.estado === 'JUSTIFICADO').length;
  const asistenciaPct = realizadas > 0 ? Math.round((presentes / realizadas) * 100) : 0;

  const misMaterias = materiasAprob.filter((m) => m.numDoc === numDoc);
  const aprobadas = misMaterias.filter((m) => m.aprobada).length;
  const notas = misMaterias.map((m) => m.nota).filter((n) => n != null && Number.isFinite(n));
  const notaPromedio = notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : null;

  const misIntentos = intentos.filter((i) => i.numDoc === numDoc);
  const evalIds = new Set(misIntentos.map((i) => String(i.idEvaluacion)));
  const evaluacionesPendientes = evaluaciones.filter((e) => !evalIds.has(String(e._id))).length;

  return {
    realizadas,
    presentes,
    asistenciaPct,
    totalMaterias: materias.length,
    aprobadas,
    notaPromedio,
    totalEvaluaciones: evaluaciones.length,
    evaluacionesPresentadas: evalIds.size,
    evaluacionesPendientes,
  };
}

/** Elegibilidad de certificado por criterios de la cohorte. */
async function elegibilidadCertificado(idCohorte) {
  const ctx = await cargarContexto(idCohorte);
  const crit = { ...CRITERIOS_CERTIFICADO_DEFAULT, ...(ctx.cohorte.criteriosCertificado || {}) };

  const filas = ctx.inscripciones.map((i) => {
    const m = metricasAlumno(i.numDoc, ctx);
    const motivos = [];
    if (m.asistenciaPct < crit.minAsistenciaPct)
      motivos.push(`Asistencia ${m.asistenciaPct}% < ${crit.minAsistenciaPct}%`);
    if (crit.minNotaPromedio > 0) {
      if (m.notaPromedio == null) motivos.push('Sin nota promedio');
      else if (m.notaPromedio < crit.minNotaPromedio)
        motivos.push(`Nota ${m.notaPromedio} < ${crit.minNotaPromedio}`);
    }
    if (crit.requiereTodasMaterias && m.aprobadas < m.totalMaterias)
      motivos.push(`Materias ${m.aprobadas}/${m.totalMaterias}`);
    if (crit.requiereEvaluaciones && m.evaluacionesPendientes > 0)
      motivos.push(`${m.evaluacionesPendientes} evaluación(es) pendiente(s)`);

    return {
      numDoc: i.numDoc,
      nombreCompleto: nombreCompletoAlumno(ctx.alMap.get(i.numDoc)) || `Doc ${i.numDoc}`,
      estadoInscripcion: i.estado,
      asistenciaPct: m.asistenciaPct,
      notaPromedio: m.notaPromedio,
      materias: `${m.aprobadas}/${m.totalMaterias}`,
      evaluacionesPendientes: m.evaluacionesPendientes,
      apto: motivos.length === 0,
      motivos,
    };
  });

  return {
    idCohorte: String(idCohorte),
    cohorteNombre: ctx.cohorte.nombre || ctx.cohorte.codigo,
    nombreProg: labelPrograma(ctx.prog),
    criterios: crit,
    certificadoModo: ctx.cohorte.certificadoModo,
    totalInscritos: filas.length,
    aptos: filas.filter((f) => f.apto).length,
    filas,
  };
}

/** Marca como FINALIZADA la inscripción de los alumnos aptos. */
async function finalizarAptos(idCohorte, usuario) {
  const eleg = await elegibilidadCertificado(idCohorte);
  const aptos = eleg.filas.filter((f) => f.apto).map((f) => f.numDoc);
  if (aptos.length) {
    await InscripcionCohorte.updateMany(
      { idCohorte, numDoc: { $in: aptos } },
      { $set: { estado: 'FINALIZADA', userChangeRecord: usuario } },
    );
  }
  return { finalizados: aptos.length, aptos, totalInscritos: eleg.totalInscritos };
}

/** Acta de notas: alumno × materia (nota y aprobación) + promedio final. */
async function actaNotas(idCohorte) {
  const ctx = await cargarContexto(idCohorte);

  const filas = ctx.inscripciones.map((i) => {
    const celdas = ctx.materias.map((mat) => {
      const reg = ctx.materiasAprob.find(
        (m) => m.numDoc === i.numDoc && String(m.idMateria) === String(mat._id),
      );
      return { idMateria: String(mat._id), nota: reg?.nota ?? null, aprobada: reg?.aprobada || false };
    });
    const notas = celdas.map((c) => c.nota).filter((n) => n != null);
    const promedio = notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : null;
    return {
      numDoc: i.numDoc,
      nombreCompleto: nombreCompletoAlumno(ctx.alMap.get(i.numDoc)) || `Doc ${i.numDoc}`,
      celdas,
      promedio,
      aprobadas: celdas.filter((c) => c.aprobada).length,
    };
  });

  return {
    idCohorte: String(idCohorte),
    cohorteNombre: ctx.cohorte.nombre || ctx.cohorte.codigo,
    nombreProg: labelPrograma(ctx.prog),
    materias: ctx.materias.map((m) => ({ idMateria: String(m._id), nombre: m.nombre, horas: m.horas })),
    filas,
  };
}

/** Reporte de asistencia: alumno × clase. */
async function reporteAsistencia(idCohorte) {
  const ctx = await cargarContexto(idCohorte);
  const matMap = new Map(ctx.materias.map((m) => [String(m._id), m.nombre]));
  const clasesOrden = [...ctx.clases].sort((a, b) => new Date(a.fechaClase) - new Date(b.fechaClase));
  const asisMap = new Map();
  for (const a of ctx.asistencias) asisMap.set(`${a.numDoc}|${String(a.idClase)}`, a.estado);

  const filas = ctx.inscripciones.map((i) => {
    const celdas = clasesOrden.map((c) => ({
      idClase: String(c._id),
      estado: asisMap.get(`${i.numDoc}|${String(c._id)}`) || (c.estado === 'REALIZADA' ? 'AUSENTE' : 'PENDIENTE'),
    }));
    const realizadas = clasesOrden.filter((c) => c.estado === 'REALIZADA').length;
    const presentes = celdas.filter((x) => x.estado === 'PRESENTE' || x.estado === 'JUSTIFICADO').length;
    return {
      numDoc: i.numDoc,
      nombreCompleto: nombreCompletoAlumno(ctx.alMap.get(i.numDoc)) || `Doc ${i.numDoc}`,
      celdas,
      pct: realizadas > 0 ? Math.round((presentes / realizadas) * 100) : 0,
    };
  });

  return {
    idCohorte: String(idCohorte),
    cohorteNombre: ctx.cohorte.nombre || ctx.cohorte.codigo,
    clases: clasesOrden.map((c) => ({
      idClase: String(c._id),
      fechaClase: c.fechaClase,
      materiaNombre: matMap.get(String(c.idMateria)) || '—',
      estado: c.estado,
    })),
    filas,
  };
}

module.exports = {
  elegibilidadCertificado,
  finalizarAptos,
  actaNotas,
  reporteAsistencia,
};
