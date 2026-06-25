const Usuario = require('../models/Usuario');
const Empleado = require('../models/Empleado');
const Sede = require('../models/Sede');
const { esAdmin, normalizarRol } = require('../utils/roles');
const { normalizarEmpleadoLegacy } = require('../utils/empleadoDoc');
const { normalizarIdSede, asegurarSedePrincipal } = require('../services/sedeContext');

/** Cargo (nombre) → rol de login */
const CARGO_ROL = [
  { test: (n) => /\bcajer/i.test(n), rol: 'cajero' },
  { test: (n) => /\binstructor/i.test(n), rol: 'instructor' },
];

function slugAscii(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function rolDesdeCargoNombre(nombreCargo) {
  const n = slugAscii(nombreCargo);
  if (!n) return null;
  for (const { test, rol } of CARGO_ROL) {
    if (test(n)) return rol;
  }
  return null;
}

function nombresUsuario(emp) {
  const e = normalizarEmpleadoLegacy(emp);
  return [e.primerNombre, e.segundoNombre].filter(Boolean).join(' ').trim();
}

function apellidosUsuario(emp) {
  const e = normalizarEmpleadoLegacy(emp);
  return [e.primerApellido, e.segundoApellido].filter(Boolean).join(' ').trim();
}

function emailUsuario(emp) {
  const e = normalizarEmpleadoLegacy(emp);
  return (e.correoCorporativo || e.correoPersonal || '').trim().toLowerCase();
}

/** Login = número de documento (solo dígitos). @deprecated Preferir usernameDesdeEmpleado */
function usernameDesdeDocumento(emp) {
  const e = normalizarEmpleadoLegacy(emp);
  const doc = String(e.numeroDocumento || '').trim();
  const digits = doc.replace(/\D/g, '');
  if (digits) return digits.toLowerCase();
  const slug = slugAscii(doc);
  return slug || null;
}

function primerNombreSlug(emp) {
  const e = normalizarEmpleadoLegacy(emp);
  const raw = e.primerNombre || String(e.nombres || '').split(/\s+/)[0] || '';
  return slugAscii(raw) || null;
}

function primerApellidoSlug(emp) {
  const e = normalizarEmpleadoLegacy(emp);
  const raw = e.primerApellido || String(e.apellidos || '').split(/\s+/)[0] || '';
  return slugAscii(raw) || null;
}

/** Alias corto opcional (ej. jose, walter). */
function nickNameDesdeEmpleado(emp) {
  const prim = primerNombreSlug(emp);
  if (prim && prim.length >= 2) return prim;
  return null;
}

/** Usuario legible: nombre.apellido (único). El documento queda en numero/numeroDocumento. */
async function usernameDesdeEmpleado(emp, exceptUserId = null) {
  const e = normalizarEmpleadoLegacy(emp);
  const prim = primerNombreSlug(e);
  const apell = primerApellidoSlug(e);
  let base = prim && apell ? `${prim}.${apell}` : prim || apell;
  if (!base || base.length < 2) {
    const digits = String(e.numeroDocumento || '').replace(/\D/g, '');
    base = digits ? `u${digits.slice(-8)}` : `emp${e.idEmpleado || '0'}`;
  }
  const notSelf = exceptUserId ? { _id: { $ne: exceptUserId } } : {};
  let candidate = String(base).toLowerCase();
  for (let n = 0; n < 60; n += 1) {
    const dup = await Usuario.findOne({ username: candidate, ...notSelf }).lean();
    if (!dup) return candidate;
    candidate = `${base}${n + 1}`.toLowerCase();
  }
  const digits = String(e.numeroDocumento || '').replace(/\D/g, '');
  return `u${digits || e.idEmpleado || Date.now()}`.toLowerCase();
}

/**
 * Campo legacy `numero` en colección usuarios (índice único).
 * Debe coincidir con el documento del empleado.
 */
function numeroDesdeDocumento(emp) {
  const digits = String(normalizarEmpleadoLegacy(emp).numeroDocumento || '').replace(/\D/g, '');
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n)) return null;
  return n;
}

