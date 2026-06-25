const Usuario = require('../models/Usuario');
const { normalizarRol } = require('../utils/roles');
const { datosRol, nombreRol } = require('./rolesPermisos');
const { empleadoPorUsuarioId, nombreEmpleado, esEmpleadoInstructor } = require('./instructorJornada');
const { sedesPermitidasUsuario, asegurarSedePrincipal } = require('./sedeContext');

async function enriquecerUsuarioDoc(u) {
  const json = u.toJSON ? u.toJSON() : { ...u };
  json.rol = normalizarRol(json.rol);
  const datos = await datosRol(json.rol);
  json.permisos = datos.permisos;
  json.alarmas = datos.alarmas;
  json.permisosRev = datos.permisosRev || null;
  json.rolNombre = await nombreRol(json.rol);

  await asegurarSedePrincipal();
  const sedes = await sedesPermitidasUsuario(json._id, json.rol);
  json.sedes = sedes.map((s) => ({
    idSede: s.idSede,
    nombre: s.nombre,
    codigo: s.codigo || '',
    esPrincipal: !!s.esPrincipal,
  }));
  json.sedesPermitidas = json.sedes.map((s) => s.idSede);

  const emp = await empleadoPorUsuarioId(json._id);
  if (emp) {
    const esInstructor = await esEmpleadoInstructor(emp);
    json.idEmpleado = emp.idEmpleado;
    json.empleado = {
      idEmpleado: emp.idEmpleado,
      nombreCompleto: nombreEmpleado(emp),
      numeroDocumento: emp.numeroDocumento,
      idUsuario: emp.idUsuario ? String(emp.idUsuario) : json._id,
      esInstructor,
    };
    json.puedeUsarPortalInstructor =
      esInstructor &&
      (datos.permisos.includes('*') ||
        datos.permisos.some((p) =>
          ['instructores.mi_portal', 'jornadas.operar', 'programacion_cea.operar'].includes(p),
        ));
  } else {
    json.puedeUsarPortalInstructor = false;
  }
  return json;
}

async function enriquecerUsuarioPorId(userId) {
  const u = await Usuario.findById(userId);
  if (!u) return null;
  return enriquecerUsuarioDoc(u);
}

module.exports = { enriquecerUsuarioDoc, enriquecerUsuarioPorId };
