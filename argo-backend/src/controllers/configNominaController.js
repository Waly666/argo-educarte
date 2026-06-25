const Config = require('../models/Config');
const {
  obtenerConfigNomina,
  actualizarConfigNomina,
  restaurarConfigNominaDefaults,
  serializarParaApi,
} = require('../services/configNomina');

exports.obtener = async (_req, res, next) => {
  try {
    const cfg = await obtenerConfigNomina();
    const doc = await Config.findOne({ clave: 'nomina' }).lean();
    res.json({
      ...serializarParaApi(cfg),
      _fuente: doc ? 'base_datos' : 'valores_defecto',
      _actualizadoEn: doc?.updatedAt || null,
    });
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const user = req.user?.username || 'admin';
    const cfg = await actualizarConfigNomina(req.body, user);
    res.json(serializarParaApi(cfg));
  } catch (e) {
    next(e);
  }
};

exports.restaurar = async (req, res, next) => {
  try {
    const user = req.user?.username || 'admin';
    const cfg = await restaurarConfigNominaDefaults(user);
    res.json(serializarParaApi(cfg));
  } catch (e) {
    next(e);
  }
};
