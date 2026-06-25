const { TIPOS } = require('../services/clasificacionCertificado');

/** Certificados académicos regulares (excluye jornadas de capacitación en carpa). */
function filtrosExcluirJornadaCapacitacion() {
  return {
    generadoAutoJornada: { $ne: true },
    tipoFormatoCert: { $ne: TIPOS.JORNADA_CAPACITACION },
    $or: [{ idJornada: null }, { idJornada: { $exists: false } }],
  };
}

module.exports = { filtrosExcluirJornadaCapacitacion };
