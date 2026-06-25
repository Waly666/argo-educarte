const InspTecPreop = require('../models/InspTecPreop');
const Vehiculo = require('../models/Vehiculo');
const { fechaHoyStr } = require('./inspeccionVehiculo');
const { placasConPracticaProgramadaEnFecha } = require('./vehiculoInspeccionOperacion');

const MAX_DETALLE = 24;

/** Solo vehículos con práctica CEA programada hoy y sin inspección del día. */
async function calcularAlertasInspeccionPendiente(fecha) {
  const f = fecha || fechaHoyStr();
  const { placas } = await placasConPracticaProgramadaEnFecha(f);

  if (!placas.length) {
    return {
      fecha: f,
      totalPendientes: 0,
      vehiculosAfectados: 0,
      alertas: [],
    };
  }

  const inspecciones = await InspTecPreop.find({ fecha: f, placa: { $in: placas } })
    .select('placa')
    .lean();
  const conInspeccion = new Set(inspecciones.map((i) => String(i.placa || '').trim()).filter(Boolean));

  const vehiculos = await Vehiculo.find({ placa: { $in: placas } })
    .select('_id placa nombreMarca nombreLinea claseVehiculo')
    .lean();
  const mapVeh = new Map(vehiculos.map((v) => [String(v.placa || '').trim(), v]));

  const alertas = [];
  for (const placa of placas) {
    if (conInspeccion.has(placa)) continue;
    const v = mapVeh.get(placa);
    alertas.push({
      placa,
      vehiculoId: v?._id ? String(v._id) : '',
      claseVehiculo: String(v?.claseVehiculo || '').trim(),
      marcaLinea: [v?.nombreMarca, v?.nombreLinea].filter(Boolean).join(' ').trim(),
    });
  }

  alertas.sort((a, b) => a.placa.localeCompare(b.placa, 'es'));

  return {
    fecha: f,
    totalPendientes: alertas.length,
    vehiculosAfectados: alertas.length,
    alertas: alertas.slice(0, MAX_DETALLE),
  };
}

module.exports = { calcularAlertasInspeccionPendiente };
