const { Router } = require('express');
const ctrl = require('../controllers/actividadController');
const { requireAuth, requirePermiso } = require('../middleware/auth');

const router = Router();
router.use(requireAuth, requirePermiso('config.auditoria'));

router.get('/activos', ctrl.activos);
router.get('/monitor', ctrl.monitor);
router.get('/historial', ctrl.historial);

module.exports = router;
