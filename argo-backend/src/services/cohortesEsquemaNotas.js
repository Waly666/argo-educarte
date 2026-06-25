const EsquemaNotasPrograma = require('../models/EsquemaNotasPrograma');
const NotaCriterioCohorte = require('../models/NotaCriterioCohorte');
const EvaluacionCohorte = require('../models/EvaluacionCohorte');
const IntentoEvaluacionCohorte = require('../models/IntentoEvaluacionCohorte');
const AsistenciaCohorte = require('../models/AsistenciaCohorte');
const InscripcionCohorte = require('../models/InscripcionCohorte');
const Cohorte = require('../models/Cohorte');
const DatosAlumno = require('../models/DatosAlumno');
const {
  ESQUEMA_NOTAS_DEFAULT,
  NOTA_MINIMA_APROBACION_DEFAULT,
  TIPOS_CRITERIO_NOTA,
} = require('../constants/cohortesAcademicas');

function nombreAlumno(a) {
  if (!a) return '';
  return [a.nombre1, a.nombre2, a.apellido1, a.apellido2].filter(Boolean).join(' ').trim();
}

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapEsquema(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    idProg: o.idProg,
    criterios: (o.criterios || []).map((c) => ({
      _id: String(c._id),
      nombre: c.nombre,
      pesoPct: num(c.pesoPct),
      tipo: c.tipo,
      orden: c.orden,
    })),
    configEvaluaciones: {
      pesoParcialesPct: num(o.configEvaluaciones?.pesoParcialesPct ?? 40),
      pesoFinalPct: num(o.configEvaluaciones?.pesoFinalPct ?? 60),
      maxParcialesPorMateria: num(o.configEvaluaciones?.maxParcialesPorMateria ?? 3),
      requiereFinalPorMateria: o.configEvaluaciones?.requiereFinalPorMateria !== false,
    },
    notaMinimaAprobacion: num(o.notaMinimaAprobacion ?? NOTA_MINIMA_APROBACION_DEFAULT),
  };
}

async function obtenerEsquemaNotas(idProgRaw) {
  const idProg = String(idProgRaw || '').trim();
  if (!idProg) throw httpError('idProg requerido');
  let doc = await EsquemaNotasPrograma.findOne({ idProg }).lean();
  if (!doc) {
    return { idProg, ...ESQUEMA_NOTAS_DEFAULT, criterios: ESQUEMA_NOTAS_DEFAULT.criterios.map((c, i) => ({ ...c, _id: `default-${i}` })) };
  }
  return mapEsquema(doc);
}

async function guardarEsquemaNotas(idProgRaw, body, usuario) {
  const idProg = String(idProgRaw || '').trim();
  if (!idProg) throw httpError('idProg requerido');
  const criterios = Array.isArray(body?.criterios) ? body.criterios : [];
  if (!criterios.length) throw httpError('Agregue al menos un criterio de nota.');
  const suma = criterios.reduce((acc, c) => acc + num(c.pesoPct), 0);
  if (suma !== 100) {
    throw httpError(`Los criterios deben sumar exactamente 100%. Actualmente suman ${suma}%.`);
  }
  for (const c of criterios) {
    if (!String(c.nombre || '').trim()) throw httpError('Hay un criterio sin nombre.');
    if (!TIPOS_CRITERIO_NOTA.includes(c.tipo)) throw httpError(`Tipo de criterio inválido: ${c.tipo}`);
  }
  const cfg = body.configEvaluaciones || {};
  const pesoPar = num(cfg.pesoParcialesPct ?? 40);
  const pesoFin = num(cfg.pesoFinalPct ?? 60);
  if (pesoPar + pesoFin !== 100) {
    throw httpError('Dentro de evaluaciones, parciales + final deben sumar 100%.');
  }

  const criteriosDb = criterios.map((c, i) => ({
    nombre: String(c.nombre).trim(),
    pesoPct: num(c.pesoPct),
    tipo: c.tipo,
    orden: i + 1,
  }));

  const doc = await EsquemaNotasPrograma.findOneAndUpdate(
    { idProg },
    {
      $set: {
        criterios: criteriosDb,
        configEvaluaciones: {
          pesoParcialesPct: pesoPar,
          pesoFinalPct: pesoFin,
          maxParcialesPorMateria: Math.max(0, num(cfg.maxParcialesPorMateria ?? 3)),
          requiereFinalPorMateria: cfg.requiereFinalPorMateria !== false,
        },
        notaMinimaAprobacion: Math.max(0, Math.min(100, num(body.notaMinimaAprobacion ?? NOTA_MINIMA_APROBACION_DEFAULT))),
        userChangeRecord: usuario,
      },
      $setOnInsert: { userAddReg: usuario },
    },
    { upsert: true, new: true },
  );
  return mapEsquema(doc);
}

