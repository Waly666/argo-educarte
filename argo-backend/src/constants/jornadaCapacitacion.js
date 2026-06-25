const ESTADO_JORNADA_INACTIVO = 'INACTIVO';
const ESTADO_JORNADA_EN_PROCESO = 'EN PROCESO';
const ESTADO_JORNADA_FINALIZADO = 'FINALIZADO';
const ESTADOS_JORNADA = [
  ESTADO_JORNADA_INACTIVO,
  ESTADO_JORNADA_EN_PROCESO,
  ESTADO_JORNADA_FINALIZADO,
];
const ESTADOS_CLASE = ['PROGRAMADA', 'EN PROCESO', 'FINALIZADO'];

/** Origen de lat/lng en jornada (web mapa, app móvil, o digitado). */
const DETE_GEOREFE_MAPA = 'MAPA';
const DETE_GEOREFE_DISPOSITIVO = 'DISPOSITIVO_MOVIL';
const DETE_GEOREFE_MANUAL = 'MANUAL';
const DETE_GEOREFE_VALORES = [DETE_GEOREFE_MAPA, DETE_GEOREFE_DISPOSITIVO, DETE_GEOREFE_MANUAL];

const UBICACIONES_CLASE = [
  'Carpa',
  'Domo',
  'Empresa',
  'Colegio',
  'Auditorio',
  'Coliseo',
  'Estadio',
  'Otro',
];

/** Festivos Colombia (lista fija YYYY-MM-DD) */
const FESTIVOS_COLOMBIA = [
  '2025-01-01',
  '2025-01-06',
  '2025-03-24',
  '2025-04-17',
  '2025-04-18',
  '2025-05-01',
  '2025-06-02',
  '2025-06-23',
  '2025-06-30',
  '2025-08-07',
  '2025-08-18',
  '2025-10-13',
  '2025-11-03',
  '2025-11-17',
  '2025-12-08',
  '2025-12-25',
  '2026-01-01',
  '2026-01-12',
  '2026-03-23',
  '2026-04-02',
  '2026-04-03',
  '2026-05-01',
  '2026-05-18',
  '2026-06-15',
  '2026-06-29',
  '2026-08-07',
  '2026-08-17',
  '2026-10-12',
  '2026-11-02',
  '2026-11-16',
  '2026-12-08',
  '2026-12-25',
  '2027-01-01',
  '2027-01-11',
  '2027-03-22',
  '2027-03-26',
  '2027-05-01',
  '2027-05-17',
  '2027-06-07',
  '2027-06-14',
  '2027-08-07',
  '2027-08-16',
  '2027-10-18',
  '2027-11-01',
  '2027-11-15',
  '2027-12-08',
  '2027-12-25',
];

const FESTIVOS_SET = new Set(FESTIVOS_COLOMBIA);

function fechaIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function esFestivo(date) {
  return FESTIVOS_SET.has(fechaIso(date));
}

function esDiaProgramable(date, { incluiSab, incluiDom, incluiFest }) {
  const dow = date.getDay();
  if (dow === 0 && !incluiDom) return false;
  if (dow === 6 && !incluiSab) return false;
  if (!incluiFest && esFestivo(date)) return false;
  return true;
}

module.exports = {
  ESTADO_JORNADA_INACTIVO,
  ESTADO_JORNADA_EN_PROCESO,
  ESTADO_JORNADA_FINALIZADO,
  ESTADOS_JORNADA,
  ESTADOS_CLASE,
  DETE_GEOREFE_MAPA,
  DETE_GEOREFE_DISPOSITIVO,
  DETE_GEOREFE_MANUAL,
  DETE_GEOREFE_VALORES,
  UBICACIONES_CLASE,
  FESTIVOS_COLOMBIA,
  esFestivo,
  esDiaProgramable,
  fechaIso,
};
