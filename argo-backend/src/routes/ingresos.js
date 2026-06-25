const { Router } = require('express');
const ctrl = require('../controllers/ingresoController');
const recibo = require('../controllers/reciboController');
const upload = require('../middleware/upload');
const { requireAuth, loadSedeActiva, exigirSedeActiva, requirePermiso } = require('../middleware/auth');

const router = Router();
router.use(requireAuth, loadSedeActiva, exigirSedeActiva);

const pagos = requirePermiso('alumnos.pagos', 'caja.turno', 'caja.cobros');
const admin = requirePermiso('caja.admin');
const soporte = upload.ingresos.single('soporte');

router.get('/admin/todos', admin, ctrl.listarTodos);
router.get('/alumno/:numDoc', pagos, ctrl.listarPorAlumno);
router.get('/liquidacion/:idLiquidacion', pagos, ctrl.listarPorLiquidacion);
router.get('/:id/recibo', pagos, recibo.datos);
router.get('/:id/recibo/html', pagos, recibo.html);
router.post('/', pagos, soporte, ctrl.crear);
router.delete('/:id', pagos, ctrl.eliminar);

module.exports = router;
