const ROLES_SISTEMA = ['admin', 'usuario', 'cajero', 'instructor', 'recepcion'];
/** @deprecated use listarRolesActivos — se mantiene por compatibilidad */
const ROLES_VALIDOS = ROLES_SISTEMA;

/** Alias legacy explícitos (sin heurísticas por substring). */
const ALIAS_ROL = {
  administrador: 'admin',
  caj: 'cajero',
  inst: 'instructor',
  rec: 'recepcion',
};

function normalizarRol(r) {
  if (!r) return 'usuario';
  const v = String(r).trim().toLowerCase();
  if (ALIAS_ROL[v]) return ALIAS_ROL[v];
  if (ROLES_SISTEMA.includes(v)) return v;
  if (/^[a-z][a-z0-9_-]{1,39}$/.test(v)) return v;
  return 'usuario';
}

function esAdmin(rol) {
  return normalizarRol(rol) === 'admin';
}

function puedeGestionarProgramas(rol) {
  const r = normalizarRol(rol);
  return r === 'admin' || r === 'recepcion' || r === 'cajero' || r === 'usuario';
}

function puedeGestionarServicios(rol) {
  return puedeGestionarProgramas(rol);
}

module.exports = {
  ROLES_VALIDOS,
  ROLES_SISTEMA,
  normalizarRol,
  esAdmin,
  puedeGestionarProgramas,
  puedeGestionarServicios,
};
