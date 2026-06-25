const { Router } = require('express');
const upload = require('../middleware/upload');
const empleado = require('../controllers/empleadoController');
const empleadoDoc = require('../controllers/empleadoDocumentoController');
const cat = require('../controllers/rrhhCatalogoControllers');
const contrato = require('../controllers/contratoController');
const novedad = require('../controllers/novedadNominaController');
const nomina = require('../controllers/nominaController');
const { requireAuth, requirePermiso } = require('../middleware/auth');

const router = Router();
const rrhh = requirePermiso('rrhh');

router.use(requireAuth);
router.get('/alertas-documentos-empleados', empleadoDoc.alertasDocumentos);
router.get('/alertas-documentos-empleados-faltantes', empleadoDoc.alertasDocumentosFaltantes);
router.get(
  '/instructores',
  requirePermiso('instructores', 'rrhh', 'jornadas.ver', 'jornadas.gestionar'),
  empleado.listarInstructores,
);
router.get(
  '/instructores/:id',
  requirePermiso('instructores', 'rrhh', 'jornadas.ver', 'jornadas.gestionar'),
  empleado.obtenerInstructor,
);
router.use(rrhh);

function crud(ctrl) {
  const r = Router();
  r.get('/', ctrl.listar);
  r.get('/:id', ctrl.obtener);
  r.post('/', ctrl.crear);
  r.put('/:id', ctrl.actualizar);
  r.delete('/:id', ctrl.eliminar);
  return r;
}

const empleadoFoto = upload.empleados.fields([{ name: 'foto', maxCount: 1 }]);
const empleadoDocUpload = upload.empleados.single('archivo');
router.get('/empleados', empleado.listar);
router.get('/empleados/:id/documentos-requeridos', empleadoDoc.documentosRequeridos);
router.get('/empleados/:id/documentos', empleadoDoc.listarDocumentos);
router.post('/empleados/:id/documentos', empleadoDocUpload, empleadoDoc.crearDocumento);
router.put('/empleados/:id/documentos/:docId', empleadoDocUpload, empleadoDoc.actualizarDocumento);
router.delete('/empleados/:id/documentos/:docId', empleadoDoc.eliminarDocumento);
router.get('/empleados/:id', empleado.obtener);
router.post('/empleados', empleadoFoto, empleado.crear);
router.put('/empleados/:id', empleadoFoto, empleado.actualizar);
router.delete('/empleados/:id', empleado.eliminar);
router.use('/cargos', crud(cat.cargo));
router.use('/departamentos', crud(cat.departamento));
router.use('/eps', crud(cat.eps));
router.use('/afp', crud(cat.afp));
router.use('/arl', crud(cat.arl));
router.use('/cajas-compensacion', crud(cat.cajaCompensacion));
router.use('/contratos', crud(contrato));
router.use('/novedades-nomina', crud(novedad));

router.get('/nomina/config', nomina.config);
router.get('/nomina/periodos', nomina.listarPeriodos);
router.post('/nomina/periodos', nomina.crearPeriodo);
router.get('/nomina/periodos/:id', nomina.obtenerPeriodo);
router.post('/nomina/periodos/:id/generar-novedades', nomina.generarNovedades);
router.post('/nomina/periodos/:id/generar-novedades-descuadre', nomina.generarNovedadesDescuadreCaja);
router.post('/nomina/periodos/:id/liquidar', nomina.liquidar);
router.post('/nomina/periodos/:id/reabrir', nomina.reabrirPeriodo);
router.get('/nomina/periodos/:id/liquidacion', nomina.obtenerLiquidacion);
router.post('/nomina/periodos/:id/cerrar', nomina.cerrarPeriodo);
router.post('/nomina/periodos/:id/pagar', nomina.pagarNomina);
router.get('/nomina/periodos/:id/pila.csv', nomina.exportarPila);
router.get('/nomina/periodos/:id/pila.txt', nomina.exportarPilaTxt);
router.get('/nomina/periodos/:id/recibo/:empleadoId', nomina.reciboHtml);

module.exports = router;