async function assertUsuarioDocumentoLibre(emp, exceptUserId) {
  const e = normalizarEmpleadoLegacy(emp);
  const username = await usernameDesdeEmpleado(e, exceptUserId);
  const numero = numeroDesdeDocumento(e);
  if (!username || numero == null) {
    throw Object.assign(
      new Error('numeroDocumento es obligatorio para crear el usuario del empleado'),
      { status: 400 },
    );
  }
  const notSelf = exceptUserId ? { _id: { $ne: exceptUserId } } : {};
  const porLogin = await Usuario.findOne({ username, ...notSelf }).lean();
  if (porLogin) {
    throw Object.assign(
      new Error(`Ya existe un usuario con login ${username} (${porLogin.nombres || ''} ${porLogin.apellidos || ''})`.trim()),
      { status: 409 },
    );
  }
  const porNumero = await Usuario.findOne({ numero, ...notSelf }).lean();
  if (porNumero) {
    throw Object.assign(
      new Error(`Ya existe un usuario con número de documento ${numero}`),
      { status: 409 },
    );
  }
  return { username, numero };
}

function passwordInicialDesdeEmpleado(emp) {
  const digits = String(emp.numeroDocumento || '').replace(/\D/g, '');
  if (digits.length >= 4) return digits.slice(-4);
  if (digits.length > 0) return digits;
  return 'argo1';
}

function limpiarUsuario(doc) {
  if (!doc) return null;
  const o = doc.toJSON ? doc.toJSON() : { ...doc };
  delete o.passwordHash;
  return o;
}

/** Sedes del usuario según la sede del empleado (fallback: sede principal). */
async function sedesPermitidasDesdeEmpleado(emp) {
  const e = normalizarEmpleadoLegacy(emp);
  const id = normalizarIdSede(e.idSede);
  if (id) {
    const s = await Sede.findOne({ idSede: id, activa: true }).select('idSede').lean();
    if (s) return [id];
  }
  const principal = await asegurarSedePrincipal();
  return principal?.idSede ? [principal.idSede] : [];
}

async function cargarUsuarioPorId(id) {
  if (!id) return null;
  return Usuario.findById(id);
}

/**
 * Crea usuario de sistema para empleado con cargo Cajero o Instructor.
 * Usuario de login = numeroDocumento; campo `numero` = documento numérico (legacy).
 */
async function desvincularUsuarioDeEmpleado(idEmpleado) {
  const emp = await Empleado.findOne({ idEmpleado }).lean();
  if (!emp?.idUsuario) return;
  await Usuario.updateOne({ _id: emp.idUsuario }, { $unset: { idEmpleado: '' } });
  await Empleado.updateOne(
    { idEmpleado },
    { $unset: { idUsuario: '' }, $set: { updatedAt: new Date() } },
  );
}

/** Al borrar empleado: quita idEmpleado del usuario aunque el registro RRHH ya no exista. */
async function desvincularUsuariosDeEmpleadoEliminado(idEmpleado) {
  if (idEmpleado == null || idEmpleado === '') return;
  const idNum = Number(idEmpleado);
  const emp = await Empleado.findOne({ idEmpleado: idNum }).lean();
  if (emp?.idUsuario) {
    await Usuario.updateOne({ _id: emp.idUsuario }, { $unset: { idEmpleado: '' } });
  }
  await Usuario.updateMany({ idEmpleado: idNum }, { $unset: { idEmpleado: '' } });
}

/** Si usuario.idEmpleado apunta a un empleado que ya no existe, limpia el campo. */
async function liberarVinculoUsuarioHuerfano(usuario) {
  if (usuario.idEmpleado == null || usuario.idEmpleado === '') return false;
  const idNum = Number(usuario.idEmpleado);
  if (!Number.isFinite(idNum)) {
    await Usuario.updateOne({ _id: usuario._id }, { $unset: { idEmpleado: '' } });
    usuario.idEmpleado = undefined;
    return true;
  }
  const emp = await Empleado.findOne({ idEmpleado: idNum }).lean();
  if (emp) return false;
  await Usuario.updateOne({ _id: usuario._id }, { $unset: { idEmpleado: '' } });
  usuario.idEmpleado = undefined;
  return true;
}

/**
 * Vincula un usuario ya existente al empleado (sin crear cuenta nueva).
 */
