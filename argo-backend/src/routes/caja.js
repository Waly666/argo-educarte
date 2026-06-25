const { Router } = require('express');
const ctrl = require('../controllers/cajaSesionController');
const { requireAuth, loadSedeActiva, exigirSedeActiva, requirePermiso } = require('../middleware/auth');

const router = Router();
router.use(requireAuth, loadSedeActiva, exigirSedeActiva);

const turno = requirePermiso('caja.turno');
const admin = requirePermiso('caja.admin');

router.get('/sesiones/activa', turno, ctrl.activa);
router.get('/sesiones/activa/ingresos', turno, ctrl.ingresosSesionActiva);
router.get('/sesiones/activa/egresos', turno, ctrl.egresosSesionActiva);
router.get('/sesiones/abiertas', turno, ctrl.listarAbiertas);
router.get('/sesiones', turno, ctrl.listar);
router.get('/cierre-general/preview', admin, ctrl.previewCierreGeneral);
router.get('/cierre-general/estado-dia', admin, ctrl.estadoCierreGeneralDia);
router.get('/cierre-general', admin, ctrl.listarCierresGenerales);
router.post('/cierre-general', admin, ctrl.registrarCierreGeneral);
router.get('/descuadres/resumen-mensual', admin, ctrl.resumenDescuadresMensual);
router.get('/descuadres', admin, ctrl.listarDescuadres);
router.post('/descuadres/:idSesion/recalcular', admin, ctrl.recalcularDescuadre);
router.post('/sesiones/:idSesion/ingreso-cuadre', turno, ctrl.ingresoCuadreDescuadre);
router.get('/sesiones/:idSesion/ingresos', turno, ctrl.ingresosSesion);
router.get('/sesiones/:idSesion/egresos', turno, ctrl.egresosSesion);
router.get('/sesiones/:idSesion/resumen', turno, ctrl.resumen);
router.post('/sesiones/cerrar-multiples', admin, ctrl.cerrarMultiples);
router.post('/sesiones/abrir', turno, ctrl.abrir);
router.post('/sesiones/:idSesion/reabrir', admin, ctrl.reabrirSesion);
router.post('/sesiones/:idSesion/cerrar', turno, ctrl.cerrar);

module.exports = router;
