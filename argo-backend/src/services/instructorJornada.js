const Empleado = require('../models/Empleado');
const { buscarPrograma } = require('./programaServicio');
const Usuario = require('../models/Usuario');
const Cargo = require('../models/Cargo');
const { tieneAlguno, permisosParaRol } = require('./rolesPermisos');

function nombreEmpleado(emp) {
  if (!emp) return '';
  return [emp.primerNombre, emp.segundoNombre, emp.primerApellido, emp.segundoApellido]
    .filter(Boolean)
    .join(' ')
    .trim();
}

async function cargoNombre(cargoId) {
  if (!cargoId) return '';
  const c = await Cargo.findOne({ idCargo: cargoId }).lean();
  return String(c?.nombre || '').trim();
}

async function esEmpleadoInstructor(emp) {
  if (!emp) return false;
  const nom = await cargoNombre(emp.cargoId);
  return /\binstructor/i.test(nom);
}

async function empleadoPorUsuarioId(userId) {
  if (!userId) return null;
  const u = await Usuario.findById(userId).lean();
  if (u?.idEmpleado) {
    const emp = await Empleado.findOne({ idEmpleado: u.idEmpleado }).lean();
    if (emp) return emp;
  }
  return Empleado.findOne({ idUsuario: userId }).lean();
}

async function resolverInstructorParaClase(req, body = {}) {
  const permisos = req.permisos || (await permisosParaRol(req.user?.rol));
  const puedeAsignar = tieneAlguno(permisos, ['jornadas.gestionar']);

  let idEmpleadoRaw = body.idEmpleadoInstructor ?? body.idEmpleado;
  if (idEmpleadoRaw != null && idEmpleadoRaw !== '' && puedeAsignar) {
    const idEmpleado = Number(idEmpleadoRaw);
    if (!Number.isFinite(idEmpleado)) {
      const err = new Error('idEmpleadoInstructor inválido');
      err.status = 400;
      throw err;
    }
    const emp = await Empleado.findOne({ idEmpleado }).lean();
    if (!emp) {
      const err = new Error('Empleado instructor no encontrado');
      err.status = 404;
      throw err;
    }
    if (!emp.idUsuario) {
      const err = new Error('El empleado seleccionado no tiene usuario de login vinculado');
      err.status = 400;
      throw err;
    }
    return {
      idEmpleadoInstructor: emp.idEmpleado,
      idUsuarioInstructor: String(emp.idUsuario),
      idinstructor: nombreEmpleado(emp),
      instructorNombre: nombreEmpleado(emp),
    };
  }

  const emp = await empleadoPorUsuarioId(req.user?.sub);
  if (!emp) {
    const err = new Error(
      'Su usuario debe estar vinculado a un empleado en RRHH para crear u operar clases.',
    );
    err.status = 400;
    throw err;
  }
  if (!emp.idUsuario) {
    const err = new Error('El empleado vinculado no tiene usuario de login. Solicite acceso en RRHH.');
    err.status = 400;
    throw err;
  }
  const instructor = await esEmpleadoInstructor(emp);
  if (!instructor && !puedeAsignar) {
    const err = new Error('Su cargo en RRHH no es de instructor. Solo instructores pueden crear clases.');
    err.status = 403;
    throw err;
  }

  return {
    idEmpleadoInstructor: emp.idEmpleado,
    idUsuarioInstructor: String(emp.idUsuario || req.user.sub),
    idinstructor: nombreEmpleado(emp),
    instructorNombre: nombreEmpleado(emp),
  };
}

async function listarInstructoresConUsuario() {
  const empleados = await Empleado.find({
    idUsuario: { $exists: true, $ne: null },
    estado: { $not: /^inactivo$/i },
  }).lean();

  const out = [];
  for (const e of empleados) {
    const cargo = await cargoNombre(e.cargoId);
    if (!/\binstructor/i.test(cargo)) continue;
    out.push({
      idEmpleado: e.idEmpleado,
      idUsuario: String(e.idUsuario),
      nombreCompleto: nombreEmpleado(e),
      numeroDocumento: e.numeroDocumento,
      cargo,
    });
  }
  return out.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'));
}

