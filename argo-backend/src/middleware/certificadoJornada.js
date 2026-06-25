const Certificado = require('../models/Certificado');

/** Solo certificados automáticos de jornada (generadoAutoJornada). */
async function soloCertificadoJornada(req, res, next) {
  try {
    const c = await Certificado.findById(req.params.id).select('generadoAutoJornada').lean();
    if (!c) return res.status(404).json({ message: 'Certificado no encontrado' });
    if (!c.generadoAutoJornada) {
      return res.status(403).json({ message: 'Solo aplica a certificados generados por jornadas.' });
    }
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { soloCertificadoJornada };
