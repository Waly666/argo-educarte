const { Router } = require('express');
const ctrl = require('../controllers/egresoController');
const reciboEgreso = require('../controllers/reciboEgresoController');
const upload = require('../middleware/upload');
const { requireAuth, loadSedeActiva, exigirSedeActiva, requirePermiso } = require('../middleware/auth');

const router = Router();
const soporte = upload.egresos.single('soporte');

router.use(requireAuth, loadSedeActiva, exigirSedeActiva);

const turno = requirePermiso('caja.turno');
const admin = requirePermiso('caja.admin');

router.get('/admin/todos', admin, ctrl.listarTodos);
router.get('/vehiculos-opciones', turno, ctrl.opcionesVehiculos);
router.get('/verificar-placa/:placa', turno, ctrl.verificarPlacaVehiculo);
router.get('/formas-pago', turno, ctrl.formasPago);
router.get('/', turno, ctrl.listar);
router.get('/:id/recibo', turno, reciboEgreso.datos);
router.get('/:id/recibo/html', turno, reciboEgreso.html);
router.get('/:id', turno, ctrl.obtener);
router.post('/', turno, soporte, ctrl.crear);
router.put('/:id', turno, soporte, ctrl.actualizar);
router.delete('/:id', turno, ctrl.eliminar);

module.exports = router;
