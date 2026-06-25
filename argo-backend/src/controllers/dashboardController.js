const {
  obtenerEstadisticasDashboard,
  parseFiltroFechas,
} = require('../services/dashboardStats');

exports.estadisticas = async (req, res, next) => {
  try {
    const filtro = parseFiltroFechas(req.query);
    const data = await obtenerEstadisticasDashboard(filtro);
    res.json(data);
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ message: e.message });
    next(e);
  }
};
