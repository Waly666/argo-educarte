const { Router } = require('express');
const ctrl = require('../controllers/migracionMovimientosController');
const {
  requireAuth,
  loadSedeActiva,
  exigirSedeActiva,
  requireAdmin,
} = require('../middleware/auth');

const router = Router();

router.use(requireAuth);

router.get('/estado', ctrl.estado);
router.get('/config', requireAdmin, ctrl.obtenerConfig);
router.put('/config', requireAdmin, ctrl.actualizarConfig);

router.use(loadSedeActiva, exigirSedeActiva);

router.post('/matricula', ctrl.matriculaHistorica);
router.post('/pago', ctrl.pagoMigracion);

module.exports = router;
