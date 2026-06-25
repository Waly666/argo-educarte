const { Router } = require('express');
const ctrl = require('../controllers/facturacionController');
const { requireAuth, requirePermiso, loadSedeActiva } = require('../middleware/auth');

const router = Router();
router.use(requireAuth);
router.use(loadSedeActiva);

const ver = requirePermiso('facturacion', 'alumnos.pagos');
const verFacturasAlumno = requirePermiso(
  'facturacion',
  'alumnos.pagos',
  'alumnos.gestionar',
  'alumnos.ver',
);
const emitir = requirePermiso('facturacion', 'alumnos.pagos');

router.get('/catalogos', ver, ctrl.catalogos);
router.get('/resumen', ver, ctrl.resumen);
router.get('/elegibles/:numDoc', ver, ctrl.elegiblesAlumno);
router.get('/alumno/:numDoc', verFacturasAlumno, ctrl.facturasAlumno);
router.get('/contrato/:idContrato/estado', ver, ctrl.estadoFacturaContrato);
router.get('/contrato/:idContrato/preview', ver, ctrl.previewFacturaContrato);
router.post('/contrato/:idContrato/emitir', emitir, ctrl.emitirFacturaContrato);
router.get('/rangos-factus', ver, ctrl.rangosFactus);
router.get('/notas-credito/:notaId/html', ver, ctrl.htmlNotaCredito);
router.get('/notas-credito', ver, ctrl.listarNotas);
router.post('/probar-conexion', ver, ctrl.probarConexion);
router.post('/preview', ver, ctrl.preview);
router.post('/emitir', emitir, ctrl.emitir);
router.get('/', ver, ctrl.listar);

router.post('/:id/nota-credito/preview', ver, ctrl.notaCreditoPreview);
router.post('/:id/nota-credito', emitir, ctrl.notaCreditoEmitir);
router.get('/:id/notas-credito', ver, ctrl.notasDeFactura);
router.get('/:id/html', ver, ctrl.htmlFactura);
router.get('/:id', ver, ctrl.obtener);

module.exports = router;