async function vincularUsuarioExistente(emp, usuarioId, { cargoNombre } = {}) {
  if (!usuarioId) {
    throw Object.assign(new Error('Debe seleccionar un usuario para vincular'), { status: 400 });
  }
  const e = normalizarEmpleadoLegacy(emp);
  const usuario = await Usuario.findById(usuarioId);
  if (!usuario) {
    throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });
  }
  await liberarVinculoUsuarioHuerfano(usuario);
  if (usuario.idEmpleado && Number(usuario.idEmpleado) !== Number(e.idEmpleado)) {
    throw Object.assign(
      new Error(`El usuario ${usuario.username} ya está vinculado al empleado #${usuario.idEmpleado}`),
      { status: 409 },
    );
  }
  const otroEmp = await Empleado.findOne({
    idUsuario: usuario._id,
    idEmpleado: { $ne: e.idEmpleado },
  }).lean();
  if (otroEmp) {
    throw Object.assign(
      new Error(`Ese usuario ya está vinculado al empleado #${otroEmp.idEmpleado}`),
      { status: 409 },
    );
  }
  const rolEsperado = rolDesdeCargoNombre(cargoNombre);
  await sincronizarDatosUsuario(usuario, e, rolEsperado || normalizarRol(usuario.rol), {
    conservarIdentidad: true,
  });
  return {
    existente: true,
    vinculado: true,
    usuario: limpiarUsuario(usuario),
    username: usuario.username,
    rol: normalizarRol(usuario.rol),
    idUsuario: usuario._id,
  };
}

/**
 * modoAcceso: 'auto' | 'ninguno' | 'vincular'
 * - auto: crea o sincroniza usuario según cargo (Cajero/Instructor)
 * - ninguno: empleado sin cuenta de login
 * - vincular: enlaza idUsuarioExistente
 */
async function procesarUsuarioEmpleado(
  emp,
  { cargoNombre, creadoPor, modoAcceso = 'auto', idUsuarioExistente } = {},
) {
  const modo = String(modoAcceso || 'auto').toLowerCase();
  if (modo === 'ninguno') {
    await desvincularUsuarioDeEmpleado(emp.idEmpleado);
    return null;
  }
  if (modo === 'vincular') {
    return vincularUsuarioExistente(emp, idUsuarioExistente, { cargoNombre });
  }
  return asegurarUsuarioParaEmpleado(emp, { cargoNombre, creadoPor });
}

async function asegurarUsuarioParaEmpleado(emp, { cargoNombre, creadoPor } = {}) {
  const e = normalizarEmpleadoLegacy(emp);
  const rol = rolDesdeCargoNombre(cargoNombre);
  if (!rol) return null;

  if (e.idUsuario) {
    const prev = await cargarUsuarioPorId(e.idUsuario);
    if (prev) {
      await sincronizarDatosUsuario(prev, e, rol);
      return {
        existente: true,
        usuario: limpiarUsuario(prev),
        username: prev.username,
        rol: normalizarRol(prev.rol),
        idUsuario: prev._id,
      };
    }
  }

  const porEmpleado = await Usuario.findOne({ idEmpleado: e.idEmpleado });
  if (porEmpleado) {
    await sincronizarDatosUsuario(porEmpleado, e, rol);
    return {
      existente: true,
      usuario: limpiarUsuario(porEmpleado),
      username: porEmpleado.username,
      rol: normalizarRol(porEmpleado.rol),
      idUsuario: porEmpleado._id,
    };
  }

  const email = emailUsuario(e);
  if (email) {
    const porEmail = await Usuario.findOne({ email }).lean();
    if (porEmail) {
      throw Object.assign(
        new Error(`Ya existe un usuario con el correo ${email} (${porEmail.username})`),
        { status: 409 },
      );
    }
  }

  const { username, numero } = await assertUsuarioDocumentoLibre(e);
  const passwordInicial = passwordInicialDesdeEmpleado(e);
  const sedesPermitidas = await sedesPermitidasDesdeEmpleado(e);

  const doc = await Usuario.create({
    username,
    numero,
    nombres: nombresUsuario(e),
    apellidos: apellidosUsuario(e),
    email: email || undefined,
    rol: normalizarRol(rol),
    activo: String(e.estado || 'activo').toLowerCase() !== 'retirado',
    passwordHash: await Usuario.hashPassword(passwordInicial),
    idEmpleado: e.idEmpleado,
    numeroDocumento: String(e.numeroDocumento || '').trim(),
    creadoDesdeEmpleado: true,
    sedesPermitidas,
    userAddReg: creadoPor || 'sistema',
  });

  return {
    existente: false,
    usuario: limpiarUsuario(doc),
    username: doc.username,
    passwordInicial,
    rol: normalizarRol(rol),
    idUsuario: doc._id,
  };
}

