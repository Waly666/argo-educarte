const { Router } = require('express');
const ctrl = require('../controllers/certificadoController');
const render = require('../controllers/certificadoRenderController');
const plantilla = require('../controllers/plantillaCertificadoController');
const upload = require('../middleware/upload');
const { requireAuth, requirePermiso, requireAdmin } = require('../middleware/auth');
const { actualizarCertificadosVencidos } = require('../services/certificadoVencimientoCron');

const router = Router();
router.use(requireAuth);

const emitir = requirePermiso('alumnos.certificados');
const verVencidos = requirePermiso('certificados.vencidos', 'alumnos.certificados');
const verCertAlertas = requirePermiso('alumnos.certificados', 'jornadas.ver', 'jornadas.gestionar');
const config = requirePermiso('config.certificados');

router.get('/tipos', emitir, ctrl.tiposCertificado);
router.get('/plantillas', emitir, plantilla.listar);
router.get('/plantillas/todas', config, plantilla.listarTodas);
router.post('/plantillas', config, upload.certificados.single('fondo'), plantilla.crear);
router.put('/plantillas/:id', config, upload.certificados.single('fondo'), plantilla.actualizar);
router.delete('/plantillas/:id', config, plantilla.eliminar);

/** Disparo manual del cron de vencimiento (solo admin) */
router.post('/admin/marcar-vencidos', requireAdmin, async (req, res, next) => {
  try {
    const result = await actualizarCertificadosVencidos();
    res.json({
      ok: true,
      actualizados: result.actualizados,
      message: result.actualizados > 0
        ? `${result.actualizados} certificado(s) marcado(s) como vencido.`
        : 'No había certificados nuevos por marcar como vencidos.',
      ...(result.error ? { error: result.error } : {}),
    });
  } catch (e) {
    next(e);
  }
});

router.get('/recientes', verCertAlertas, ctrl.recientes);
router.get('/listado', emitir, ctrl.listarGlobal);
router.get('/vencidos/exportar', verVencidos, ctrl.exportarVencidos);
router.get('/vencidos', verVencidos, ctrl.listarVencidos);
router.get('/alertas-vencimiento', verCertAlertas, ctrl.alertasPorVencer);
router.get('/alertas-por-vencer', verCertAlertas, ctrl.alertasPorVencer);
router.get('/alertas-vencidos', verCertAlertas, ctrl.alertasVencidos);
router.get('/elegibles/:numDoc', emitir, ctrl.elegibles);
router.get('/alumno/:numDoc', emitir, ctrl.listarPorAlumno);
router.get('/:id/html', emitir, render.html);
router.get('/:id/datos', emitir, render.datos);
router.post('/', emitir, ctrl.crear);
router.put('/:id', emitir, ctrl.actualizar);
router.delete('/:id', emitir, ctrl.eliminar);

module.exports = router;
