const { Router } = require('express');
const ctrl = require('../controllers/informeController');
const { requireAuth, requirePermiso, loadSedeActiva } = require('../middleware/auth');

const router = Router();
router.use(requireAuth);
router.use(loadSedeActiva);

const ver = requirePermiso(
  'informes.ver',
  'alumnos.ver',
  'alumnos.gestionar',
  'programas.ver',
  'programas.gestionar',
  'programas.agregar',
  'servicios.ver',
  'servicios.gestionar',
);

router.get('/catalogo', ver, ctrl.catalogo);
router.get('/:id', ver, ctrl.obtener);
router.get('/:id/ejecutar', ver, ctrl.ejecutar);
router.get('/:id/exportar', ver, ctrl.exportar);

module.exports = router;
