const { Router } = require('express');
const ctrl = require('../controllers/auditoriaController');
const { requireAuth, requirePermiso } = require('../middleware/auth');

const router = Router();
router.use(requireAuth, requirePermiso('config.auditoria'));

router.get('/', ctrl.listar);
router.get('/:idAuditoria', ctrl.obtener);

module.exports = router;
