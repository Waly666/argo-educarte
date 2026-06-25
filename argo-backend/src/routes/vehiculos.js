const { Router } = require('express');
const ctrl = require('../controllers/vehiculoController');
const inspCtrl = require('../controllers/inspeccionVehiculoController');
const { requireAuth, loadSedeActiva, exigirSedeActiva, requirePermiso } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = Router();
router.use(requireAuth, loadSedeActiva, exigirSedeActiva);

router.get('/alertas-documentos', ctrl.alertasDocumentos);
router.get('/alertas-documentos-faltantes', ctrl.alertasDocumentosFaltantes);
router.get('/alertas-inspeccion-pendiente', inspCtrl.alertasInspeccionPendiente);

const permiso = requirePermiso('vehiculos');
const permisoInspeccion = requirePermiso('vehiculos', 'instructores.inspeccion');

router.get('/meta', permiso, ctrl.meta);
router.get('/marcas', permiso, ctrl.listarMarcas);
router.get('/lineas', permiso, ctrl.listarLineas);
router.get('/colores', permiso, ctrl.listarColores);
router.get('/clases', permiso, ctrl.listarClases);
router.get('/tipos-documento', permiso, ctrl.listarTiposDocumento);
router.get('/verificar-placa/:placa', permiso, ctrl.verificarPlaca);

router.get('/', permiso, ctrl.listar);
router.get('/:id/inspeccion', permiso, inspCtrl.listar);
router.get('/:id/inspeccion/hoy', permisoInspeccion, inspCtrl.obtenerDelDia);
router.put('/:id/inspeccion', permisoInspeccion, inspCtrl.guardar);
router.get('/:id/inspeccion/imprimir', permisoInspeccion, inspCtrl.imprimir);

router.get('/:id/documentos-requeridos', permiso, ctrl.documentosRequeridos);
router.get('/:id/documentos-validacion', permiso, ctrl.documentosValidacion);
router.get('/:id/documentos', permiso, ctrl.listarDocumentos);
router.post('/:id/documentos', permiso, upload.vehiculos.single('archivo'), ctrl.crearDocumento);
router.put(
  '/:id/documentos/:docId',
  permiso,
  upload.vehiculos.single('archivo'),
  ctrl.actualizarDocumento,
);
router.delete('/:id/documentos/:docId', permiso, ctrl.eliminarDocumento);

router.get('/:id', permiso, ctrl.porId);
router.post('/', permiso, upload.vehiculos.single('foto'), ctrl.crear);
router.put('/:id', permiso, upload.vehiculos.single('foto'), ctrl.actualizar);
router.delete('/:id', permiso, ctrl.eliminar);

module.exports = router;
