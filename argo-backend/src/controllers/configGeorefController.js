const { GEOREF_PROVEEDOR_LABELS, GEOREF_PROVEEDORES } = require('../constants/georefProveedor');
const { GEOREF_PROVEEDOR_HERE } = require('../constants/georefProveedor');
const {
  obtenerConfigGeoref,
  actualizarConfigGeoref,
  obtenerConfigGeorefInterno,
} = require('../services/configGeoref');
const { municipioPorCoords } = require('../services/georefMunicipio');

exports.obtenerMapa = async (_req, res, next) => {
  try {
    const cfg = await obtenerConfigGeorefInterno();
    res.json({
      proveedor: cfg.proveedor,
      hereApiKey:
        cfg.proveedor === GEOREF_PROVEEDOR_HERE && cfg.hereApiKey ? cfg.hereApiKey : '',
    });
  } catch (e) {
    next(e);
  }
};

exports.catalogoProveedores = (_req, res) => {
  res.json(
    GEOREF_PROVEEDORES.map((id) => ({
      id,
      label: GEOREF_PROVEEDOR_LABELS[id] || id,
    })),
  );
};

exports.obtener = async (_req, res, next) => {
  try {
    res.json(await obtenerConfigGeoref());
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    res.json(await actualizarConfigGeoref(req.body || {}));
  } catch (e) {
    next(e);
  }
};

exports.probar = async (req, res, next) => {
  try {
    const lat = req.query.lat ?? req.body?.lat;
    const lng = req.query.lng ?? req.body?.lng;
    if (lat == null || lng == null) {
      return res.status(400).json({ message: 'lat y lng son obligatorios' });
    }
    const cfg = await obtenerConfigGeoref();
    const resultado = await municipioPorCoords(lat, lng);
    res.json({ config: cfg, resultado });
  } catch (e) {
    next(e);
  }
};
