const { verifyPortalToken } = require('../services/aulaVirtualAuth');

function requirePortalAuth(req, res, next) {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7).trim() : '';
    if (!token) return res.status(401).json({ message: 'No autenticado' });
    const payload = verifyPortalToken(token);
    req.portalUser = {
      email: payload.email,
      numDoc: Number(payload.sub),
      tipo: payload.tipo,
    };
    next();
  } catch (e) {
    return res.status(e.status || 401).json({ message: e.message || 'Token inválido' });
  }
}

module.exports = { requirePortalAuth };
