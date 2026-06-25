const {
  guardarConfigRequisitosDocumentosEmpleados,
  obtenerConfigRequisitosDocumentosEmpleados,
} = require('../services/configRequisitosDocumentosEmpleados');
const Cargo = require('../models/Cargo');

exports.obtener = async (_req, res, next) => {
  try {
    const config = await obtenerConfigRequisitosDocumentosEmpleados();
    const cargos = await Cargo.find({}).sort({ idCargo: 1 }).lean();
    res.json({
      ...config,
      cargos: cargos
        .map((c) => ({
          idCargo: String(c.idCargo ?? '').trim(),
          label: String(c.nombre || c.idCargo || '').trim(),
        }))
        .filter((c) => c.idCargo),
    });
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const saved = await guardarConfigRequisitosDocumentosEmpleados(req.body || {});
    const cargos = await Cargo.find({}).sort({ idCargo: 1 }).lean();
    res.json({
      ...saved,
      cargos: cargos
        .map((c) => ({
          idCargo: String(c.idCargo ?? '').trim(),
          label: String(c.nombre || c.idCargo || '').trim(),
        }))
        .filter((c) => c.idCargo),
    });
  } catch (e) {
    next(e);
  }
};
