/** Clase de servicio (catálogo catTipServicio.claseServ). */
const CLASES_SERVICIO = ['Educativo', 'Consultoria', 'Asistencia Tecnica', 'Otro'];

const CLASE_SERV_DEFAULT = 'Otro';

function normalizarClaseServ(raw) {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  const hit = CLASES_SERVICIO.find((c) => c.toLowerCase() === t.toLowerCase());
  return hit || null;
}

module.exports = {
  CLASES_SERVICIO,
  CLASE_SERV_DEFAULT,
  normalizarClaseServ,
};
