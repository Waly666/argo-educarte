const { Router } = require('express');
const ctrl = require('../controllers/dashboardController');
const { requireAuth, requirePermiso } = require('../middleware/auth');

const router = Router();
router.use(requireAuth);
router.get('/estadisticas', requirePermiso('dashboard'), ctrl.estadisticas);

module.exports = router;