/** Mejor nota calificada de evaluaciones filtradas por tipo. */
async function notaGrupoEvaluaciones(numDoc, idMateria, idCohorte, tipos) {
  const evals = await EvaluacionCohorte.find({
    idCohorte,
    idMateria,
    tipoEvaluacion: { $in: tipos },
    estado: { $in: ['PUBLICADA', 'CERRADA'] },
  })
    .select('_id pesoNota')
    .lean();
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

/** Calcula la nota final de una materia según el esquema del programa. */
async function calcularNotaFinalMateria(numDoc, idMateria, idCohorte, idProg) {
  const esquema = await obtenerEsquemaNotas(idProg);
  const cfg = esquema.configEvaluaciones;
  const desglose = [];
  let notaAcum = 0;
  let pesoConNota = 0;

  for (const crit of esquema.criterios) {
    let notaCrit = null;
    if (crit.tipo === 'MANUAL') {
      const row = await NotaCriterioCohorte.findOne({
        idCohorte,
        idMateria,
        idCriterio: crit._id,
        numDoc,
      })
        .select('nota')
        .lean();
      notaCrit = row?.nota != null && Number.isFinite(row.nota) ? num(row.nota) : null;
    } else if (crit.tipo === 'ASISTENCIA') {
      const asistencias = await AsistenciaCohorte.find({ numDoc, idMateria }).select('nota').lean();
      const notas = asistencias.map((a) => a.nota).filter((n) => n != null && Number.isFinite(n));
      notaCrit = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
    } else if (crit.tipo === 'EVALUACIONES') {
      const notaPar = await notaGrupoEvaluaciones(numDoc, idMateria, idCohorte, ['PARCIAL', 'GENERAL']);
      const notaFin = await notaGrupoEvaluaciones(numDoc, idMateria, idCohorte, ['FINAL']);
      const partes = [];
      if (notaPar != null) partes.push({ n: notaPar, w: cfg.pesoParcialesPct });
      if (notaFin != null) partes.push({ n: notaFin, w: cfg.pesoFinalPct });
      if (partes.length === 2) {
        const tw = partes.reduce((a, p) => a + p.w, 0);
        notaCrit = partes.reduce((a, p) => a + p.n * p.w, 0) / tw;
      } else if (partes.length === 1) {
        notaCrit = partes[0].n;
      } else {
        notaCrit = null;
      }
    }
    desglose.push({
      idCriterio: crit._id,
      nombre: crit.nombre,
      tipo: crit.tipo,
      pesoPct: crit.pesoPct,
      nota: notaCrit != null ? Math.round(notaCrit) : null,
      aporte: notaCrit != null ? Math.round((notaCrit * crit.pesoPct) / 100) : null,
    });
    if (notaCrit != null) {
      notaAcum += (notaCrit * crit.pesoPct) / 100;
      pesoConNota += crit.pesoPct;
    }
  }

  const notaFinal = pesoConNota > 0 ? Math.round(notaAcum) : null;
  return {
    notaFinal,
    desglose,
    notaMinima: esquema.notaMinimaAprobacion,
    pesoConNota,
  };
}

/** Matriz de notas manuales: alumnos × criterios MANUAL para una materia. */
async function matrizNotasCriterio(idCohorte, idMateria) {
  const cohorte = await Cohorte.findById(idCohorte).lean();
  if (!cohorte) throw httpError('Cohorte no encontrada', 404);
  const esquema = await obtenerEsquemaNotas(cohorte.idProg);
  const criteriosManual = esquema.criterios.filter((c) => c.tipo === 'MANUAL');

  const inscripciones = await InscripcionCohorte.find({ idCohorte, estado: 'ACTIVA' }).lean();
  const numDocs = inscripciones.map((i) => i.numDoc);
  const alumnos = numDocs.length ? await DatosAlumno.find({ numDoc: { $in: numDocs } }).lean() : [];
  const alMap = new Map(alumnos.map((a) => [a.numDoc, a]));

  const notasDb = await NotaCriterioCohorte.find({ idCohorte, idMateria }).lean();
  const notaMap = new Map(notasDb.map((n) => [`${n.numDoc}-${n.idCriterio}`, n]));

  const filas = inscripciones.map((i) => ({
    numDoc: i.numDoc,
    nombreCompleto: nombreAlumno(alMap.get(i.numDoc)) || `Doc ${i.numDoc}`,
    celdas: criteriosManual.map((c) => {
      const n = notaMap.get(`${i.numDoc}-${c._id}`);
      return {
        idCriterio: c._id,
        nota: n?.nota ?? null,
        observacion: n?.observacion || '',
      };
    }),
  }));

  return {
    idCohorte: String(idCohorte),
    idMateria: String(idMateria),
    criterios: criteriosManual,
    filas,
    esquema: { notaMinimaAprobacion: esquema.notaMinimaAprobacion },
  };
}

async function guardarNotasCriterio(idCohorte, body, usuario) {
  const idMateria = body?.idMateria;
  if (!idMateria) throw httpError('idMateria requerido');
  const notas = Array.isArray(body?.notas) ? body.notas : [];
  let guardadas = 0;
  for (const item of notas) {
    const numDoc = num(item.numDoc);
    const idCriterio = item.idCriterio;
    if (!numDoc || !idCriterio) continue;
    const nota = item.nota != null && item.nota !== '' ? Math.max(0, Math.min(100, num(item.nota))) : null;
    await NotaCriterioCohorte.updateOne(
      { idCohorte, idMateria, idCriterio, numDoc },
      {
        $set: {
          nota,
          observacion: String(item.observacion || '').trim(),
          userChangeRecord: usuario,
        },
        $setOnInsert: { userAddReg: usuario },
      },
      { upsert: true },
    );
    guardadas += 1;
  }
  return { guardadas };
}

module.exports = {
  obtenerEsquemaNotas,
  guardarEsquemaNotas,
  calcularNotaFinalMateria,
  matrizNotasCriterio,
  guardarNotasCriterio,
};
