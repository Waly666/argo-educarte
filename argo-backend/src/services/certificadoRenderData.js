const Certificado = require('../models/Certificado');
const Liquidacion = require('../models/Liquidacion');
const DatosAlumno = require('../models/DatosAlumno');
const { models: cat } = require('../models/catalogos');
const { obtenerConfigCertificado } = require('./configCertificado');
const { buscarPrograma } = require('./programaServicio');
const {
  clasificarProgramaAsync,
  normalizarTipoCertificado,
  orientacionPorTipo,
  TIPOS_VALIDOS,
} = require('./clasificacionCertificado');
const { resolverPlantillaImpresion } = require('./plantillaCertificado');
const { numDocQuery } = require('../utils/numDoc');
const { codigoTipoDocumentoAlumno } = require('../utils/tipoDocCodigo');

async function armarDatosCertificado(id) {
  const cert = await Certificado.findById(id).lean();
  if (!cert) return null;

  const [config, alumno, liq] = await Promise.all([
    obtenerConfigCertificado(),
    DatosAlumno.findOne(numDocQuery(cert.numDoc)).lean(),
    cert.idLiquidacion ? Liquidacion.findById(cert.idLiquidacion).lean() : null,
  ]);

  const idProg = cert.idProg || liq?.idProg;
  const programa = idProg ? await buscarPrograma(idProg) : null;

  const tipo = alumno?.tipoDoc
    ? await cat.catTipoDoc
        .findOne({ $or: [{ idTipoDoc: alumno.tipoDoc }, { codigo: alumno.tipoDoc }] })
        .lean()
    : null;
  const tipoDocCod = codigoTipoDocumentoAlumno(alumno, tipo);

  const legacyFormato =
    cert.tipoFormatoCert ||
    (TIPOS_VALIDOS.includes(cert.tipoCertificado) ? cert.tipoCertificado : null);
  const tipoFormatoCert =
    normalizarTipoCertificado(legacyFormato) ||
    (await clasificarProgramaAsync(programa, cat.catTipoCapacitacion));

  const plantilla =
    (await resolverPlantillaImpresion(config, tipoFormatoCert, cert.idPlantilla)) || null;
  const plantillaFinal = plantilla || {
    orientacion: cert.orientacion || orientacionPorTipo(config, tipoFormatoCert),
    urlFondo: '',
  };

  return {
    config,
    plantilla: plantillaFinal,
    certificado: cert,
    alumno,
    programa,
    tipoDocCod,
    tipoFormatoCert,
    tipoCertificado: tipoFormatoCert,
  };
}

module.exports = { armarDatosCertificado };
