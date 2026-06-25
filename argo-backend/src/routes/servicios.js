const { Router } = require('express');
const ctrl = require('../controllers/servicioController');
const { requireAuth, requirePermiso, loadSedeActiva } = require('../middleware/auth');

const router = Router();

router.use(requireAuth);
router.use(loadSedeActiva);

const ver = requirePermiso('servicios.ver', 'servicios.gestionar');
const gestionar = requirePermiso('servicios.gestionar');

router.get('/', ver, ctrl.listar);
router.post('/', gestionar, ctrl.crear);
router.get('/:id', ver, ctrl.obtener);
router.put('/:id', gestionar, ctrl.actualizar);
router.delete('/:id', gestionar, ctrl.eliminar);

module.exports = router;
