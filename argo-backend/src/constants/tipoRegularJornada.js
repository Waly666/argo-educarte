/** Valores tipoAlumno / categoría certificado */
const TIPOS_REGULAR_JORNADA = ['Regular', 'Jornadas de Capacitación', 'Virtual'];

const TIPO_REGULAR_JORNADA_DEFAULT = 'Regular';
const TIPO_JORNADAS_CAPACITACION = 'Jornadas de Capacitación';
const TIPO_VIRTUAL = 'Virtual';

function normalizarTipoRegularJornada(val) {
  const t = String(val ?? '').trim();
  if (!t) return TIPO_REGULAR_JORNADA_DEFAULT;
  const exact = TIPOS_REGULAR_JORNADA.find((x) => x.toLowerCase() === t.toLowerCase());
  if (exact) return exact;
  if (/jornadas?\s*de\s*capacitaci[oó]n/i.test(t) || t === 'Jornada Capacitacion') {
    return TIPO_JORNADAS_CAPACITACION;
  }
  if (/^virtual$/i.test(t) || /aula\s*virtual/i.test(t)) return TIPO_VIRTUAL;
  if (/regular/i.test(t)) return 'Regular';
  return TIPO_REGULAR_JORNADA_DEFAULT;
}

module.exports = {
  TIPOS_REGULAR_JORNADA,
  TIPO_REGULAR_JORNADA_DEFAULT,
  TIPO_JORNADAS_CAPACITACION,
  TIPO_VIRTUAL,
  normalizarTipoRegularJornada,
};
