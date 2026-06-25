const {
  guardarConfigRequisitosDocumentosVehiculos,
  obtenerConfigRequisitosDocumentosVehiculos,
} = require('../services/configRequisitosDocumentosVehiculos');

exports.obtener = async (_req, res, next) => {
  try {
    res.json(await obtenerConfigRequisitosDocumentosVehiculos());
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const saved = await guardarConfigRequisitosDocumentosVehiculos(req.body || {});
    res.json(saved);
  } catch (e) {
    next(e);
  }
};
