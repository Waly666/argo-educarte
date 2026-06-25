const { GRUPOS } = require('../constants/alarmasCatalogo');
const { obtenerConfigAlertas, actualizarConfigAlertas } = require('../services/configAlertas');

exports.catalogos = (_req, res) => {
  res.json({
    grupos: GRUPOS,
    ventanasInicio: [
      { id: 'desde_registro', label: 'Desde que se genera el registro' },
      { id: 'desde_inicio_dia', label: 'Desde inicio del día (medianoche)' },
    ],
  });
};

exports.obtener = async (_req, res, next) => {
  try {
    res.json({ reglas: await obtenerConfigAlertas() });
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const user = req.user?.username || req.user?.nombre || 'admin';
    const reglas = await actualizarConfigAlertas(req.body || {}, user);
    res.json({ reglas });
  } catch (e) {
    next(e);
  }
};
