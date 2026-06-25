const { Router } = require('express');
const ctrl = require('../controllers/sedeController');
const { requireAuth, requirePermiso } = require('../middleware/auth');

const router = Router();
router.use(requireAuth);

router.get('/mias', ctrl.mias);
router.get('/', requirePermiso('sedes.ver', 'config.sedes', 'sedes.gestionar'), ctrl.listar);
router.post('/', requirePermiso('sedes.gestionar', 'config.sedes'), ctrl.crear);
router.patch('/:idSede', requirePermiso('sedes.gestionar', 'config.sedes'), ctrl.actualizar);

module.exports = router;
