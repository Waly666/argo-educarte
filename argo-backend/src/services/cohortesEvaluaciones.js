const PreguntaBancoCohorte = require('../models/PreguntaBancoCohorte');
const EvaluacionCohorte = require('../models/EvaluacionCohorte');
const IntentoEvaluacionCohorte = require('../models/IntentoEvaluacionCohorte');
const Cohorte = require('../models/Cohorte');
const MateriaCohorte = require('../models/MateriaCohorte');
const InscripcionCohorte = require('../models/InscripcionCohorte');
const DatosAlumno = require('../models/DatosAlumno');
const { parseNumDoc } = require('../utils/numDoc');
const { recalcularMateriaAprobada, nombreCompletoAlumno } = require('./cohortesAcademicas');

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizarOpciones(opciones, tipo) {
  const list = (Array.isArray(opciones) ? opciones : [])
    .map((o) => ({ texto: String(o?.texto || '').trim(), correcta: o?.correcta === true || o?.correcta === 'true' }))
    .filter((o) => o.texto);
  if (tipo === 'VF' && !list.length) {
    return [
      { texto: 'Verdadero', correcta: false },
      { texto: 'Falso', correcta: false },
    ];
  }
  return list;
}

/* ------------------------------------------------------------------ */
/* Banco de preguntas                                                  */
/* ------------------------------------------------------------------ */

async function listarBanco(filtros = {}) {
  const q = {};
  if (filtros.idMateriaCatalogo) q.idMateriaCatalogo = filtros.idMateriaCatalogo;
  if (filtros.soloActivas === 'true') q.activo = { $ne: false };
  const rows = await PreguntaBancoCohorte.find(q).sort({ updatedAt: -1 }).lean();
  return rows.map((r) => ({
    ...r,
    _id: String(r._id),
    idMateriaCatalogo: r.idMateriaCatalogo ? String(r.idMateriaCatalogo) : null,
  }));
}

async function crearPregunta(body, usuario) {
  if (!body?.idMateriaCatalogo) throw httpError('Seleccione una materia del catálogo');
  if (!String(body?.enunciado || '').trim()) throw httpError('El enunciado es obligatorio');
  const tipo = ['UNICA', 'MULTIPLE', 'VF'].includes(body.tipo) ? body.tipo : 'UNICA';
  const opciones = normalizarOpciones(body.opciones, tipo);
  if (!opciones.some((o) => o.correcta)) throw httpError('Marque al menos una opción correcta');
  const doc = await PreguntaBancoCohorte.create({
    idMateriaCatalogo: body.idMateriaCatalogo,
    enunciado: String(body.enunciado).trim(),
    tipo,
    opciones,
    explicacion: String(body.explicacion || '').trim(),
    dificultad: Math.max(1, Math.min(3, num(body.dificultad) || 1)),
    activo: body.activo !== false,
    userAddReg: usuario,
  });
  return { ...doc.toObject(), _id: String(doc._id) };
}

async function actualizarPregunta(id, body, usuario) {
  const p = await PreguntaBancoCohorte.findById(id);
  if (!p) throw httpError('Pregunta no encontrada', 404);
  if (body.enunciado !== undefined) p.enunciado = String(body.enunciado).trim();
  if (body.tipo !== undefined && ['UNICA', 'MULTIPLE', 'VF'].includes(body.tipo)) p.tipo = body.tipo;
  if (body.idMateriaCatalogo !== undefined && body.idMateriaCatalogo) p.idMateriaCatalogo = body.idMateriaCatalogo;
  if (body.opciones !== undefined) {
    const opciones = normalizarOpciones(body.opciones, p.tipo);
    if (!opciones.some((o) => o.correcta)) throw httpError('Marque al menos una opción correcta');
    p.opciones = opciones;
  }
  if (body.explicacion !== undefined) p.explicacion = String(body.explicacion).trim();
  if (body.dificultad !== undefined) p.dificultad = Math.max(1, Math.min(3, num(body.dificultad) || 1));
  if (body.activo !== undefined) p.activo = body.activo !== false;
  p.userChangeRecord = usuario;
  await p.save();
  return { ...p.toObject(), _id: String(p._id) };
}

