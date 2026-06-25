/**
 * Fechas solo-calendario (YYYY-MM-DD): sin desfase por UTC en Colombia / América.
 */

function partesCalendarioDesdeDate(val) {
  if (!(val instanceof Date) || Number.isNaN(val.getTime())) return null;
  const h = val.getUTCHours();
  const m = val.getUTCMinutes();
  const s = val.getUTCSeconds();
  const ms = val.getUTCMilliseconds();
  // Medianoche UTC (legacy) o mediodía UTC (almacenamiento nuevo): día civil = partes UTC.
  if ((h === 0 || h === 12) && m === 0 && s === 0 && ms === 0) {
    return { y: val.getUTCFullYear(), mo: val.getUTCMonth(), d: val.getUTCDate() };
  }
  return { y: val.getFullYear(), mo: val.getMonth(), d: val.getDate() };
}

function parseFechaCalendario(val) {
  if (val == null || val === '') return null;

  if (val instanceof Date) {
    const p = partesCalendarioDesdeDate(val);
    if (!p) return null;
    return new Date(p.y, p.mo, p.d, 0, 0, 0, 0);
  }

  const s = String(val).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const out = new Date(y, mo, d, 0, 0, 0, 0);
    return Number.isNaN(out.getTime()) ? null : out;
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const p = partesCalendarioDesdeDate(d);
  if (!p) return null;
  return new Date(p.y, p.mo, p.d, 0, 0, 0, 0);
}

/** Guarda en Mongo como mediodía UTC del día civil (estable al mostrar en cualquier TZ). */
function fechaCalendarioParaGuardar(val) {
  const d = parseFechaCalendario(val);
  if (!d) return null;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0));
}

function fechaCalendarioIso(val) {
  const d = parseFechaCalendario(val);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hoyCalendario() {
  return parseFechaCalendario(new Date());
}

module.exports = {
  parseFechaCalendario,
  fechaCalendarioParaGuardar,
  fechaCalendarioIso,
  hoyCalendario,
};
