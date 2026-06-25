const { Router } = require('express');
const ctrl = require('../controllers/liquidacionController');
const { requireAuth, loadSedeActiva, exigirSedeActiva, requirePermiso } = require('../middleware/auth');

const router = Router();
router.use(requireAuth, loadSedeActiva, exigirSedeActiva);

const pagos = requirePermiso('alumnos.pagos', 'caja.cobros', 'caja.turno');

router.get('/con-saldo', pagos, ctrl.listarConSaldo);
router.get('/alumno/:numDoc', pagos, ctrl.listarPorAlumno);
router.get('/:id', pagos, ctrl.obtener);
router.post('/', pagos, ctrl.crear);
router.delete('/:id', pagos, ctrl.eliminar);

module.exports = router;
