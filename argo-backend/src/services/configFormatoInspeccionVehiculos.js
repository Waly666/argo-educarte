const Config = require('../models/Config');
const {
  CLAVE,
  DEFAULT_CONSECUTIVO,
  formatearConsecutivoInspeccion,
  previewConsecutivoInspeccion,
  reservarConsecutivoInspeccion,
} = require('./inspeccionConsecutivo');
const { plantillaChecklistPorVehiculo } = require('./catalogoInspeccionPreop');

async function obtenerConfigFormatoInspeccionVehiculos() {
  let found = await Config.findOne({ clave: CLAVE }).lean();
  if (!found) {
    found = (
      await Config.create({
        clave: CLAVE,
        ...DEFAULT_CONSECUTIVO,
      })
    ).toObject();
  }

  const prefijoConsecutivoInspeccion =
    String(found.prefijoConsecutivoInspeccion || DEFAULT_CONSECUTIVO.prefijoConsecutivoInspeccion).trim() ||
    DEFAULT_CONSECUTIVO.prefijoConsecutivoInspeccion;
  const consecutivoInspeccion = Math.max(0, Number(found.consecutivoInspeccion) || 0);

  return {
    clave: CLAVE,
    prefijoConsecutivoInspeccion,
    consecutivoInspeccion,
    proximoConsecutivoInspeccion: formatearConsecutivoInspeccion(
      prefijoConsecutivoInspeccion,
      consecutivoInspeccion + 1,
    ),
  };
}

async function guardarConfigFormatoInspeccionVehiculos(body) {
  const dto = { clave: CLAVE };
  if (body?.prefijoConsecutivoInspeccion != null) {
    dto.prefijoConsecutivoInspeccion =
      String(body.prefijoConsecutivoInspeccion).trim() || DEFAULT_CONSECUTIVO.prefijoConsecutivoInspeccion;
  }
  if (body?.consecutivoInspeccion != null) {
    dto.consecutivoInspeccion = Math.max(0, parseInt(String(body.consecutivoInspeccion), 10) || 0);
  }
  const updated = await Config.findOneAndUpdate({ clave: CLAVE }, dto, { new: true, upsert: true }).lean();
  const prefijoConsecutivoInspeccion =
    String(updated.prefijoConsecutivoInspeccion || DEFAULT_CONSECUTIVO.prefijoConsecutivoInspeccion).trim() ||
    DEFAULT_CONSECUTIVO.prefijoConsecutivoInspeccion;
  const consecutivoInspeccion = Math.max(0, Number(updated.consecutivoInspeccion) || 0);
  return {
    clave: CLAVE,
    prefijoConsecutivoInspeccion,
    consecutivoInspeccion,
    proximoConsecutivoInspeccion: formatearConsecutivoInspeccion(
      prefijoConsecutivoInspeccion,
      consecutivoInspeccion + 1,
    ),
  };
}

/** Compatibilidad: devuelve plantilla agrupada por secciones para un vehículo. */
async function itemsInspeccionPorClase(vehiculo) {
  return plantillaChecklistPorVehiculo(vehiculo);
}

module.exports = {
  CLAVE,
  obtenerConfigFormatoInspeccionVehiculos,
  guardarConfigFormatoInspeccionVehiculos,
  itemsInspeccionPorClase,
  previewConsecutivoInspeccion,
  reservarConsecutivoInspeccion,
  formatearConsecutivoInspeccion,
  DEFAULT_CONSECUTIVO,
};
