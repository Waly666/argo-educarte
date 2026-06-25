const portal = require('../services/instructorPortal');

exports.miPerfil = async (req, res, next) => {
  try {
    const r = await portal.miPerfil(req);
    if (r.error) return res.status(r.status || 400).json({ message: r.error });
    res.json(r);
  } catch (e) {
    next(e);
  }
};

exports.actualizarMiPerfil = async (req, res, next) => {
  try {
    const r = await portal.actualizarMiPerfil(req, req.body || {});
    if (r.error) return res.status(r.status || 400).json({ message: r.error });
    res.json(r);
  } catch (e) {
    next(e);
  }
};

exports.misClases = async (req, res, next) => {
  try {
    const r = await portal.misClases(req, req.query || {});
    if (r.error) return res.status(r.status || 400).json({ message: r.error });
    res.json(r);
  } catch (e) {
    next(e);
  }
};

exports.misAlertas = async (req, res, next) => {
  try {
    const r = await portal.misAlertas(req);
    if (r.error) return res.status(r.status || 400).json({ message: r.error });
    res.json(r);
  } catch (e) {
    next(e);
  }
};