async function eliminarPregunta(id) {
  await PreguntaBancoCohorte.deleteOne({ _id: id });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Evaluaciones (ERP)                                                  */
/* ------------------------------------------------------------------ */

function preguntaBancoASnapshot(p) {
  return {
    idBanco: p._id,
    enunciado: p.enunciado,
    tipo: p.tipo,
    opciones: (p.opciones || []).map((o) => ({ texto: o.texto, correcta: o.correcta })),
    puntos: 1,
  };
}

function snapshotDesdeBody(preguntas) {
  return (Array.isArray(preguntas) ? preguntas : [])
    .map((p) => {
      const tipo = ['UNICA', 'MULTIPLE', 'VF'].includes(p.tipo) ? p.tipo : 'UNICA';
      return {
        idBanco: p.idBanco || null,
        enunciado: String(p.enunciado || '').trim(),
        tipo,
        opciones: normalizarOpciones(p.opciones, tipo),
        puntos: Math.max(0, num(p.puntos) || 1),
      };
    })
    .filter((p) => p.enunciado && p.opciones.length);
}

async function listarEvaluaciones(idCohorte) {
  const rows = await EvaluacionCohorte.find({ idCohorte }).sort({ createdAt: -1 }).lean();
  const materias = await MateriaCohorte.find({
    _id: { $in: rows.map((r) => r.idMateria).filter(Boolean) },
  })
    .select('nombre')
    .lean();
  const matMap = new Map(materias.map((m) => [String(m._id), m.nombre]));
  return rows.map((r) => ({
    _id: String(r._id),
    idCohorte: String(r.idCohorte),
    idMateria: r.idMateria ? String(r.idMateria) : null,
    materiaNombre: r.idMateria ? matMap.get(String(r.idMateria)) || '—' : 'General',
    titulo: r.titulo,
    estado: r.estado,
    modoPreguntas: r.modoPreguntas,
    numPreguntas: r.preguntas?.length || 0,
    numPreguntasBanco: r.numPreguntasBanco,
    pesoNota: r.pesoNota,
    tipoEvaluacion: r.tipoEvaluacion || 'PARCIAL',
    notaAprobacion: r.notaAprobacion,
    fechaApertura: r.fechaApertura,
    fechaCierre: r.fechaCierre,
  }));
}

async function obtenerEvaluacion(id) {
  const e = await EvaluacionCohorte.findById(id).lean();
  if (!e) throw httpError('Evaluación no encontrada', 404);
  return { ...e, _id: String(e._id), idCohorte: String(e.idCohorte), idMateria: e.idMateria ? String(e.idMateria) : null };
}

async function crearEvaluacion(idCohorte, body, usuario) {
  const cohorte = await Cohorte.findById(idCohorte).lean();
  if (!cohorte) throw httpError('Cohorte no encontrada', 404);
  if (!String(body?.titulo || '').trim()) throw httpError('El título es obligatorio');
  const doc = await EvaluacionCohorte.create({
    idCohorte,
    idProg: cohorte.idProg,
    numSemestre: cohorte.numSemestre,
    idMateria: body.idMateria || null,
    titulo: String(body.titulo).trim(),
    descripcion: String(body.descripcion || '').trim(),
    modoPreguntas: ['MANUAL', 'BANCO_ALEATORIO'].includes(body.modoPreguntas) ? body.modoPreguntas : 'MANUAL',
    numPreguntasBanco: Math.max(0, num(body.numPreguntasBanco)),
    preguntas: snapshotDesdeBody(body.preguntas),
    pesoNota: Math.max(0, Math.min(100, num(body.pesoNota) || 100)),
    tipoEvaluacion: ['PARCIAL', 'FINAL', 'GENERAL'].includes(body.tipoEvaluacion)
      ? body.tipoEvaluacion
      : 'PARCIAL',
    notaAprobacion: Math.max(0, Math.min(100, num(body.notaAprobacion) || 60)),
    duracionMin: Math.max(0, num(body.duracionMin)),
    intentosPermitidos: Math.max(1, num(body.intentosPermitidos) || 1),
    fechaApertura: body.fechaApertura ? new Date(body.fechaApertura) : null,
    fechaCierre: body.fechaCierre ? new Date(body.fechaCierre) : null,
    mostrarResultados: body.mostrarResultados !== false,
    userAddReg: usuario,
  });
  return obtenerEvaluacion(doc._id);
}

async function actualizarEvaluacion(id, body, usuario) {
  const e = await EvaluacionCohorte.findById(id);
  if (!e) throw httpError('Evaluación no encontrada', 404);
  if (e.estado === 'CERRADA') throw httpError('La evaluación está cerrada y no se puede editar');
  const campos = ['titulo', 'descripcion'];
  for (const k of campos) if (body[k] !== undefined) e[k] = String(body[k]).trim();
  if (body.idMateria !== undefined) e.idMateria = body.idMateria || null;
  if (body.modoPreguntas !== undefined && ['MANUAL', 'BANCO_ALEATORIO'].includes(body.modoPreguntas))
    e.modoPreguntas = body.modoPreguntas;
  if (body.numPreguntasBanco !== undefined) e.numPreguntasBanco = Math.max(0, num(body.numPreguntasBanco));
  if (body.preguntas !== undefined) e.preguntas = snapshotDesdeBody(body.preguntas);
  if (body.pesoNota !== undefined) e.pesoNota = Math.max(0, Math.min(100, num(body.pesoNota)));
  if (body.tipoEvaluacion !== undefined && ['PARCIAL', 'FINAL', 'GENERAL'].includes(body.tipoEvaluacion))
    e.tipoEvaluacion = body.tipoEvaluacion;
  if (body.notaAprobacion !== undefined) e.notaAprobacion = Math.max(0, Math.min(100, num(body.notaAprobacion)));
  if (body.duracionMin !== undefined) e.duracionMin = Math.max(0, num(body.duracionMin));
  if (body.intentosPermitidos !== undefined) e.intentosPermitidos = Math.max(1, num(body.intentosPermitidos) || 1);
  if (body.fechaApertura !== undefined) e.fechaApertura = body.fechaApertura ? new Date(body.fechaApertura) : null;
  if (body.fechaCierre !== undefined) e.fechaCierre = body.fechaCierre ? new Date(body.fechaCierre) : null;
  if (body.mostrarResultados !== undefined) e.mostrarResultados = body.mostrarResultados !== false;
  e.userChangeRecord = usuario;
  await e.save();
  return obtenerEvaluacion(e._id);
}

async function publicarEvaluacion(id, usuario) {
  const e = await EvaluacionCohorte.findById(id);
  if (!e) throw httpError('Evaluación no encontrada', 404);

  // Si es por banco aleatorio, materializa las preguntas ahora.
  if (e.modoPreguntas === 'BANCO_ALEATORIO') {
    if (!e.idMateria) throw httpError('Para usar el banco, asigne una materia a la evaluación');
    const materia = await MateriaCohorte.findById(e.idMateria).select('idMateriaCatalogo nombre').lean();
    if (!materia?.idMateriaCatalogo)
      throw httpError('La materia no está enlazada al catálogo; no hay banco de preguntas asociado');
    const banco = await PreguntaBancoCohorte.find({
      idMateriaCatalogo: materia.idMateriaCatalogo,
      activo: { $ne: false },
    }).lean();
    if (!banco.length) throw httpError('No hay preguntas en el banco para esta materia');
    const n = Math.min(e.numPreguntasBanco || banco.length, banco.length);
    const mezclado = banco.sort(() => Math.random() - 0.5).slice(0, n);
    e.preguntas = mezclado.map(preguntaBancoASnapshot);
  }

  if (!e.preguntas.length) throw httpError('La evaluación no tiene preguntas');
  e.estado = 'PUBLICADA';
  e.userChangeRecord = usuario;
  await e.save();
  return obtenerEvaluacion(e._id);
}

async function cerrarEvaluacion(id, usuario) {
  const e = await EvaluacionCohorte.findById(id);
  if (!e) throw httpError('Evaluación no encontrada', 404);
  e.estado = 'CERRADA';
  e.userChangeRecord = usuario;
  await e.save();
  return obtenerEvaluacion(e._id);
}

async function eliminarEvaluacion(id) {
  const tieneIntentos = await IntentoEvaluacionCohorte.exists({ idEvaluacion: id });
  if (tieneIntentos) throw httpError('No se puede eliminar: ya tiene intentos de alumnos. Ciérrela en su lugar.');
  await EvaluacionCohorte.deleteOne({ _id: id });
  return { ok: true };
}

/** Resultados de una evaluación: por alumno inscrito, su mejor intento. */
async function resultadosEvaluacion(id) {
  const e = await EvaluacionCohorte.findById(id).lean();
  if (!e) throw httpError('Evaluación no encontrada', 404);
  const [inscripciones, intentos] = await Promise.all([
    InscripcionCohorte.find({ idCohorte: e.idCohorte, estado: 'ACTIVA' }).lean(),
    IntentoEvaluacionCohorte.find({ idEvaluacion: id }).lean(),
  ]);
  const numDocs = inscripciones.map((i) => i.numDoc);
  const alumnos = numDocs.length ? await DatosAlumno.find({ numDoc: { $in: numDocs } }).lean() : [];
  const alMap = new Map(alumnos.map((a) => [a.numDoc, a]));
  const porAlumno = new Map();
  for (const it of intentos) {
    const prev = porAlumno.get(it.numDoc);
    if (!prev || num(it.nota) > num(prev.nota)) porAlumno.set(it.numDoc, it);
  }
  const filas = inscripciones.map((i) => {
    const it = porAlumno.get(i.numDoc);
    return {
      numDoc: i.numDoc,
      nombreCompleto: nombreCompletoAlumno(alMap.get(i.numDoc)) || `Doc ${i.numDoc}`,
      estado: it ? it.estado : 'SIN_PRESENTAR',
      nota: it ? it.nota : null,
      aprobado: it ? it.aprobado : false,
      intentos: intentos.filter((x) => x.numDoc === i.numDoc).length,
      fechaEnvio: it?.fechaEnvio || null,
    };
  });
  const presentados = filas.filter((f) => f.estado === 'CALIFICADO');
  return {
    idEvaluacion: String(id),
    titulo: e.titulo,
    notaAprobacion: e.notaAprobacion,
    totalInscritos: inscripciones.length,
    presentados: presentados.length,
    aprobados: presentados.filter((f) => f.aprobado).length,
    promedio: presentados.length
      ? Math.round(presentados.reduce((a, b) => a + num(b.nota), 0) / presentados.length)
      : null,
    filas,
  };
}

/* ------------------------------------------------------------------ */
/* Calificación (compartida con el portal del alumno)                  */
/* ------------------------------------------------------------------ */

function indicesCorrectos(opciones) {
  const out = [];
  (opciones || []).forEach((o, i) => {
    if (o.correcta) out.push(i);
  });
  return out;
}

function mismoConjunto(a, b) {
  const sa = [...new Set((a || []).map(Number))].sort((x, y) => x - y);
  const sb = [...new Set((b || []).map(Number))].sort((x, y) => x - y);
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
}

/** Califica un conjunto de respuestas contra las preguntas de la evaluación. */
function calificar(evaluacion, respuestas) {
  const mapResp = new Map((respuestas || []).map((r) => [String(r.idPregunta), r.seleccion || []]));
  let puntajeObtenido = 0;
  let puntajeTotal = 0;
  const detalle = [];
  for (const preg of evaluacion.preguntas) {
    const puntos = num(preg.puntos) || 1;
    puntajeTotal += puntos;
    const sel = mapResp.get(String(preg._id)) || [];
    const correctos = indicesCorrectos(preg.opciones);
    const correcta = mismoConjunto(sel, correctos);
    const obtenidos = correcta ? puntos : 0;
    puntajeObtenido += obtenidos;
    detalle.push({ idPregunta: preg._id, seleccion: sel.map(Number), correcta, puntosObtenidos: obtenidos });
  }
  const nota = puntajeTotal > 0 ? Math.round((puntajeObtenido / puntajeTotal) * 100) : 0;
  return { puntajeObtenido, puntajeTotal, nota, detalle };
}

module.exports = {
  listarBanco,
  crearPregunta,
  actualizarPregunta,
  eliminarPregunta,
  listarEvaluaciones,
  obtenerEvaluacion,
  crearEvaluacion,
  actualizarEvaluacion,
  publicarEvaluacion,
  cerrarEvaluacion,
  eliminarEvaluacion,
  resultadosEvaluacion,
  calificar,
};
