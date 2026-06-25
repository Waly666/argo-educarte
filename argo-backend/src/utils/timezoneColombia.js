/** Zona horaria de negocio ARGO (Colombia, UTC−5). */
const TZ_COLOMBIA = 'America/Bogota';

/** Partes Y-M-D del instante en calendario Colombia. */
function partesCalendarioColombia(d) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_COLOMBIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(dt);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const y = Number(get('year'));
  const m = Number(get('month'));
  const day = Number(get('day'));
  if (!y || !m || !day) return null;
  return { y, m, d: day };
}

/**
 * Día calendario de una fecha guardada desde date picker (YYYY-MM-DD → medianoche UTC).
 * No usar zona local del servidor: el día elegido es el UTC date, no el instante en Bogotá.
 */
function partesFechaSoloAlmacenada(d) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
  };
}

function numeroDiaCalendario(p) {
  return Math.floor(Date.UTC(p.y, p.m - 1, p.d) / 86400000);
}

function diffDiasCalendario(desde, hasta) {
  return numeroDiaCalendario(hasta) - numeroDiaCalendario(desde);
}

function fmtFecha(d, { dateStyle = 'short', timeStyle = 'short' } = {}) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleString('es-CO', { dateStyle, timeStyle, timeZone: TZ_COLOMBIA });
}

function fmtFechaSolo(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: TZ_COLOMBIA,
  });
}

module.exports = {
  TZ_COLOMBIA,
  partesCalendarioColombia,
  partesFechaSoloAlmacenada,
  diffDiasCalendario,
  fmtFecha,
  fmtFechaSolo,
};
