const Usuario = require('../models/Usuario');
const { listarActivos, listarHistorial, obtenerMonitor, ACTIVOS_MINUTOS } = require('../services/actividadHttp');

async function enriquecerNombres(activos) {
  const ids = activos.map((a) => a.idUsuario).filter(Boolean);
  if (!ids.length) return activos;
  const users = await Usuario.find({ _id: { $in: ids } })
    .select('nombres apellidos username')
    .lean();
  const map = new Map(users.map((u) => [String(u._id), u]));
  return activos.map((a) => {
    const u = map.get(String(a.idUsuario));
    const nombre = u
      ? [u.nombres, u.apellidos].filter(Boolean).join(' ').trim()
      : a.nombreUsuario;
    return {
      ...a,
      nombreUsuario: nombre || a.usuario,
    };
  });
}

exports.activos = async (req, res, next) => {
  try {
    const minutos = Math.min(Math.max(Number(req.query.minutos) || ACTIVOS_MINUTOS, 1), 60);
    let rows = await listarActivos(minutos);
    rows = await enriquecerNombres(rows);
    res.json({
      minutosVentana: minutos,
      cantidad: rows.length,
      usuarios: rows,
    });
  } catch (e) {
    next(e);
  }
};

exports.historial = async (req, res, next) => {
  try {
    const { desde, hasta, usuario, idUsuario, limit, page } = req.query || {};
    const data = await listarHistorial({ desde, hasta, usuario, idUsuario, limit, page });
    const ids = [...new Set(data.items.map((i) => i.idUsuario).filter(Boolean))];
    let map = new Map();
    if (ids.length) {
      const users = await Usuario.find({ _id: { $in: ids } })
        .select('nombres apellidos username')
        .lean();
      map = new Map(
        users.map((u) => [
          String(u._id),
          [u.nombres, u.apellidos].filter(Boolean).join(' ').trim() || u.username,
        ]),
      );
    }
    data.items = data.items.map((i) => ({
      ...i,
      nombreUsuario: map.get(String(i.idUsuario)) || i.nombreUsuario || i.usuario,
    }));
    res.json(data);
  } catch (e) {
    next(e);
  }
};

exports.monitor = async (req, res, next) => {
  try {
    const minutos = Math.min(Math.max(Number(req.query.minutos) || ACTIVOS_MINUTOS, 1), 60);
    const data = await obtenerMonitor(minutos);
    data.usuarios = await enriquecerNombres(data.usuarios);
    res.json(data);
  } catch (e) {
    next(e);
  }
};
