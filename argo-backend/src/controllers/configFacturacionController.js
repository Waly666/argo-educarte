const {
  obtenerConfigFacturacion,
  actualizarConfigFacturacion,
} = require('../services/configFacturacion');
const { probarConexionFactus, listarRangosFactus, emitirPruebaSandbox, limpiarFacturasPendientesFactus } = require('../services/facturaProveedor');
const { catalogos: catalogosFacturacion } = require('./facturacionController');

exports.obtener = async (_req, res, next) => {
  try {
    res.json(await obtenerConfigFacturacion());
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    res.json(await actualizarConfigFacturacion(req.body || {}));
  } catch (e) {
    next(e);
  }
};

exports.probar = async (_req, res, next) => {
  try {
    res.json(await probarConexionFactus());
  } catch (e) {
    next(e);
  }
};

exports.rangos = async (_req, res, next) => {
  try {
    res.json(await listarRangosFactus());
  } catch (e) {
    next(e);
  }
};

exports.probarEmision = async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await emitirPruebaSandbox({
      numberingRangeId: body.numberingRangeId ?? body.numbering_range_id,
    });
    if (body.numberingRangeId != null || body.numbering_range_id != null) {
      await actualizarConfigFacturacion({
        numberingRangeId: body.numberingRangeId ?? body.numbering_range_id,
      });
    }
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message, code: e.code, details: e.details });
    next(e);
  }
};

exports.limpiarPendientesFactus = async (req, res, next) => {
  try {
    const todas = req.body?.todas === true || req.body?.todasPendientes === true;
    res.json(await limpiarFacturasPendientesFactus({ todasPendientes: todas }));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message, details: e.details });
    next(e);
  }
};

exports.catalogos = catalogosFacturacion;
