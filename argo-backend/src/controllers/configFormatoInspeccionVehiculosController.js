const {
  guardarConfigFormatoInspeccionVehiculos,
  obtenerConfigFormatoInspeccionVehiculos,
} = require('../services/configFormatoInspeccionVehiculos');

exports.obtener = async (_req, res, next) => {
  try {
    res.json(await obtenerConfigFormatoInspeccionVehiculos());
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const saved = await guardarConfigFormatoInspeccionVehiculos(req.body || {});
    res.json(saved);
  } catch (e) {
    next(e);
  }
};
