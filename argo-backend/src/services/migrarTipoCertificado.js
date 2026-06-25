const Certificado = require('../models/Certificado');
const { TIPOS_VALIDOS } = require('./clasificacionCertificado');
const {
  TIPOS_REGULAR_JORNADA,
  TIPO_REGULAR_JORNADA_DEFAULT,
} = require('../constants/tipoRegularJornada');

/**
 * 1) Mueve clasificación de formato (curso, tecnico, …) de tipoCertificado → tipoFormatoCert.
 * 2) Asigna tipoCertificado = Regular a todos los que no tengan Regular | Jornada Capacitacion.
 */
async function migrarTipoCertificadoRegular() {
  const formatos = await Certificado.find({
    tipoCertificado: { $in: TIPOS_VALIDOS },
    $or: [
      { tipoFormatoCert: { $exists: false } },
      { tipoFormatoCert: null },
      { tipoFormatoCert: '' },
    ],
  }).select('_id tipoCertificado');

  let movidos = 0;
  for (const c of formatos) {
    await Certificado.updateOne(
      { _id: c._id },
      { $set: { tipoFormatoCert: c.tipoCertificado } },
    );
    movidos += 1;
  }
  if (movidos > 0) {
    console.log(`[ARGO] tipoFormatoCert: ${movidos} certificado(s) con formato migrado desde tipoCertificado`);
  }

  await Certificado.updateMany(
    { tipoCertificado: { $in: ['Jornada Capacitacion', 'Jornada Capacitación'] } },
    { $set: { tipoCertificado: 'Jornadas de Capacitación' } },
  );
  const res = await Certificado.updateMany(
    { tipoCertificado: { $nin: TIPOS_REGULAR_JORNADA } },
    { $set: { tipoCertificado: TIPO_REGULAR_JORNADA_DEFAULT } },
  );
  if (res.modifiedCount > 0) {
    console.log(
      `[ARGO] tipoCertificado: ${res.modifiedCount} certificado(s) actualizado(s) a "${TIPO_REGULAR_JORNADA_DEFAULT}"`,
    );
  }
  return res.modifiedCount;
}

module.exports = { migrarTipoCertificadoRegular };
