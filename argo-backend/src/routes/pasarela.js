const { Router } = require('express');
const cfgCtrl = require('../controllers/configPasarelaController');
const infCtrl = require('../controllers/informesVirtualesController');
const { requireAuth, requirePermiso } = require('../middleware/auth');

const router = Router();

const configPerm = requirePermiso('config.recibos', 'aula_virtual.gestionar', 'config.facturacion');
const informesPerm = requirePermiso('informes.ver', 'aula_virtual.gestionar', 'alumnos.ver');

router.get('/config', requireAuth, configPerm, cfgCtrl.obtener);
router.put('/config', requireAuth, configPerm, cfgCtrl.actualizar);
router.get('/config/publico', cfgCtrl.estadoPublico);

router.get('/informes/matriculas', requireAuth, informesPerm, infCtrl.matriculasVirtuales);
router.get('/informes/ingresos', requireAuth, informesPerm, infCtrl.ingresosEnLinea);
router.get('/informes/matriculas/export', requireAuth, informesPerm, infCtrl.exportarMatriculas);
router.get('/informes/ingresos/export', requireAuth, informesPerm, infCtrl.exportarIngresos);

module.exports = router;
