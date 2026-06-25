const PlantillaCertificado = require('../models/PlantillaCertificado');
const {
  normalizarTipoCertificado,
  idPlantillaPorTipo,
  orientacionPorTipo,
  TIPOS,
} = require('./clasificacionCertificado');

/**
 * Resuelve la plantilla PNG para imprimir un certificado.
 * Prioridad: slot en Config. Certificados → plantilla activa del tipo → id guardado en el certificado.
 */
async function resolverPlantillaImpresion(config, tipoFormatoRaw, idPlantillaCert = null) {
  const tipo = normalizarTipoCertificado(tipoFormatoRaw) || TIPOS.CURSO;

  const idDef = idPlantillaPorTipo(config, tipo);
  if (idDef) {
    const p = await PlantillaCertificado.findById(idDef).lean();
    if (p && p.activa !== false) return p;
  }

  const ori = orientacionPorTipo(config, tipo);
  const porTipo = await PlantillaCertificado.findOne({
    tipoCertificado: tipo,
    orientacion: ori,
    activa: { $ne: false },
  })
    .sort({ updatedAt: -1 })
    .lean();
  if (porTipo) return porTipo;

  if (idPlantillaCert) {
    const stored = await PlantillaCertificado.findById(idPlantillaCert).lean();
    if (stored && stored.activa !== false) return stored;
  }

  return null;
}

module.exports = { resolverPlantillaImpresion };
