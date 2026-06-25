const svc = require('../services/cohortesAcademicas');
const evalSvc = require('../services/cohortesEvaluaciones');
const matSvc = require('../services/cohortesMateriales');
const repSvc = require('../services/cohortesReportes');
const esquemaSvc = require('../services/cohortesEsquemaNotas');

function usuarioDe(req) {
  return req?.user?.username || req?.user?.usuario || req?.user?.email || 'sistema';
}

function manejarError(e, res, next) {
  if (e.status) return res.status(e.status).json({ message: e.message });
  return next(e);
}

exports.instructores = async (_req, res, next) => {
  try {
    res.json(await svc.listarInstructores());
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.programas = async (_req, res, next) => {
  try {
    res.json(await svc.listarProgramasCohorte());
  } catch (e) {
    manejarError(e, res, next);
  }
};

/* ---------------- Catálogo (banco) de materias ---------------- */

exports.listarCatalogoMaterias = async (req, res, next) => {
  try {
    res.json(await svc.listarCatalogoMaterias(req.query));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.crearMateriaCatalogo = async (req, res, next) => {
  try {
    res.status(201).json(await svc.crearMateriaCatalogo(req.body, usuarioDe(req)));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.actualizarMateriaCatalogo = async (req, res, next) => {
  try {
    res.json(await svc.actualizarMateriaCatalogo(req.params.id, req.body, usuarioDe(req)));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.eliminarMateriaCatalogo = async (req, res, next) => {
  try {
    res.json(await svc.eliminarMateriaCatalogo(req.params.id));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.obtenerPlan = async (req, res, next) => {
  try {
    res.json(await svc.obtenerPlan(req.params.idProg));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.guardarPlan = async (req, res, next) => {
  try {
    res.json(await svc.guardarPlan(req.params.idProg, req.body, usuarioDe(req)));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.listarCohortes = async (req, res, next) => {
  try {
    res.json(await svc.listarCohortes(req.query));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.crearCohorte = async (req, res, next) => {
  try {
    res.status(201).json(await svc.crearCohorte(req.body, usuarioDe(req)));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.actualizarCohorte = async (req, res, next) => {
  try {
    res.json(await svc.actualizarCohorte(req.params.id, req.body, usuarioDe(req)));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.detalleCohorte = async (req, res, next) => {
  try {
    res.json(await svc.detalleCohorte(req.params.id));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.inscribir = async (req, res, next) => {
  try {
    res.status(201).json(await svc.inscribirAlumno(req.params.id, req.body, usuarioDe(req)));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.crearClase = async (req, res, next) => {
  try {
    res.status(201).json(await svc.crearClase(req.params.id, req.body, usuarioDe(req)));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.planificar = async (req, res, next) => {
  try {
    res.status(201).json(await svc.planificarClases(req.params.id, req.body, usuarioDe(req)));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.actualizarClase = async (req, res, next) => {
  try {
    res.json(await svc.actualizarClase(req.params.id, req.body, usuarioDe(req)));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.listarAsistencia = async (req, res, next) => {
  try {
    res.json(await svc.listarAsistencia(req.params.id));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.registrarAsistencia = async (req, res, next) => {
  try {
    res.json(await svc.registrarAsistencia(req.params.id, req.body, usuarioDe(req)));
  } catch (e) {
    manejarError(e, res, next);
  }
};

/* ---------------- Banco de preguntas ---------------- */

exports.listarBanco = async (req, res, next) => {
  try {
    res.json(await evalSvc.listarBanco(req.query));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.crearPregunta = async (req, res, next) => {
  try {
    res.status(201).json(await evalSvc.crearPregunta(req.body, usuarioDe(req)));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.actualizarPregunta = async (req, res, next) => {
  try {
    res.json(await evalSvc.actualizarPregunta(req.params.id, req.body, usuarioDe(req)));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.eliminarPregunta = async (req, res, next) => {
  try {
    res.json(await evalSvc.eliminarPregunta(req.params.id));
  } catch (e) {
    manejarError(e, res, next);
  }
};

/* ---------------- Evaluaciones ---------------- */

exports.listarEvaluaciones = async (req, res, next) => {
  try {
    res.json(await evalSvc.listarEvaluaciones(req.params.id));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.crearEvaluacion = async (req, res, next) => {
  try {
    res.status(201).json(await evalSvc.crearEvaluacion(req.params.id, req.body, usuarioDe(req)));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.obtenerEvaluacion = async (req, res, next) => {
  try {
    res.json(await evalSvc.obtenerEvaluacion(req.params.idEval));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.actualizarEvaluacion = async (req, res, next) => {
  try {
    res.json(await evalSvc.actualizarEvaluacion(req.params.idEval, req.body, usuarioDe(req)));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.publicarEvaluacion = async (req, res, next) => {
  try {
    res.json(await evalSvc.publicarEvaluacion(req.params.idEval, usuarioDe(req)));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.cerrarEvaluacion = async (req, res, next) => {
  try {
    res.json(await evalSvc.cerrarEvaluacion(req.params.idEval, usuarioDe(req)));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.eliminarEvaluacion = async (req, res, next) => {
  try {
    res.json(await evalSvc.eliminarEvaluacion(req.params.idEval));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.resultadosEvaluacion = async (req, res, next) => {
  try {
    res.json(await evalSvc.resultadosEvaluacion(req.params.idEval));
  } catch (e) {
    manejarError(e, res, next);
  }
};

/* ---------------- Materiales ---------------- */

exports.listarMateriales = async (req, res, next) => {
  try {
    res.json(await matSvc.listarMateriales(req.query));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.crearMaterial = async (req, res, next) => {
  try {
    res.status(201).json(await matSvc.crearMaterial(req.body, usuarioDe(req)));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.actualizarMaterial = async (req, res, next) => {
  try {
    res.json(await matSvc.actualizarMaterial(req.params.id, req.body, usuarioDe(req)));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.eliminarMaterial = async (req, res, next) => {
  try {
    res.json(await matSvc.eliminarMaterial(req.params.id));
  } catch (e) {
    manejarError(e, res, next);
  }
};

/* ---------------- Reportes / actas / certificado ---------------- */

exports.elegibilidadCertificado = async (req, res, next) => {
  try {
    res.json(await repSvc.elegibilidadCertificado(req.params.id));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.finalizarAptos = async (req, res, next) => {
  try {
    res.json(await repSvc.finalizarAptos(req.params.id, usuarioDe(req)));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.actaNotas = async (req, res, next) => {
  try {
    res.json(await repSvc.actaNotas(req.params.id));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.reporteAsistencia = async (req, res, next) => {
  try {
    res.json(await repSvc.reporteAsistencia(req.params.id));
  } catch (e) {
    manejarError(e, res, next);
  }
};

/* ---------------- Esquema de notas (programa) ---------------- */

exports.obtenerEsquemaNotas = async (req, res, next) => {
  try {
    res.json(await esquemaSvc.obtenerEsquemaNotas(req.params.idProg));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.guardarEsquemaNotas = async (req, res, next) => {
  try {
    res.json(await esquemaSvc.guardarEsquemaNotas(req.params.idProg, req.body, usuarioDe(req)));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.matrizNotasCriterio = async (req, res, next) => {
  try {
    const idMateria = req.query.idMateria;
    if (!idMateria) return res.status(400).json({ message: 'idMateria requerido' });
    res.json(await esquemaSvc.matrizNotasCriterio(req.params.id, idMateria));
  } catch (e) {
    manejarError(e, res, next);
  }
};

exports.guardarNotasCriterio = async (req, res, next) => {
  try {
    const result = await esquemaSvc.guardarNotasCriterio(req.params.id, req.body, usuarioDe(req));
    const { recalcularMateriaAprobada } = require('../services/cohortesAcademicas');
    const cohorte = await require('../models/Cohorte').findById(req.params.id).lean();
    const idMateria = req.body?.idMateria;
    const notas = Array.isArray(req.body?.notas) ? req.body.notas : [];
    const materia = idMateria ? await require('../models/MateriaCohorte').findById(idMateria).lean() : null;
    const nums = [...new Set(notas.map((n) => Number(n.numDoc)).filter((x) => x))];
    for (const numDoc of nums) {
      if (materia) await recalcularMateriaAprobada(numDoc, idMateria, cohorte, materia, usuarioDe(req));
    }
    res.json(result);
  } catch (e) {
    manejarError(e, res, next);
  }
};