/** Admin/gestor: sin filtro. Instructor: solo clases asignadas a su empleado o usuario. */
async function filtroClasesQueryPorRol(req) {
  const permisos = req.permisos || (await permisosParaRol(req.user?.rol));
  if (tieneAlguno(permisos, ['jornadas.gestionar'])) {
    return { aplicar: false };
  }
  const emp = await empleadoPorUsuarioId(req.user?.sub);
  const condiciones = [];
  if (emp?.idEmpleado != null) condiciones.push({ idEmpleadoInstructor: emp.idEmpleado });
  const userId = req.user?.sub ? String(req.user.sub) : '';
  if (userId) condiciones.push({ idUsuarioInstructor: userId });
  if (!condiciones.length) return { aplicar: true, vacio: true };
  return { aplicar: true, $or: condiciones };
}

async function aplicarFiltroClasesQueryPorRol(q, req) {
  const filtro = await filtroClasesQueryPorRol(req);
  if (!filtro.aplicar) return { q, vacio: false };
  if (filtro.vacio) return { q, vacio: true };
  q.$or = filtro.$or;
  return { q, vacio: false };
}

/** Clases asignadas al instructor (empleado + usuario + nombre legacy en jornadas). */
function filtroInstructorQuery(emp, userId) {
  const or = [];
  if (emp?.idEmpleado != null) {
    const idNum = Number(emp.idEmpleado);
    or.push({ idEmpleadoInstructor: idNum });
    or.push({ idEmpleadoInstructor: String(idNum) });
  }
  const uid = userId ? String(userId).trim() : '';
  if (uid) or.push({ idUsuarioInstructor: uid });
  if (emp?.idUsuario) {
    const uEmp = String(emp.idUsuario).trim();
    if (uEmp && !or.some((c) => c.idUsuarioInstructor === uEmp)) {
      or.push({ idUsuarioInstructor: uEmp });
    }
  }
  const nom = nombreEmpleado(emp);
  if (nom) {
    const esc = nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    or.push({ idinstructor: new RegExp(`^${esc}$`, 'i') });
  }
  return or.length ? { $or: or } : { _id: null };
}

async function enriquecerClases(rows) {
  const ids = [...new Set(rows.map((r) => r.idEmpleadoInstructor).filter((x) => x != null))];
  const empleados = ids.length
    ? await Empleado.find({ idEmpleado: { $in: ids } }).lean()
    : [];
  const map = new Map(empleados.map((e) => [e.idEmpleado, e]));
  const progCache = new Map();

  const out = [];
  for (const c of rows) {
    const emp = c.idEmpleadoInstructor != null ? map.get(c.idEmpleadoInstructor) : null;
    const instructorNombre = emp ? nombreEmpleado(emp) : c.idinstructor || '';
    const progId = String(c.idPrograma || '');
    let programaNombre = progCache.get(progId);
    if (programaNombre === undefined) {
      const prog = progId ? await buscarPrograma(progId) : null;
      programaNombre =
        (prog?.nombreProg || prog?.descripcion || prog?.nomCert || progId || '').trim() || progId;
      progCache.set(progId, programaNombre);
    }
    out.push({
      ...c,
      instructorNombre,
      programaNombre,
      idEmpleadoInstructor: c.idEmpleadoInstructor ?? null,
      idUsuarioInstructor: c.idUsuarioInstructor || '',
    });
  }
  return out;
}

module.exports = {
  nombreEmpleado,
  empleadoPorUsuarioId,
  resolverInstructorParaClase,
  listarInstructoresConUsuario,
  aplicarFiltroClasesQueryPorRol,
  filtroInstructorQuery,
  enriquecerClases,
  esEmpleadoInstructor,
};
