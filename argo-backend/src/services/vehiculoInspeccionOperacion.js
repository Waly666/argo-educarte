const ClaseProgramadaCea = require('../models/ClaseProgramadaCea');
const InspTecPreop = require('../models/InspTecPreop');
const Vehiculo = require('../models/Vehiculo');
const { fechaHoyStr } = require('../utils/inspeccionClaseVehiculo');
const { parseFechaCalendario, hoyCalendario } = require('../utils/fechaCalendario');
const { inicioDia } = require('./estadoJornadaCap');

function rangoDiaCalendario(fechaStr) {
  const f = fechaStr || fechaHoyStr();
  const base = inicioDia(parseFechaCalendario(f) || hoyCalendario());
  const fin = new Date(base);
  fin.setHours(23, 59, 59, 999);
  return { fechaStr: f, inicio: base, fin };
}

function normalizarPlaca(placa) {
  return String(placa || '').trim().toUpperCase();
}

/** Placas con práctica CEA programada o en curso en la fecha (solo día de uso). */
async function placasConPracticaProgramadaEnFecha(fechaStr) {
  const { fechaStr: f, inicio, fin } = rangoDiaCalendario(fechaStr);
  const rows = await ClaseProgramadaCea.find({
    tipoClase: 'practica',
    estado: { $in: ['PROGRAMADA', 'EN PROCESO'] },
    fechaClase: { $gte: inicio, $lte: fin },
    idVehiculo: { $nin: [null, ''] },
    horaDesde: { $nin: [null, ''] },
  })
    .select('idVehiculo')
    .lean();

  const placas = new Set();
  for (const r of rows) {
    const p = normalizarPlaca(r.idVehiculo);
    if (p) placas.add(p);
  }
  return { fecha: f, placas: [...placas] };
}

async function inspeccionRegistradaHoy(placa, fechaStr) {
  const p = normalizarPlaca(placa);
  if (!p) return true;
  const f = fechaStr || fechaHoyStr();
  const row = await InspTecPreop.findOne({ placa: p, fecha: f }).lean();
  return !!row;
}

async function vehiculoPorPlaca(placa) {
  const p = normalizarPlaca(placa);
  if (!p) return null;
  return Vehiculo.findOne({ placa: p }).select('_id placa nombreMarca nombreLinea claseVehiculo').lean();
}

/**
 * Bloqueo para iniciar práctica: solo exige inspección el día en que hay clase (hoy).
 * No acumula días sin uso.
 */
async function bloqueoInspeccionParaIniciarClase(clase, fechaStr) {
  if (!clase || String(clase.tipoClase || '') !== 'practica') return null;

  const placa = normalizarPlaca(clase.idVehiculo);
  if (!placa) {
    return {
      codigo: 'sin_vehiculo',
      message: 'La clase práctica debe tener un vehículo asignado antes de iniciar.',
      placa: '',
      vehiculoId: null,
    };
  }

  const f = fechaStr || fechaHoyStr();
  const fc = parseFechaCalendario(clase.fechaClase);
  const hoy = inicioDia(parseFechaCalendario(f) || hoyCalendario());
  if (!fc || fc.getTime() !== hoy.getTime()) {
    return null;
  }

  const ins = await InspTecPreop.findOne({ placa, fecha: f }).lean();
  if (!ins) {
    const veh = await vehiculoPorPlaca(placa);
    return {
      codigo: 'inspeccion_pendiente',
      message: `Debe completar la inspección preoperacional de hoy del vehículo ${placa} antes de iniciar la clase.`,
      placa,
      vehiculoId: veh?._id ? String(veh._id) : null,
    };
  }

  if (ins.aptoLaborar === false) {
    const veh = await vehiculoPorPlaca(placa);
    return {
      codigo: 'vehiculo_no_apto',
      message: `El vehículo ${placa} fue marcado como no apto para laborar en la inspección de hoy.`,
      placa,
      vehiculoId: veh?._id ? String(veh._id) : null,
    };
  }

  return null;
}

module.exports = {
  rangoDiaCalendario,
  placasConPracticaProgramadaEnFecha,
  inspeccionRegistradaHoy,
  vehiculoPorPlaca,
  bloqueoInspeccionParaIniciarClase,
};
