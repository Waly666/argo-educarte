const mongoose = require('mongoose');

const SemestrePrograma = require('../models/SemestrePrograma');
const MateriaCohorte = require('../models/MateriaCohorte');
const CatalogoMateria = require('../models/CatalogoMateria');
const Cohorte = require('../models/Cohorte');
const InscripcionCohorte = require('../models/InscripcionCohorte');
const ClaseCohorte = require('../models/ClaseCohorte');
const AsistenciaCohorte = require('../models/AsistenciaCohorte');
const MateriaAprobadaCohorte = require('../models/MateriaAprobadaCohorte');
const EvaluacionCohorte = require('../models/EvaluacionCohorte');
const IntentoEvaluacionCohorte = require('../models/IntentoEvaluacionCohorte');
const Matricula = require('../models/Matricula');
const DatosAlumno = require('../models/DatosAlumno');
const Empleado = require('../models/Empleado');
const Cargo = require('../models/Cargo');
const { models: cat } = require('../models/catalogos');
const { buscarPrograma, idProgDePrograma } = require('./programaServicio');
const { nombreEmpleado } = require('./instructorJornada');
const { parseNumDoc, numDocQuery } = require('../utils/numDoc');
const {
  ESTADOS_COHORTE_INSCRIBIBLE,
  NOTA_MINIMA_APROBACION_DEFAULT,
} = require('../constants/cohortesAcademicas');

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function nombreCompletoAlumno(a) {
  if (!a) return '';
  return [a.nombre1, a.nombre2, a.apellido1, a.apellido2].filter(Boolean).join(' ').trim();
}

function labelPrograma(prog) {
  if (!prog) return '';
  return (prog.nombreProg || prog.nomCert || prog.descripcion || '').trim();
}

