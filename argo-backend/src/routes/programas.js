const { Router } = require('express');
const ctrl = require('../controllers/programaController');
const { requireAuth, requirePermiso, loadSedeActiva } = require('../middleware/auth');
const { programasVirtual } = require('../middleware/upload');

const router = Router();

router.use(requireAuth);
router.use(loadSedeActiva);

const ver = requirePermiso('programas.ver', 'programas.gestionar', 'programas.agregar');
const agregar = requirePermiso('programas.agregar', 'programas.gestionar');
const gestionar = requirePermiso('programas.gestionar');

router.get('/', ver, ctrl.listar);
router.get('/:id/matriculas', ver, ctrl.matriculas);
router.get('/:id', ver, ctrl.obtener);
router.post('/', agregar, ctrl.crear);
router.post(
  '/:id/portada-virtual',
  gestionar,
  programasVirtual.single('portada'),
  ctrl.subirPortadaVirtual,
);
router.put('/:id', gestionar, ctrl.actualizar);
router.delete('/:id', gestionar, ctrl.eliminar);

module.exports = router;
