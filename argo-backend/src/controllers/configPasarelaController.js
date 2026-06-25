const {
  obtenerConfigPasarela,
  guardarConfigPasarela,
} = require('../services/configPasarela');
const { publicOriginFromReq } = require('../utils/publicOrigin');

function webhookUrlSugerida(req, cfg) {
  const origin = publicOriginFromReq(req);
  if (origin) return `${origin}/api/webhooks/wompi`;
  return cfg?.webhookUrl || '';
}

exports.obtener = async (req, res, next) => {
  try {
    const cfg = await obtenerConfigPasarela();
    res.json({ ...cfg, webhookUrlSugerida: webhookUrlSugerida(req, cfg) });
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const cfg = await guardarConfigPasarela(req.body || {});
    res.json({ ...cfg, webhookUrlSugerida: webhookUrlSugerida(req, cfg) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.estadoPublico = async (_req, res, next) => {
  try {
    const cfg = await obtenerConfigPasarela();
    res.json({
      activo: cfg.activo === true,
      ambiente: cfg.ambiente,
      publicKey: cfg.publicKey || null,
    });
  } catch (e) {
    next(e);
  }
};
