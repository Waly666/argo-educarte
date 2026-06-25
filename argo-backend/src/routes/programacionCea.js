const { Router } = require('express');
const ctrl = require('../controllers/programacionCeaController');
const { requireAuth, loadSedeActiva, exigirSedeActiva, requirePermiso } = require('../middleware/auth');

const router = Router();
router.use(requireAuth, loadSedeActiva, exigirSedeActiva);

const ver = requirePermiso(
  'programacion_cea.ver',
  'programacion_cea.gestionar',
  'programacion_cea.operar',
  'caja.turno',
  'caja.admin',
);
const gest = requirePermiso('programacion_cea.gestionar');
const operar = requirePermiso('programacion_cea.operar', 'programacion_cea.gestionar');
const cerrarRetroactivo = requirePermiso(
  'caja.turno',
  'caja.admin',
  'programacion_cea.gestionar',
  'programacion_cea.operar',
);

router.get('/programas', ver, ctrl.programas);
router.get('/config', ver, ctrl.obtenerConfig);
router.put('/config', gest, ctrl.guardarConfig);
router.get('/festivos', ver, ctrl.festivos);

router.get('/temas/:idProg', ver, ctrl.listarTemas);
router.post('/temas/:idProg', gest, ctrl.crearTema);
router.put('/temas/item/:id', gest, ctrl.actualizarTema);
router.delete('/temas/item/:id', gest, ctrl.eliminarTema);

router.get('/rastreo', ver, ctrl.rastreoGlobal);
router.post('/rastreo/generar-pendientes', gest, ctrl.generarClasesPendientesGlobales);
router.get('/rastreo/:numDoc/clases', ver, ctrl.clasesAlumno);
router.get('/rastreo/:numDoc', ver, ctrl.rastreoAlumno);
router.patch('/rastreo/:numDoc/preferencias', gest, ctrl.preferenciasAlumno);
router.post('/rastreo/:numDoc/completar-faltantes', gest, ctrl.completarClasesFaltantesAlumno);
router.post('/planificacion/preview', gest, ctrl.previewPlanificacion);
router.post('/planificacion/generar', gest, ctrl.generarPlanificacion);
router.get('/alertas-pendientes', ver, ctrl.alertasPendientes);
router.get('/alertas-clases-creado', ver, ctrl.alertasClasesCreado);
router.get('/alertas-clases-proximas', ver, ctrl.alertasClasesProximas);

router.get('/elegibles-programa', ver, ctrl.alumnosElegiblesPrograma);
router.get('/recursos', ver, ctrl.recursos);
router.get('/clases', ver, ctrl.listarClases);
router.post('/clases/verificar-conflictos', operar, ctrl.verificarConflictos);
router.post('/clases', gest, ctrl.crearClase);
router.get('/clases/:id', ver, ctrl.obtenerClase);
router.put('/clases/:id', operar, ctrl.actualizarClase);
router.delete('/clases/:id', gest, ctrl.cancelarClase);
router.delete('/clases/:id/permanente', gest, ctrl.eliminarClase);
router.post('/clases/:id/iniciar', operar, ctrl.iniciarClase);
router.post('/clases/:id/finalizar', operar, ctrl.finalizarClase);
router.post('/clases/:id/finalizar-retroactivo', cerrarRetroactivo, ctrl.finalizarClaseRetroactiva);
router.get('/clases/:id/inscripciones', ver, ctrl.listarInscripciones);
router.get('/clases/:id/alumnos-elegibles', ver, ctrl.alumnosElegibles);
router.post('/clases/:id/inscribir', operar, ctrl.inscribirAlumno);
router.delete('/clases/:id/inscripciones/:numDoc', operar, ctrl.quitarInscripcion);

module.exports = router;
