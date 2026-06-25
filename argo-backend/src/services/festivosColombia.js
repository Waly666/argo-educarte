const { FESTIVOS_COLOMBIA, esFestivo, fechaIso } = require('../constants/jornadaCapacitacion');

/** Festivos Colombia — reutiliza lista central de jornadas + consulta por año. */
function listarFestivos(anio) {
  const y = Number(anio);
  if (!Number.isFinite(y)) return [...FESTIVOS_COLOMBIA];
  return FESTIVOS_COLOMBIA.filter((f) => String(f).startsWith(`${y}-`));
}

function esFestivoFecha(date) {
  return esFestivo(date instanceof Date ? date : new Date(date));
}

function tipoDiaCalendario(date, cfg = {}) {
  const d = date instanceof Date ? date : new Date(date);
  if (esFestivo(d)) return 'festivo';
  const dow = d.getDay();
  if (dow === 0) return 'domingo';
  if (dow === 6) return 'sabado';
  return 'normal';
}

function diaProgramable(date, bloque) {
  const tipo = tipoDiaCalendario(date);
  if (tipo === 'festivo') return bloque?.permiteFestivo === true;
  if (tipo === 'domingo') return bloque?.permiteDomingo === true;
  if (tipo === 'sabado') return bloque?.permiteSabado === true;
  return true;
}

function horarioParaDia(bloque, date) {
  if (!bloque) return null;
  const tipo = tipoDiaCalendario(date);
  if (tipo === 'festivo' && bloque.festivo) return bloque.festivo;
  if (tipo === 'domingo' && bloque.domingo) return bloque.domingo;
  if (tipo === 'sabado' && bloque.sabado) return bloque.sabado;
  return bloque.normal || { horaDesde: bloque.horaDesde, horaHasta: bloque.horaHasta };
}

module.exports = {
  listarFestivos,
  esFestivoFecha,
  tipoDiaCalendario,
  diaProgramable,
  horarioParaDia,
  fechaIso,
  FESTIVOS_COLOMBIA,
};
