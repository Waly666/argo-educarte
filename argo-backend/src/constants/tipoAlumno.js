const {
  TIPOS_REGULAR_JORNADA,
  TIPO_REGULAR_JORNADA_DEFAULT,
  TIPO_JORNADAS_CAPACITACION,
  TIPO_VIRTUAL,
  normalizarTipoRegularJornada,
} = require('./tipoRegularJornada');

/** Valores permitidos para datosAlumnos.tipoAlumno */
const TIPOS_ALUMNO = TIPOS_REGULAR_JORNADA;
const TIPO_ALUMNO_DEFAULT = TIPO_REGULAR_JORNADA_DEFAULT;
const normalizarTipoAlumno = normalizarTipoRegularJornada;

module.exports = {
  TIPOS_ALUMNO,
  TIPO_ALUMNO_DEFAULT,
  TIPO_JORNADAS_CAPACITACION,
  TIPO_VIRTUAL,
  normalizarTipoAlumno,
};
