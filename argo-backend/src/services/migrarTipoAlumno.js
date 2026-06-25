const DatosAlumno = require('../models/DatosAlumno');
const { TIPOS_ALUMNO, TIPO_ALUMNO_DEFAULT } = require('../constants/tipoAlumno');

/** Asigna tipoAlumno = Regular a registros sin valor válido (todos los históricos quedan Regular). */
async function migrarTipoAlumnoRegular() {
  await DatosAlumno.updateMany(
    { tipoAlumno: { $in: ['Jornada Capacitacion', 'Jornada Capacitación'] } },
    { $set: { tipoAlumno: 'Jornadas de Capacitación' } },
  );
  const res = await DatosAlumno.updateMany(
    { tipoAlumno: { $nin: TIPOS_ALUMNO } },
    { $set: { tipoAlumno: TIPO_ALUMNO_DEFAULT } },
  );
  if (res.modifiedCount > 0) {
    console.log(`[ARGO] tipoAlumno: ${res.modifiedCount} alumno(s) actualizado(s) a "${TIPO_ALUMNO_DEFAULT}"`);
  }
  return res.modifiedCount;
}

module.exports = { migrarTipoAlumnoRegular };
