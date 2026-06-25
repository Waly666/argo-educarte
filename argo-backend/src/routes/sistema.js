const path = require('path');
const { Router } = require('express');
const multer = require('multer');

const ctrl = require('../controllers/sistemaController');
const { requireAuth, requireAdmin, loadSedeActiva } = require('../middleware/auth');
const { BACKUP_DIR } = require('../services/respaldos');

const router = Router();

// Todo el módulo Sistema es exclusivo de administradores.
router.use(requireAuth, requireAdmin);

/** Subida de respaldos a restaurar (pueden pesar varios GB → disco, no memoria). */
const subidaRespaldo = multer({
  dest: path.join(BACKUP_DIR, '.subidos'),
  limits: { fileSize: 8 * 1024 * 1024 * 1024 },
});

/** Archivos Excel de migración (pequeños → memoria). */
const subidaExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

// Respaldos
router.get('/respaldos', ctrl.listarRespaldos);
router.post('/respaldos', ctrl.crearRespaldo);
router.get('/respaldos/progreso', ctrl.progresoOperacion);
router.get('/respaldos/config', ctrl.configRespaldos);
router.put('/respaldos/config', ctrl.actualizarConfigRespaldos);
router.get('/respaldos/:archivo/descargar', ctrl.descargarRespaldo);
router.delete('/respaldos/:archivo', ctrl.eliminarRespaldo);
router.post('/respaldos/:archivo/restaurar', ctrl.restaurarRespaldo);
router.post('/respaldos/restaurar-subido', subidaRespaldo.single('archivo'), ctrl.restaurarSubido);

// Puesta en cero (nueva empresa)
router.get('/reset-empresa', ctrl.infoReset);
router.post('/reset-empresa', ctrl.resetEmpresa);

// Migración de datos
router.get('/migracion/plantilla', ctrl.plantillaMigracion);
router.post('/migracion/validar', subidaExcel.single('archivo'), ctrl.validarMigracion);
router.post('/migracion/importar', loadSedeActiva, subidaExcel.single('archivo'), ctrl.importarMigracion);
router.get('/migracion/lotes', ctrl.lotesMigracion);

// Limpieza de tablas (soporte técnico)
router.get('/tablas/meta', ctrl.metaLimpiezaTablas);
router.get('/tablas', ctrl.listarTablas);
router.get('/tablas/:nombre/registros', ctrl.registrosTabla);
router.delete('/tablas/:nombre/vaciar', ctrl.vaciarTabla);
router.delete('/tablas/:nombre/registros', ctrl.borrarRegistrosTabla);

module.exports = router;
