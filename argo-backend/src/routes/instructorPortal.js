const { Router } = require('express');
const ctrl = require('../controllers/instructorPortalController');
const { requireAuth, loadSedeActiva, requirePermiso } = require('../middleware/auth');

const router = Router();
const portal = requirePermiso('instructores.mi_portal', 'jornadas.operar', 'programacion_cea.operar');

router.use(requireAuth, loadSedeActiva, portal);

router.get('/mi-perfil', ctrl.miPerfil);
router.patch('/mi-perfil', ctrl.actualizarMiPerfil);
router.get('/mis-clases', ctrl.misClases);
router.get('/mis-alertas', ctrl.misAlertas);

module.exports = router;
