const {
  obtenerConfigContratoCap,
  actualizarConfigContratoCap,
} = require('../services/configContratoCap');
const { TIPOS_CONTRATO_CAP, TIPO_CONTRATO_CAP_LABELS } = require('../constants/tipoContratoCap');
const { CONDICIONES_IVA, CONDICION_IVA_LABELS } = require('../constants/facturacionElectronica');

exports.catalogos = (_req, res) => {
  res.json({
    tipos: TIPOS_CONTRATO_CAP.map((id) => ({ id, label: TIPO_CONTRATO_CAP_LABELS[id] || id })),
    condicionesIva: CONDICIONES_IVA.map((id) => ({ id, label: CONDICION_IVA_LABELS[id] || id })),
  });
};

exports.obtener = async (_req, res, next) => {
  try {
    res.json({ reglas: await obtenerConfigContratoCap() });
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const user = req.user?.username || req.user?.nombre || 'admin';
    const reglas = await actualizarConfigContratoCap(req.body || {}, user);
    res.json({ reglas });
  } catch (e) {
    next(e);
  }
};
