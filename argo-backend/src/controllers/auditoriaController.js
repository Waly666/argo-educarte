const Auditoria = require('../models/Auditoria');

exports.listar = async (req, res, next) => {
  try {
    const {
      desde,
      hasta,
      usuario,
      accion,
      entidad,
      ruta,
      limit: limitRaw,
      page: pageRaw,
    } = req.query || {};

    const filter = {};
    if (desde || hasta) {
      filter.fecha = {};
      if (desde) filter.fecha.$gte = new Date(desde);
      if (hasta) filter.fecha.$lte = new Date(hasta);
    }
    if (usuario) filter.usuario = new RegExp(String(usuario).trim(), 'i');
    if (accion) filter.accion = String(accion).trim();
    if (entidad) filter.entidad = new RegExp(String(entidad).trim(), 'i');
    if (ruta) filter.ruta = new RegExp(String(ruta).trim(), 'i');

    const limit = Math.min(Math.max(Number(limitRaw) || 50, 1), 200);
    const page = Math.max(Number(pageRaw) || 1, 1);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Auditoria.find(filter).sort({ fecha: -1, idAuditoria: -1 }).skip(skip).limit(limit).lean(),
      Auditoria.countDocuments(filter),
    ]);

    res.json({ items, total, page, limit, pages: Math.ceil(total / limit) || 1 });
  } catch (e) {
    next(e);
  }
};

exports.obtener = async (req, res, next) => {
  try {
    const id = Number(req.params.idAuditoria);
    const doc = await Auditoria.findOne({ idAuditoria: id }).lean();
    if (!doc) return res.status(404).json({ message: 'Registro no encontrado' });
    res.json(doc);
  } catch (e) {
    next(e);
  }
};
