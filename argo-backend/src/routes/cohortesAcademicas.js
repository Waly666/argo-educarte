const { Router } = require('express');
const ctrl = require('../controllers/cohortesAcademicasController');
const { requireAuth, requirePermiso } = require('../middleware/auth');

const router = Router();
router.use(requireAuth);

const ver = requirePermiso(
  'cohortes_academicas.ver',
  'cohortes_academicas.gestionar',
  'cohortes_academicas.operar',
);
const gestionar = requirePermiso('cohortes_academicas.gestionar');
const operar = requirePermiso('cohortes_academicas.operar', 'cohortes_academicas.gestionar');

// Instructores (empleados con cargo instructor)
router.get('/instructores', ver, ctrl.instructores);

// Catálogo (banco) global de materias/temas
router.get('/catalogo-materias', ver, ctrl.listarCatalogoMaterias);
router.post('/catalogo-materias', gestionar, ctrl.crearMateriaCatalogo);
router.put('/catalogo-materias/:id', gestionar, ctrl.actualizarMateriaCatalogo);
router.delete('/catalogo-materias/:id', gestionar, ctrl.eliminarMateriaCatalogo);

// Plan de programa (semestres + materias)
router.get('/programas', ver, ctrl.programas);
router.get('/programas/:idProg/plan', ver, ctrl.obtenerPlan);
router.put('/programas/:idProg/plan', gestionar, ctrl.guardarPlan);
router.get('/programas/:idProg/esquema-notas', ver, ctrl.obtenerEsquemaNotas);
router.put('/programas/:idProg/esquema-notas', gestionar, ctrl.guardarEsquemaNotas);

// Cohortes
router.get('/cohortes', ver, ctrl.listarCohortes);
router.post('/cohortes', gestionar, ctrl.crearCohorte);
router.get('/cohortes/:id', ver, ctrl.detalleCohorte);
router.put('/cohortes/:id', gestionar, ctrl.actualizarCohorte);
router.post('/cohortes/:id/inscribir', gestionar, ctrl.inscribir);
router.get('/cohortes/:id/notas-criterio', ver, ctrl.matrizNotasCriterio);
router.post('/cohortes/:id/notas-criterio', operar, ctrl.guardarNotasCriterio);
router.post('/cohortes/:id/clases', gestionar, ctrl.crearClase);
router.post('/cohortes/:id/planificar', gestionar, ctrl.planificar);

// Clases y asistencia
router.put('/clases/:id', gestionar, ctrl.actualizarClase);
router.get('/clases/:id/asistencia', ver, ctrl.listarAsistencia);
router.post('/clases/:id/asistencia', operar, ctrl.registrarAsistencia);

// Banco de preguntas
router.get('/banco-preguntas', ver, ctrl.listarBanco);
router.post('/banco-preguntas', gestionar, ctrl.crearPregunta);
router.put('/banco-preguntas/:id', gestionar, ctrl.actualizarPregunta);
router.delete('/banco-preguntas/:id', gestionar, ctrl.eliminarPregunta);

// Evaluaciones de una cohorte
router.get('/cohortes/:id/evaluaciones', ver, ctrl.listarEvaluaciones);
router.post('/cohortes/:id/evaluaciones', gestionar, ctrl.crearEvaluacion);
router.get('/evaluaciones/:idEval', ver, ctrl.obtenerEvaluacion);
router.put('/evaluaciones/:idEval', gestionar, ctrl.actualizarEvaluacion);
router.post('/evaluaciones/:idEval/publicar', gestionar, ctrl.publicarEvaluacion);
router.post('/evaluaciones/:idEval/cerrar', gestionar, ctrl.cerrarEvaluacion);
router.delete('/evaluaciones/:idEval', gestionar, ctrl.eliminarEvaluacion);
router.get('/evaluaciones/:idEval/resultados', ver, ctrl.resultadosEvaluacion);

// Materiales por materia
router.get('/materiales', ver, ctrl.listarMateriales);
router.post('/materiales', gestionar, ctrl.crearMaterial);
router.put('/materiales/:id', gestionar, ctrl.actualizarMaterial);
router.delete('/materiales/:id', gestionar, ctrl.eliminarMaterial);

// Reportes, actas y certificado por criterios
router.get('/cohortes/:id/certificado-elegibilidad', ver, ctrl.elegibilidadCertificado);
router.post('/cohortes/:id/certificado-finalizar', gestionar, ctrl.finalizarAptos);
router.get('/cohortes/:id/acta-notas', ver, ctrl.actaNotas);
router.get('/cohortes/:id/reporte-asistencia', ver, ctrl.reporteAsistencia);

module.exports = router;