async function sincronizarDatosUsuario(usuarioDoc, emp, rolEsperado, opts = {}) {
  const u = usuarioDoc;
  const e = normalizarEmpleadoLegacy(emp);
  const conservarIdentidad = opts.conservarIdentidad === true;
  const email = emailUsuario(e);

  if (conservarIdentidad) {
    if (!String(u.nombres || '').trim() && nombresUsuario(e)) u.nombres = nombresUsuario(e);
    if (!String(u.apellidos || '').trim() && apellidosUsuario(e)) u.apellidos = apellidosUsuario(e);
    if (email && !String(u.email || '').trim()) u.email = email;
    u.idEmpleado = e.idEmpleado;
    if (String(e.estado || '').toLowerCase() === 'retirado') u.activo = false;
    if (!esAdmin(normalizarRol(u.rol))) {
      u.sedesPermitidas = await sedesPermitidasDesdeEmpleado(e);
    }
    await guardarUsuario(u);
    return;
  }

  u.nombres = nombresUsuario(e);
  u.apellidos = apellidosUsuario(e);
  if (email) u.email = email;
  if (rolEsperado) u.rol = normalizarRol(rolEsperado);
  u.idEmpleado = e.idEmpleado;
  u.numeroDocumento = String(e.numeroDocumento || '').trim();

  const loginActual = String(u.username || '').trim();
  const loginEsDocumento = /^\d+$/.test(loginActual);

  const numero = numeroDesdeDocumento(e);
  if (numero != null) {
    const dupNum = await Usuario.findOne({ numero, _id: { $ne: u._id } }).lean();
    if (!dupNum) u.numero = numero;
  }

  if (loginEsDocumento || !loginActual) {
    try {
      const friendly = await usernameDesdeEmpleado(e, u._id);
      const dupLogin = await Usuario.findOne({ username: friendly, _id: { $ne: u._id } }).lean();
      if (!dupLogin) u.username = friendly;
    } catch {
      /* conservar login actual */
    }
  }

  if (String(e.estado || '').toLowerCase() === 'retirado') u.activo = false;

  if (!esAdmin(normalizarRol(u.rol))) {
    u.sedesPermitidas = await sedesPermitidasDesdeEmpleado(e);
  }

  await guardarUsuario(u);
}

async function guardarUsuario(u) {
  try {
    await u.save();
  } catch (err) {
    if (err?.code === 11000) {
      const msg = String(err.message || '');
      const campo = /username/i.test(msg) ? 'login (usuario)' : 'documento (campo numero)';
      throw Object.assign(
        new Error(
          `No se pudo guardar la cuenta: ya existe otro usuario con ese ${campo}. ` +
            'Al vincular, use el mismo número de documento del usuario en la ficha del empleado, ' +
            'o cree el empleado con el documento que ya tiene la cuenta.',
        ),
        { status: 409 },
      );
    }
    throw err;
  }
}

/** Repara usuarios legacy con numero null (evita E11000 en índice único). */
async function repararUsuariosNumeroNulo() {
  const rows = await Usuario.find({
    $or: [{ numero: null }, { numero: { $exists: false } }],
  }).limit(200);
  let fixed = 0;
  for (const u of rows) {
    const digits = String(u.numeroDocumento || u.username || '').replace(/\D/g, '');
    if (!digits) continue;
    const numero = Number(digits);
    if (!Number.isFinite(numero)) continue;
    const dup = await Usuario.findOne({ numero, _id: { $ne: u._id } }).lean();
    if (dup) continue;
    const username = (u.username || digits).toLowerCase();
    await Usuario.updateOne(
      { _id: u._id },
      { $set: { numero, username, numeroDocumento: u.numeroDocumento || digits } },
    );
    fixed += 1;
  }
  if (fixed > 0) console.log(`[ARGO] Usuarios reparados (campo numero): ${fixed}`);
}

module.exports = {
  rolDesdeCargoNombre,
  usernameDesdeDocumento,
  usernameDesdeEmpleado,
  nickNameDesdeEmpleado,
  numeroDesdeDocumento,
  asegurarUsuarioParaEmpleado,
  procesarUsuarioEmpleado,
  vincularUsuarioExistente,
  desvincularUsuarioDeEmpleado,
  desvincularUsuariosDeEmpleadoEliminado,
  liberarVinculoUsuarioHuerfano,
  repararUsuariosNumeroNulo,
};
