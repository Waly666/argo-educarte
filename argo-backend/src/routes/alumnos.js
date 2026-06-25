const { Router } = require('express');
const ctrl = require('../controllers/alumnoController');
const { requireAuth, requirePermiso } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = Router();
router.use(requireAuth);

const ver = requirePermiso('alumnos.ver', 'alumnos.gestionar', 'alumnos.pagos');
const gestionar = requirePermiso('alumnos.gestionar');

const files = upload.alumnos.fields([
  { name: 'foto', maxCount: 1 },
  { name: 'cedula', maxCount: 1 },
  { name: 'licencia', maxCount: 1 },
]);

router.get('/', ver, ctrl.listar);
router.get('/alertas-comprobantes-recientes', ver, ctrl.comprobantesRecientes);
router.get('/alertas-pago-hoy', ver, ctrl.alertasPagoHoy);
router.get('/verificar-doc/:numDoc', ver, ctrl.verificarDocumento);
router.get('/doc/:numDoc', ver, ctrl.porDocumento);
router.post('/escanear-cedula', gestionar, upload.memory.single('imagen'), ctrl.escanearCedula);
router.get('/:id/documentos-requeridos', ver, ctrl.documentosRequeridos);
router.get('/:id/indicadores-hoy', ver, ctrl.indicadoresHoy);
router.get('/:id/documentos-validacion', ver, ctrl.validarDocumentos);
router.put('/:id/documentos/:idDoc', gestionar, upload.alumnos.single('archivo'), ctrl.subirDocumento);
router.get('/:id', ver, ctrl.porId);
router.post('/', gestionar, files, ctrl.crear);
router.put('/:id', gestionar, files, ctrl.actualizar);
router.delete('/:id', gestionar, ctrl.eliminar);

module.exports = router;
