const { generarHtmlCertificado } = require('../services/certificadoRender');
const { publicOriginFromReq } = require('../utils/publicOrigin');
const { armarDatosCertificado } = require('../services/certificadoRenderData');

async function armarDatos(id) {
  return armarDatosCertificado(id);
}

exports.html = async (req, res, next) => {
  try {
    const data = await armarDatos(req.params.id);
    if (!data) return res.status(404).send('Certificado no encontrado');
    const html = await generarHtmlCertificado(data, {
      publicOrigin: publicOriginFromReq(req),
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    next(e);
  }
};

exports.datos = async (req, res, next) => {
  try {
    const data = await armarDatos(req.params.id);
    if (!data) return res.status(404).json({ message: 'Certificado no encontrado' });
    res.json(data);
  } catch (e) {
    next(e);
  }
};
