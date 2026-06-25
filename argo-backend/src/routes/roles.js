const { Router } = require('express');
const ctrl = require('../controllers/rolAppController');
const { requireAuth, requirePermiso } = require('../middleware/auth');

const router = Router();

router.use(requireAuth);
router.get('/catalogo', requirePermiso('config.roles'), ctrl.catalogo);
router.get('/', requirePermiso('config.roles'), ctrl.listar);
router.post('/reiniciar-sistema', requirePermiso('config.roles'), ctrl.reiniciarSistema);
router.get('/:codigo', requirePermiso('config.roles'), ctrl.obtener);
router.post('/', requirePermiso('config.roles'), ctrl.crear);
router.put('/:codigo', requirePermiso('config.roles'), ctrl.actualizar);
router.delete('/:codigo', requirePermiso('config.roles'), ctrl.eliminar);

module.exports = router;
