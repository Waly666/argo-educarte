const { Router } = require('express');
const ctrl = require('../controllers/combosController');
const { requireAuth, loadSedeActiva, exigirSedeActiva, requirePermiso } = require('../middleware/auth');

const router = Router();
router.use(requireAuth);

const gestionar = requirePermiso('combos.gestionar', 'alumnos.pagos', 'alumnos.gestionar');

router.get('/', gestionar, ctrl.listar);
router.get('/:id', gestionar, ctrl.obtener);
router.get('/:id/prevista', gestionar, ctrl.prevista);
router.post('/', gestionar, ctrl.crear);
router.put('/:id', gestionar, ctrl.actualizar);
router.delete('/:id', gestionar, ctrl.eliminar);

/* Aplicar combo a un alumno — requiere sede activa */
router.post('/:id/aplicar', gestionar, loadSedeActiva, exigirSedeActiva, ctrl.aplicar);

module.exports = router;
