const { guardarConfigRequisitosDocumentos, obtenerConfigRequisitosDocumentos } = require('../services/configRequisitosDocumentos');
const { invalidarCacheTipCap } = require('../services/tipoCapacitacionMatch');

exports.obtener = async (_req, res, next) => {
  try {
    res.json(await obtenerConfigRequisitosDocumentos());
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const saved = await guardarConfigRequisitosDocumentos(req.body || {});
    invalidarCacheTipCap();
    res.json(saved);
  } catch (e) {
    next(e);
  }
};
