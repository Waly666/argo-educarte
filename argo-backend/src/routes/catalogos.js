const { Router } = require('express');
const ctrl = require('../controllers/catalogoController');
const { requireAuth, loadSedeActiva, requirePermiso } = require('../middleware/auth');

const router = Router();
const admin = requirePermiso('config.catalogos');

router.use(requireAuth, loadSedeActiva);

router.get('/meta', admin, ctrl.meta);
router.post('/recargar-excel', admin, ctrl.recargarExcel);

router.get('/divipola/departamentos', ctrl.departamentos);
router.get('/divipola/buscar', ctrl.buscarMunicipios);
router.get('/divipola/municipio/:codMunicipio', ctrl.municipioPorCodigo);
router.get('/divipola/municipios/:codDepto', ctrl.municipios);

router.post('/:nombre/importar', admin, ctrl.importar);
router.post('/:nombre', admin, ctrl.crear);
router.put('/:nombre/:id', admin, ctrl.actualizar);
router.delete('/:nombre/:id', admin, ctrl.eliminar);
router.get('/:nombre', ctrl.listar);

module.exports = router;