/** Nº de semestres del programa (al menos 1). */
function numSemestresPrograma(prog) {
  const n = Math.floor(Number(prog?.semestres));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/* ------------------------------------------------------------------ */
/* Instructores (empleados con cargo instructor)                       */
/* ------------------------------------------------------------------ */

async function listarInstructores() {
  const empleados = await Empleado.find({ estado: { $not: /^inactivo$/i } }).lean();
  const cargoIds = [...new Set(empleados.map((e) => e.cargoId).filter((x) => x != null))];
  const cargos = cargoIds.length ? await Cargo.find({ idCargo: { $in: cargoIds } }).lean() : [];
  const cargoMap = new Map(cargos.map((c) => [c.idCargo, String(c.nombre || '')]));

  const instructores = empleados
    .filter((e) => /\binstructor/i.test(cargoMap.get(e.cargoId) || ''))
    .map((e) => ({
      idEmpleado: e.idEmpleado,
      nombreCompleto: nombreEmpleado(e) || `Empleado ${e.idEmpleado}`,
      cargo: cargoMap.get(e.cargoId) || '',
    }));

  instructores.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'));
  return instructores;
}

/** Mapa idEmpleado -> nombre completo para un conjunto de ids. */
async function mapaInstructores(ids) {
  const limpios = [...new Set((ids || []).filter((x) => x != null).map(Number))];
  if (!limpios.length) return new Map();
  const emps = await Empleado.find({ idEmpleado: { $in: limpios } }).lean();
  return new Map(emps.map((e) => [Number(e.idEmpleado), nombreEmpleado(e) || `Empleado ${e.idEmpleado}`]));
}

/* ------------------------------------------------------------------ */
/* Programas que usan cohortes                                         */
/* ------------------------------------------------------------------ */

async function listarProgramasCohorte() {
  const rows = await cat.programas
    .find({ usaCohortes: true, estado: { $ne: 'INACTIVO' } })
    .lean();
  return rows.map((p) => ({
    idProg: String(idProgDePrograma(p)),
    codigoProg: p.codigoProg || '',
    nombreProg: labelPrograma(p),
    horas: num(p.horas),
    semestres: numSemestresPrograma(p),
  }));
}

/* ------------------------------------------------------------------ */
/* Catálogo (banco) de materias/temas global                          */
/* ------------------------------------------------------------------ */

async function listarCatalogoMaterias(filtros = {}) {
  const q = {};
  if (filtros.q) q.nombre = new RegExp(String(filtros.q).trim(), 'i');
  if (filtros.soloActivas !== 'false') q.activo = { $ne: false };
  const rows = await CatalogoMateria.find(q).sort({ nombre: 1 }).lean();
  return rows.map((r) => ({ ...r, _id: String(r._id) }));
}

async function crearMateriaCatalogo(body, usuario) {
  const nombre = String(body?.nombre || '').trim();
  if (!nombre) throw httpError('El nombre de la materia es obligatorio');
  const dup = await CatalogoMateria.findOne({ nombre }).collation({ locale: 'es', strength: 2 }).lean();
  if (dup) throw httpError('Ya existe una materia con ese nombre en el catálogo', 409);
  const doc = await CatalogoMateria.create({
    nombre,
    area: String(body.area || '').trim(),
    descripcion: String(body.descripcion || '').trim(),
    activo: body.activo !== false,
    userAddReg: usuario,
  });
  return { ...doc.toObject(), _id: String(doc._id) };
}

async function actualizarMateriaCatalogo(id, body, usuario) {
  const m = await CatalogoMateria.findById(id);
  if (!m) throw httpError('Materia de catálogo no encontrada', 404);
  if (body.nombre !== undefined) {
    const nombre = String(body.nombre).trim();
    if (!nombre) throw httpError('El nombre es obligatorio');
    const dup = await CatalogoMateria.findOne({ nombre, _id: { $ne: id } })
      .collation({ locale: 'es', strength: 2 })
      .lean();
    if (dup) throw httpError('Ya existe otra materia con ese nombre', 409);
    m.nombre = nombre;
  }
  if (body.area !== undefined) m.area = String(body.area).trim();
  if (body.descripcion !== undefined) m.descripcion = String(body.descripcion).trim();
  if (body.activo !== undefined) m.activo = body.activo !== false;
  m.userChangeRecord = usuario;
  await m.save();

  // Propaga el nombre a las materias de programas que la usan (snapshot).
  if (body.nombre !== undefined) {
    await MateriaCohorte.updateMany({ idMateriaCatalogo: id }, { $set: { nombre: m.nombre } });
  }
  return { ...m.toObject(), _id: String(m._id) };
}

async function eliminarMateriaCatalogo(id) {
  const enUso = await MateriaCohorte.exists({ idMateriaCatalogo: id });
  if (enUso) {
    // No se borra: se desactiva para no romper planes existentes.
    await CatalogoMateria.updateOne({ _id: id }, { $set: { activo: false } });
    return { ok: true, desactivada: true };
  }
  await CatalogoMateria.deleteOne({ _id: id });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Plan: semestres + materias                                         */
/* ------------------------------------------------------------------ */

async function obtenerPlan(idProgRaw) {
  const prog = await buscarPrograma(idProgRaw);
  if (!prog) throw httpError('Programa no encontrado', 404);
  const idProg = String(idProgDePrograma(prog));
  const totalSemestres = numSemestresPrograma(prog);
  const horasTotal = num(prog.horas);

  const [semestresDb, materiasDb] = await Promise.all([
    SemestrePrograma.find({ idProg }).sort({ numSemestre: 1 }).lean(),
    MateriaCohorte.find({ idProg }).sort({ numSemestre: 1, orden: 1 }).lean(),
  ]);

  const semMap = new Map(semestresDb.map((s) => [s.numSemestre, s]));
  const horasSugeridas = totalSemestres > 0 ? Math.floor(horasTotal / totalSemestres) : 0;

  const semestres = [];
  for (let i = 1; i <= totalSemestres; i++) {
    const s = semMap.get(i);
    const materias = materiasDb
      .filter((m) => m.numSemestre === i)
      .map((m) => ({
        _id: String(m._id),
        idMateriaCatalogo: m.idMateriaCatalogo ? String(m.idMateriaCatalogo) : null,
        nombre: m.nombre,
        horas: num(m.horas),
        orden: m.orden,
        activo: m.activo !== false,
      }));
    semestres.push({
      numSemestre: i,
      horas: s ? num(s.horas) : horasSugeridas,
      materias,
    });
  }

  return {
    idProg,
    nombreProg: labelPrograma(prog),
    horasTotal,
    totalSemestres,
    horasSugeridasPorSemestre: horasSugeridas,
    semestres,
  };
}

/**
 * Guarda semestres y materias. Valida que las materias de cada semestre sumen
 * exactamente las horas del semestre. body.semestres = [{ numSemestre, horas, materias:[{nombre,horas,orden,activo}] }]
 */
async function guardarPlan(idProgRaw, body, usuario) {
  const prog = await buscarPrograma(idProgRaw);
  if (!prog) throw httpError('Programa no encontrado', 404);
  const idProg = String(idProgDePrograma(prog));
  const totalSemestres = numSemestresPrograma(prog);

  const semestresBody = Array.isArray(body?.semestres) ? body.semestres : [];

  // Validación: materias suman exacto las horas del semestre
  for (const sem of semestresBody) {
    const nS = Math.floor(Number(sem.numSemestre));
    if (!Number.isFinite(nS) || nS < 1 || nS > totalSemestres) {
      throw httpError(`Semestre ${sem.numSemestre} fuera de rango (1..${totalSemestres})`);
    }
    const materias = Array.isArray(sem.materias) ? sem.materias : [];
    const horasSem = num(sem.horas);
    const sumaMaterias = materias.reduce((acc, m) => acc + num(m.horas), 0);
    if (materias.length && sumaMaterias !== horasSem) {
      throw httpError(
        `Semestre ${nS}: las materias suman ${sumaMaterias}h pero el semestre tiene ${horasSem}h. Deben coincidir.`,
      );
    }
    for (const m of materias) {
      if (!m.idMateriaCatalogo && !String(m.nombre || '').trim()) {
        throw httpError(`Semestre ${nS}: hay una materia sin seleccionar del catálogo.`);
      }
    }
  }

  // Resuelve nombres desde el catálogo (snapshot) para las materias seleccionadas.
  const idsCatalogo = semestresBody
    .flatMap((s) => (Array.isArray(s.materias) ? s.materias : []))
    .map((m) => m.idMateriaCatalogo)
    .filter((x) => x && mongoose.isValidObjectId(x));
  const catDocs = idsCatalogo.length
    ? await CatalogoMateria.find({ _id: { $in: idsCatalogo } }).lean()
    : [];
  const catMap = new Map(catDocs.map((c) => [String(c._id), c.nombre]));

  // Persistencia: upsert semestres, reemplazo de materias por semestre
  for (const sem of semestresBody) {
    const nS = Math.floor(Number(sem.numSemestre));
    await SemestrePrograma.updateOne(
      { idProg, numSemestre: nS },
      {
        $set: { horas: num(sem.horas), orden: nS, userChangeRecord: usuario },
        $setOnInsert: { userAddReg: usuario },
      },
      { upsert: true },
    );

    const materias = Array.isArray(sem.materias) ? sem.materias : [];
    const idsConservar = [];
    let orden = 1;
    for (const m of materias) {
      const idCat = m.idMateriaCatalogo && mongoose.isValidObjectId(m.idMateriaCatalogo)
        ? m.idMateriaCatalogo
        : null;
      const nombre = idCat ? catMap.get(String(idCat)) || String(m.nombre || '').trim() : String(m.nombre || '').trim();
      const idValido = m._id && mongoose.isValidObjectId(m._id);
      if (idValido) {
        await MateriaCohorte.updateOne(
          { _id: m._id, idProg, numSemestre: nS },
          {
            $set: {
              idMateriaCatalogo: idCat,
              nombre,
              horas: num(m.horas),
              orden: orden,
              activo: m.activo !== false,
              userChangeRecord: usuario,
            },
          },
        );
        idsConservar.push(String(m._id));
      } else {
        const creada = await MateriaCohorte.create({
          idProg,
          numSemestre: nS,
          idMateriaCatalogo: idCat,
          nombre,
          horas: num(m.horas),
          orden,
          activo: m.activo !== false,
          userAddReg: usuario,
        });
        idsConservar.push(String(creada._id));
      }
      orden += 1;
    }
    // Eliminar materias del semestre que ya no están en el body
    await MateriaCohorte.deleteMany({
      idProg,
      numSemestre: nS,
      _id: { $nin: idsConservar.map((id) => new mongoose.Types.ObjectId(id)) },
    });
  }

  return obtenerPlan(idProg);
}

/* ------------------------------------------------------------------ */
/* Cohortes                                                            */
/* ------------------------------------------------------------------ */

function generarCodigoCohorte({ anio, periodo, prog, numSemestre }) {
  const cod = (prog.codigoProg || idProgDePrograma(prog) || 'PROG').toString().toUpperCase();
  return `${anio}-${periodo}-${cod}-S${numSemestre}`;
}

async function listarCohortes(filtros = {}) {
  const q = {};
  if (filtros.idProg) q.idProg = String(filtros.idProg);
  if (filtros.estado) q.estado = filtros.estado;
  if (filtros.anio) q.anio = Number(filtros.anio);
  const rows = await Cohorte.find(q).sort({ anio: -1, periodo: -1, numSemestre: 1 }).lean();
  const instrMap = await mapaInstructores(rows.map((c) => c.idEmpleadoInstructor));
  const out = [];
  for (const c of rows) {
    const prog = await buscarPrograma(c.idProg);
    out.push({
      ...c,
      _id: String(c._id),
      nombreProg: labelPrograma(prog),
      instructorNombre: instrMap.get(Number(c.idEmpleadoInstructor)) || '',
    });
  }
  return out;
}

async function crearCohorte(body, usuario) {
  const prog = await buscarPrograma(body?.idProg);
  if (!prog) throw httpError('Programa no encontrado', 404);
  if (!prog.usaCohortes) throw httpError('El programa no está configurado para usar cohortes');
  const idProg = String(idProgDePrograma(prog));
  const totalSemestres = numSemestresPrograma(prog);

  const numSemestre = Math.floor(Number(body.numSemestre));
  if (!Number.isFinite(numSemestre) || numSemestre < 1 || numSemestre > totalSemestres) {
    throw httpError(`numSemestre debe estar entre 1 y ${totalSemestres}`);
  }
  const anio = Math.floor(Number(body.anio));
  if (!Number.isFinite(anio) || anio < 2000) throw httpError('Año inválido');
  const periodo = Math.max(1, Math.floor(Number(body.periodo) || 1));

  const dup = await Cohorte.findOne({ idProg, numSemestre, anio, periodo }).lean();
  if (dup) throw httpError('Ya existe una cohorte para ese programa, semestre y periodo', 409);

  const codigo = String(body.codigo || '').trim() || generarCodigoCohorte({ anio, periodo, prog, numSemestre });

  const doc = await Cohorte.create({
    idProg,
    numSemestre,
    anio,
    periodo,
    codigo,
    nombre: String(body.nombre || '').trim(),
    idSede: String(body.idSede || '').trim(),
    cupoMaximo: body.cupoMaximo != null && body.cupoMaximo !== '' ? Number(body.cupoMaximo) : null,
    estado: body.estado || undefined,
    fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null,
    fechaFin: body.fechaFin ? new Date(body.fechaFin) : null,
    modoConsumoHoras: body.modoConsumoHoras || undefined,
    certificadoModo: body.certificadoModo || undefined,
    idEmpleadoInstructor: body.idEmpleadoInstructor != null ? Number(body.idEmpleadoInstructor) : null,
    observaciones: String(body.observaciones || '').trim(),
    userAddReg: usuario,
  });
  return { ...doc.toObject(), _id: String(doc._id), nombreProg: labelPrograma(prog) };
}

async function actualizarCohorte(id, body, usuario) {
  const cohorte = await Cohorte.findById(id);
  if (!cohorte) throw httpError('Cohorte no encontrada', 404);
  const set = { userChangeRecord: usuario };
  const campos = ['nombre', 'idSede', 'estado', 'modoConsumoHoras', 'certificadoModo', 'observaciones'];
  for (const k of campos) if (body[k] !== undefined) set[k] = body[k];
  if (body.cupoMaximo !== undefined) {
    set.cupoMaximo = body.cupoMaximo === '' || body.cupoMaximo == null ? null : Number(body.cupoMaximo);
  }
  if (body.fechaInicio !== undefined) set.fechaInicio = body.fechaInicio ? new Date(body.fechaInicio) : null;
  if (body.fechaFin !== undefined) set.fechaFin = body.fechaFin ? new Date(body.fechaFin) : null;
  if (body.idEmpleadoInstructor !== undefined) {
    set.idEmpleadoInstructor =
      body.idEmpleadoInstructor == null || body.idEmpleadoInstructor === ''
        ? null
        : Number(body.idEmpleadoInstructor);
  }
  if (body.criteriosCertificado !== undefined && body.criteriosCertificado) {
    const c = body.criteriosCertificado;
    set.criteriosCertificado = {
      minAsistenciaPct: Math.max(0, Math.min(100, num(c.minAsistenciaPct))),
      minNotaPromedio: Math.max(0, Math.min(100, num(c.minNotaPromedio))),
      requiereTodasMaterias: c.requiereTodasMaterias !== false,
      requiereEvaluaciones: c.requiereEvaluaciones === true,
    };
  }
  await Cohorte.updateOne({ _id: id }, { $set: set });
  const prog = await buscarPrograma(cohorte.idProg);
  const actualizado = await Cohorte.findById(id).lean();
  return { ...actualizado, _id: String(actualizado._id), nombreProg: labelPrograma(prog) };
}

async function detalleCohorte(id) {
  const cohorte = await Cohorte.findById(id).lean();
  if (!cohorte) throw httpError('Cohorte no encontrada', 404);
  const prog = await buscarPrograma(cohorte.idProg);

  const [inscripciones, clases, materias] = await Promise.all([
    InscripcionCohorte.find({ idCohorte: id }).sort({ fechaInscripcion: 1 }).lean(),
    ClaseCohorte.find({ idCohorte: id }).sort({ fechaClase: 1 }).lean(),
    MateriaCohorte.find({ idProg: cohorte.idProg, numSemestre: cohorte.numSemestre, activo: { $ne: false } })
      .sort({ orden: 1 })
      .lean(),
  ]);

  const numDocs = inscripciones.map((i) => i.numDoc);
  const alumnos = numDocs.length ? await DatosAlumno.find({ numDoc: { $in: numDocs } }).lean() : [];
  const alMap = new Map(alumnos.map((a) => [a.numDoc, a]));
  const matMap = new Map(materias.map((m) => [String(m._id), m]));

  const instrMap = await mapaInstructores([
    cohorte.idEmpleadoInstructor,
    ...clases.map((c) => c.idEmpleadoInstructor),
  ]);

  return {
    ...cohorte,
    _id: String(cohorte._id),
    nombreProg: labelPrograma(prog),
    instructorNombre: instrMap.get(Number(cohorte.idEmpleadoInstructor)) || '',
    materias: materias.map((m) => ({
      _id: String(m._id),
      idMateriaCatalogo: m.idMateriaCatalogo ? String(m.idMateriaCatalogo) : null,
      nombre: m.nombre,
      horas: num(m.horas),
      orden: m.orden,
    })),
    inscripciones: inscripciones.map((i) => ({
      _id: String(i._id),
      numDoc: i.numDoc,
      nombreCompleto: nombreCompletoAlumno(alMap.get(i.numDoc)) || `Doc ${i.numDoc}`,
      estado: i.estado,
      fechaInscripcion: i.fechaInscripcion,
    })),
    clases: clases.map((c) => ({
      _id: String(c._id),
      idMateria: String(c.idMateria),
      materiaNombre: matMap.get(String(c.idMateria))?.nombre || '—',
      fechaClase: c.fechaClase,
      horaDesde: c.horaDesde,
      horaHasta: c.horaHasta,
      duracionHoras: c.duracionHoras,
      urlMeet: c.urlMeet,
      sesion: c.sesion,
      estado: c.estado,
      idEmpleadoInstructor: c.idEmpleadoInstructor,
      instructorNombre: instrMap.get(Number(c.idEmpleadoInstructor)) || '',
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Inscripción                                                        */
/* ------------------------------------------------------------------ */

/** Materias aprobadas por el alumno en un semestre del programa. */
async function materiasAprobadasDe(numDoc, idProg, numSemestre) {
  return MateriaAprobadaCohorte.find({ numDoc, idProg, numSemestre, aprobada: true }).lean();
}

/** ¿El alumno aprobó todas las materias del semestre dado? */
async function semestreAprobado(numDoc, idProg, numSemestre) {
  const materias = await MateriaCohorte.find({ idProg, numSemestre, activo: { $ne: false } }).lean();
  if (!materias.length) return true;
  const aprobadas = await materiasAprobadasDe(numDoc, idProg, numSemestre);
  const setAprob = new Set(aprobadas.map((a) => String(a.idMateria)));
  return materias.every((m) => setAprob.has(String(m._id)));
}

async function inscribirAlumno(idCohorte, body, usuario) {
  const cohorte = await Cohorte.findById(idCohorte).lean();
  if (!cohorte) throw httpError('Cohorte no encontrada', 404);
  if (!ESTADOS_COHORTE_INSCRIBIBLE.includes(cohorte.estado)) {
    throw httpError('La cohorte no admite inscripciones en su estado actual');
  }
  const numDoc = parseNumDoc(body?.numDoc);
  if (numDoc == null) throw httpError('numDoc inválido');

  const alumno = await DatosAlumno.findOne(numDocQuery(numDoc)).lean();
  if (!alumno) throw httpError('El alumno no existe en ARGO', 404);

  // Una sola cohorte activa por programa
  const yaActiva = await InscripcionCohorte.findOne({
    numDoc,
    idProg: cohorte.idProg,
    estado: 'ACTIVA',
  }).lean();
  if (yaActiva && String(yaActiva.idCohorte) !== String(idCohorte)) {
    throw httpError('El alumno ya tiene una cohorte activa en este programa');
  }

  const dup = await InscripcionCohorte.findOne({ numDoc, idCohorte }).lean();
  if (dup) throw httpError('El alumno ya está inscrito en esta cohorte', 409);

  // Secuencial: exige semestre anterior aprobado
  if (cohorte.numSemestre > 1) {
    const previoOk = await semestreAprobado(numDoc, cohorte.idProg, cohorte.numSemestre - 1);
    if (!previoOk) {
      throw httpError(`El alumno no ha aprobado el semestre ${cohorte.numSemestre - 1}`);
    }
  }

  // Cupo
  if (cohorte.cupoMaximo != null && cohorte.inscritos >= cohorte.cupoMaximo) {
    throw httpError('La cohorte alcanzó su cupo máximo');
  }

  // Matrícula activa del programa (si existe) para enlazar
  const matricula = await Matricula.findOne({
    ...numDocQuery(numDoc),
    idProg: cohorte.idProg,
  })
    .sort({ fechaMat: -1 })
    .lean();

  const insc = await InscripcionCohorte.create({
    numDoc,
    idCohorte,
    idProg: cohorte.idProg,
    numSemestre: cohorte.numSemestre,
    idMatricula: matricula?._id || null,
    userAddReg: usuario,
  });
  await Cohorte.updateOne({ _id: idCohorte }, { $inc: { inscritos: 1 } });

  return { ...insc.toObject(), _id: String(insc._id), nombreCompleto: nombreCompletoAlumno(alumno) };
}

/** Sugiere la cohorte para auto-inscripción: única abierta del programa+semestre. */
async function cohorteAutoParaInscripcion(idProg, numSemestre) {
  const abiertas = await Cohorte.find({
    idProg: String(idProg),
    numSemestre: Number(numSemestre),
    estado: { $in: ESTADOS_COHORTE_INSCRIBIBLE },
  }).lean();
  return abiertas.length === 1 ? abiertas[0] : null;
}

/* ------------------------------------------------------------------ */
/* Clases (manual + asistente)                                        */
/* ------------------------------------------------------------------ */

async function crearClase(idCohorte, body, usuario) {
  const cohorte = await Cohorte.findById(idCohorte).lean();
  if (!cohorte) throw httpError('Cohorte no encontrada', 404);
  const materia = await MateriaCohorte.findOne({ _id: body?.idMateria, idProg: cohorte.idProg }).lean();
  if (!materia) throw httpError('Materia no encontrada para este programa', 404);
  if (!body.fechaClase) throw httpError('fechaClase es obligatoria');

  const doc = await ClaseCohorte.create({
    idCohorte,
    idMateria: materia._id,
    idProg: cohorte.idProg,
    fechaClase: new Date(body.fechaClase),
    horaDesde: String(body.horaDesde || '').trim(),
    horaHasta: String(body.horaHasta || '').trim(),
    duracionHoras: body.duracionHoras != null && body.duracionHoras !== '' ? Number(body.duracionHoras) : null,
    urlMeet: String(body.urlMeet || '').trim(),
    idEmpleadoInstructor:
      body.idEmpleadoInstructor != null && body.idEmpleadoInstructor !== ''
        ? Number(body.idEmpleadoInstructor)
        : cohorte.idEmpleadoInstructor || null,
    sesion: Math.max(1, Math.floor(Number(body.sesion) || 1)),
    observaciones: String(body.observaciones || '').trim(),
    userAddReg: usuario,
  });
  const instrMap = await mapaInstructores([doc.idEmpleadoInstructor]);
  return {
    ...doc.toObject(),
    _id: String(doc._id),
    materiaNombre: materia.nombre,
    instructorNombre: instrMap.get(Number(doc.idEmpleadoInstructor)) || '',
  };
}

async function actualizarClase(id, body, usuario) {
  const clase = await ClaseCohorte.findById(id);
  if (!clase) throw httpError('Clase no encontrada', 404);
  const set = { userChangeRecord: usuario };
  if (body.fechaClase !== undefined) set.fechaClase = new Date(body.fechaClase);
  for (const k of ['horaDesde', 'horaHasta', 'urlMeet', 'observaciones', 'estado']) {
    if (body[k] !== undefined) set[k] = typeof body[k] === 'string' ? body[k].trim() : body[k];
  }
  if (body.duracionHoras !== undefined) {
    set.duracionHoras = body.duracionHoras === '' || body.duracionHoras == null ? null : Number(body.duracionHoras);
  }
  if (body.idEmpleadoInstructor !== undefined) {
    set.idEmpleadoInstructor =
      body.idEmpleadoInstructor === '' || body.idEmpleadoInstructor == null
        ? null
        : Number(body.idEmpleadoInstructor);
  }
  if (body.sesion !== undefined) set.sesion = Math.max(1, Math.floor(Number(body.sesion) || 1));
  await ClaseCohorte.updateOne({ _id: id }, { $set: set });
  return ClaseCohorte.findById(id).lean();
}

/**
 * Asistente de planificación: genera clases para las materias del semestre de la cohorte.
 * body: { fechaInicio, dias:[1..5], horaDesde, horaHasta, horasPorSesion }
 * Distribuye una clase por bloque hasta cubrir las horas de cada materia.
 */
async function planificarClases(idCohorte, body, usuario) {
  const cohorte = await Cohorte.findById(idCohorte).lean();
  if (!cohorte) throw httpError('Cohorte no encontrada', 404);
  const materias = await MateriaCohorte.find({
    idProg: cohorte.idProg,
    numSemestre: cohorte.numSemestre,
    activo: { $ne: false },
  })
    .sort({ orden: 1 })
    .lean();
  if (!materias.length) throw httpError('El semestre no tiene materias configuradas');

  const fechaInicio = body?.fechaInicio ? new Date(body.fechaInicio) : new Date();
  const dias = Array.isArray(body?.dias) && body.dias.length ? body.dias.map(Number) : [1, 2, 3, 4, 5];
  const horaDesde = String(body?.horaDesde || '08:00');
  const horaHasta = String(body?.horaHasta || '10:00');
  const horasPorSesion = Math.max(1, num(body?.horasPorSesion) || 2);

  // Construye lista de fechas hábiles según días permitidos
  const totalSesiones = materias.reduce(
    (acc, m) => acc + Math.max(1, Math.ceil(num(m.horas) / horasPorSesion)),
    0,
  );
  const fechas = [];
  const cursor = new Date(fechaInicio);
  let guard = 0;
  while (fechas.length < totalSesiones && guard < 2000) {
    const dow = cursor.getDay() === 0 ? 7 : cursor.getDay();
    if (dias.includes(dow)) fechas.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  const creadas = [];
  let idx = 0;
  for (const m of materias) {
    const sesiones = Math.max(1, Math.ceil(num(m.horas) / horasPorSesion));
    const horasRestantes = num(m.horas);
    let acumulado = 0;
    for (let s = 1; s <= sesiones; s++) {
      const fecha = fechas[idx] || new Date(fechaInicio);
      idx += 1;
      const horasSesion = Math.min(horasPorSesion, horasRestantes - acumulado);
      acumulado += horasSesion;
      const doc = await ClaseCohorte.create({
        idCohorte,
        idMateria: m._id,
        idProg: cohorte.idProg,
        fechaClase: fecha,
        horaDesde,
        horaHasta,
        duracionHoras: horasSesion > 0 ? horasSesion : horasPorSesion,
        idEmpleadoInstructor: cohorte.idEmpleadoInstructor || null,
        sesion: s,
        userAddReg: usuario,
      });
      creadas.push(String(doc._id));
    }
  }
  return { clasesGeneradas: creadas.length, ids: creadas };
}

/* ------------------------------------------------------------------ */
/* Asistencia + consumo de horas                                      */
/* ------------------------------------------------------------------ */

async function listarAsistencia(idClase) {
  const clase = await ClaseCohorte.findById(idClase).lean();
  if (!clase) throw httpError('Clase no encontrada', 404);
  const [inscripciones, asistencias, materia] = await Promise.all([
    InscripcionCohorte.find({ idCohorte: clase.idCohorte, estado: 'ACTIVA' }).lean(),
    AsistenciaCohorte.find({ idClase }).lean(),
    MateriaCohorte.findById(clase.idMateria).lean(),
  ]);
  const numDocs = inscripciones.map((i) => i.numDoc);
  const alumnos = numDocs.length ? await DatosAlumno.find({ numDoc: { $in: numDocs } }).lean() : [];
  const alMap = new Map(alumnos.map((a) => [a.numDoc, a]));
  const asisMap = new Map(asistencias.map((a) => [a.numDoc, a]));

  return {
    idClase: String(idClase),
    materiaNombre: materia?.nombre || '—',
    fechaClase: clase.fechaClase,
    alumnos: inscripciones.map((i) => {
      const a = asisMap.get(i.numDoc);
      return {
        numDoc: i.numDoc,
        nombreCompleto: nombreCompletoAlumno(alMap.get(i.numDoc)) || `Doc ${i.numDoc}`,
        estado: a?.estado || 'AUSENTE',
        origen: a?.origen || 'MANUAL',
        nota: a?.nota ?? null,
      };
    }),
  };
}

/**
 * Registra asistencia de la clase. body.asistencias = [{ numDoc, estado, nota }]
 * Consume horas de la materia según modoConsumoHoras de la cohorte.
 */
async function registrarAsistencia(idClase, body, usuario, origen = 'MANUAL') {
  const clase = await ClaseCohorte.findById(idClase).lean();
  if (!clase) throw httpError('Clase no encontrada', 404);
  const cohorte = await Cohorte.findById(clase.idCohorte).lean();
  const materia = await MateriaCohorte.findById(clase.idMateria).lean();
  const horasClase = num(clase.duracionHoras) || 0;
  const modo = cohorte?.modoConsumoHoras || 'AL_ASISTIR';

  const lista = Array.isArray(body?.asistencias) ? body.asistencias : [];
  let registradas = 0;
  for (const item of lista) {
    const numDoc = parseNumDoc(item.numDoc);
    if (numDoc == null) continue;
    const estado = ['PRESENTE', 'AUSENTE', 'JUSTIFICADO'].includes(item.estado) ? item.estado : 'AUSENTE';
    // Consume horas si: modo AL_DICTAR (siempre) o (AL_ASISTIR y PRESENTE)
    const consume = modo === 'AL_DICTAR' || estado === 'PRESENTE';
    const horasConsumidas = consume ? horasClase : 0;
    const nota = item.nota != null && item.nota !== '' ? Number(item.nota) : null;

    await AsistenciaCohorte.updateOne(
      { idClase, numDoc },
      {
        $set: {
          idCohorte: clase.idCohorte,
          idMateria: clase.idMateria,
          estado,
          origen,
          horasConsumidas,
          nota,
          fechaRegistro: new Date(),
          userChangeRecord: usuario,
        },
        $setOnInsert: { userAddReg: usuario },
      },
      { upsert: true },
    );
    registradas += 1;
  }

  await ClaseCohorte.updateOne({ _id: idClase }, { $set: { estado: 'REALIZADA' } });

  // Recalcula aprobación de la materia para cada alumno afectado
  for (const item of lista) {
    const numDoc = parseNumDoc(item.numDoc);
    if (numDoc != null) await recalcularMateriaAprobada(numDoc, clase.idMateria, cohorte, materia, usuario);
  }

  return { registradas };
}

/** Marca asistencia automática al entrar al Meet desde el portal. */
async function marcarAsistenciaMeet(idClase, numDocRaw, usuario = 'portal') {
  const numDoc = parseNumDoc(numDocRaw);
  if (numDoc == null) throw httpError('numDoc inválido');
  const clase = await ClaseCohorte.findById(idClase).lean();
  if (!clase) throw httpError('Clase no encontrada', 404);
  const insc = await InscripcionCohorte.findOne({
    idCohorte: clase.idCohorte,
    numDoc,
    estado: 'ACTIVA',
  }).lean();
  if (!insc) throw httpError('No está inscrito en esta cohorte', 403);

  return registrarAsistencia(
    idClase,
    { asistencias: [{ numDoc, estado: 'PRESENTE' }] },
    usuario,
    'MEET',
  );
}

/**
 * Promedio ponderado (0-100) de las evaluaciones calificadas de una materia para un alumno.
 * Toma el mejor intento calificado por evaluación y pondera por pesoNota.
 */
async function notaEvaluacionesMateria(numDoc, idMateria, idCohorte) {
  const evals = await EvaluacionCohorte.find({ idCohorte, idMateria }).select('_id pesoNota').lean();
  if (!evals.length) return null;
  let sumaPond = 0;
  let sumaPesos = 0;
  for (const ev of evals) {
    const intentos = await IntentoEvaluacionCohorte.find({
      idEvaluacion: ev._id,
      numDoc,
      estado: 'CALIFICADO',
    })
      .select('nota')
      .lean();
    if (!intentos.length) continue;
    const mejor = Math.max(...intentos.map((i) => num(i.nota)));
    const peso = num(ev.pesoNota) || 1;
    sumaPond += mejor * peso;
    sumaPesos += peso;
  }
  return sumaPesos > 0 ? sumaPond / sumaPesos : null;
}

/**
 * Recalcula si el alumno cubrió las horas de la materia (umbral 100% de horas o
 * según asistencia) y, si tiene nota >= mínima, marca la materia aprobada.
 */
async function recalcularMateriaAprobada(numDoc, idMateria, cohorte, materia, usuario) {
  if (!materia) materia = await MateriaCohorte.findById(idMateria).lean();
  if (!materia) return;
  const horasMateria = num(materia.horas);

  const asistencias = await AsistenciaCohorte.find({ numDoc, idMateria }).lean();
  const horasCubiertas = asistencias.reduce((acc, a) => acc + num(a.horasConsumidas), 0);

  const idCohorte =
    cohorte?._id ||
    (await Cohorte.findOne({ idProg: materia.idProg, numSemestre: materia.numSemestre }).select('_id').lean())?._id;
  const idProg = cohorte?.idProg || materia.idProg;

  let notaProm = null;
  let notaMinima = NOTA_MINIMA_APROBACION_DEFAULT;

  if (idCohorte && idProg) {
    const esquemaNotas = require('./cohortesEsquemaNotas');
    const calc = await esquemaNotas.calcularNotaFinalMateria(numDoc, idMateria, idCohorte, idProg);
    notaProm = calc.notaFinal;
    notaMinima = calc.notaMinima;
  }

  // Fallback legacy si no hay esquema con notas registradas
  if (notaProm == null) {
    const notasAsis = asistencias.map((a) => a.nota).filter((n) => n != null && Number.isFinite(n));
    const notaAsis = notasAsis.length ? notasAsis.reduce((a, b) => a + b, 0) / notasAsis.length : null;
    const notaEval = idCohorte ? await notaEvaluacionesMateria(numDoc, idMateria, idCohorte) : null;
    const partes = [notaAsis, notaEval].filter((n) => n != null && Number.isFinite(n));
    notaProm = partes.length ? partes.reduce((a, b) => a + b, 0) / partes.length : null;
  }

  const cumpleHoras = horasMateria > 0 ? horasCubiertas >= horasMateria : true;
  const cumpleNota = notaProm == null ? true : notaProm >= notaMinima;
  const aprobada = cumpleHoras && cumpleNota;

  await MateriaAprobadaCohorte.updateOne(
    { numDoc, idMateria },
    {
      $set: {
        idProg: materia.idProg,
        numSemestre: materia.numSemestre,
        nota: notaProm != null ? Math.round(notaProm) : null,
        aprobada,
        fecha: new Date(),
        userChangeRecord: usuario,
      },
      $setOnInsert: { userAddReg: usuario },
    },
    { upsert: true },
  );
}

module.exports = {
  listarInstructores,
  listarProgramasCohorte,
  listarCatalogoMaterias,
  crearMateriaCatalogo,
  actualizarMateriaCatalogo,
  eliminarMateriaCatalogo,
  obtenerPlan,
  guardarPlan,
  listarCohortes,
  crearCohorte,
  actualizarCohorte,
  detalleCohorte,
  inscribirAlumno,
  cohorteAutoParaInscripcion,
  crearClase,
  actualizarClase,
  planificarClases,
  listarAsistencia,
  registrarAsistencia,
  marcarAsistenciaMeet,
  semestreAprobado,
  materiasAprobadasDe,
  recalcularMateriaAprobada,
  notaEvaluacionesMateria,
  numSemestresPrograma,
  nombreCompletoAlumno,
  labelPrograma,
};
