const ClaseJornadaCap = require('../models/ClaseJornadaCap');
const JornadaCap = require('../models/JornadaCap');
const Contratacion = require('../models/Contratacion');

function sanitizeCodContrato(cod) {
  const s = String(cod || 'sin-contrato').trim();
  return s.replace(/[^\w.\-]+/g, '_') || 'sin-contrato';
}

/** Carga la clase y el código de contrato para guardar evidencia en evidenciascap/{cod}/fotos/. */
async function loadClaseParaEvidencia(req, res, next) {
  try {
    const clase = await ClaseJornadaCap.findById(req.params.id);
    if (!clase) return res.status(404).json({ message: 'Clase no encontrada' });

    let codContrato = 'sin-contrato';
    const jornada = await JornadaCap.findById(clase.idJornada).select('idContrato').lean();
    if (jornada?.idContrato) {
      const contrato = await Contratacion.findById(jornada.idContrato).select('codContrato').lean();
      codContrato = contrato?.codContrato || String(jornada.idContrato);
    }

    req.claseEvidencia = clase;
    req.evidenciaCapCodContrato = sanitizeCodContrato(codContrato);
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { loadClaseParaEvidencia, sanitizeCodContrato };
