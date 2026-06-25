const mongoose = require('mongoose');
const Liquidacion = require('../models/Liquidacion');
const { num } = require('./programaServicio');

function toDec(n) {
  return mongoose.Types.Decimal128.fromString(String(Number(n) || 0));
}

/**
 * Crea liquidaciones pendientes por servicios adicionales configurados.
 * @returns {Promise<Array>} documentos Liquidacion creados
 */
async function crearLiquidacionesServiciosAdicionales({
  items,
  numDoc,
  idSede,
  idMatricula,
  idProg,
  idAlumno,
  fechaCreacion,
  extras = {},
}) {
  if (!items?.length) return [];
  const fecha = fechaCreacion || new Date();
  const creadas = [];

  for (const item of items) {
    const v = Math.round(num(item.valor));
    if (v <= 0) continue;
    const liq = await Liquidacion.create({
      numDoc,
      idSede,
      idAlumno: idAlumno ? String(idAlumno) : null,
      idMatricula,
      idMat: idMatricula,
      idProg: idProg ? String(idProg) : null,
      idServ: String(item.idServ),
      descripcion: item.descripcion,
      valor: toDec(v),
      abonado: toDec(0),
      saldo: toDec(v),
      estado: 'pendiente',
      esRevalidacion: false,
      esServicioAdicionalConfig: true,
      reglaServicioAdicionalId: item.reglaId || null,
      fechaCreacion: fecha,
      ...extras,
    });
    creadas.push(liq);
  }

  return creadas;
}

module.exports = {
  crearLiquidacionesServiciosAdicionales,
};
