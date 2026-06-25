const RolApp = require('../models/RolApp');
const { todasLasClaves, clavesValidas } = require('../constants/permisosCatalogo');
const {
  clavesValidas: clavesAlarmasValidas,
  alarmasDefaultRol,
} = require('../constants/alarmasCatalogo');
const { normalizarRol, esAdmin } = require('../utils/roles');

const ROLES_SISTEMA = {
  admin: {
    nombre: 'Administrador',
    descripcion: 'Acceso total al sistema',
    permisos: ['*'],
    alarmas: ['*'],
    esSistema: true,
  },
  cajero: {
    nombre: 'Cajero',
    descripcion: 'Gestión de alumnos, pagos y caja del turno',
    permisos: [
      'dashboard',
      'alumnos.ver',
      'alumnos.gestionar',
      'alumnos.pagos',
      'alumnos.certificados',
      'certificados.vencidos',
      'combos.gestionar',
      'programas.ver',
      'servicios.ver',
      'caja.turno',
      'caja.cobros',
    ],
    alarmas: alarmasDefaultRol('cajero'),
    esSistema: true,
  },
  instructor: {
    nombre: 'Instructor',
    descripcion: 'Dashboard, jornadas en carpa, consulta y alta de programas',
    permisos: [
      'dashboard',
      'programas.ver',
      'programas.agregar',
      'jornadas.ver',
      'jornadas.operar',
      'programacion_cea.ver',
      'programacion_cea.operar',
      'cohortes_academicas.ver',
      'cohortes_academicas.operar',
      'instructores.mi_portal',
      'instructores.inspeccion',
      'aula_virtual.foro',
    ],
    alarmas: alarmasDefaultRol('instructor'),
    esSistema: true,
  },
  recepcion: {
    nombre: 'Recepción',
    descripcion: 'Atención, alumnos y catálogo académico',
    permisos: [
      'dashboard',
      'alumnos.ver',
      'alumnos.gestionar',
      'programas.ver',
      'programas.gestionar',
      'servicios.ver',
      'programacion_cea.ver',
      'programacion_cea.gestionar',
      'cohortes_academicas.ver',
      'cohortes_academicas.gestionar',
      'aula_virtual.gestionar',
      'aula_virtual.sitio',
      'aula_virtual.foro',
    ],
    alarmas: alarmasDefaultRol('recepcion'),
    esSistema: true,
  },
  usuario: {
    nombre: 'Usuario',
    descripcion: 'Consulta básica',
    permisos: ['dashboard', 'programas.ver', 'servicios.ver'],
    alarmas: alarmasDefaultRol('usuario'),
    esSistema: true,
  },
};

/** Caché en memoria { codigo → { permisos, alarmas, nombre, ts } } */
const cache = new Map();
const CACHE_MS = 5_000;

function limpiarCache(codigo) {
  if (codigo) cache.delete(normalizarRol(codigo));
  else cache.clear();
}

function tienePermiso(permisos, clave) {
  if (!permisos?.length) return false;
  if (permisos.includes('*') || esAdminPorPermisos(permisos)) return true;
  return permisos.includes(clave);
}

function tieneAlarma(alarmas, clave) {
  if (!alarmas?.length) return false;
  if (alarmas.includes('*')) return true;
  if (alarmas.includes(clave)) return true;
  const base = String(clave).split('.')[0];
  return alarmas.includes(base);
}

function esAdminPorPermisos(permisos) {
  return permisos.includes('*');
}

function tieneAlguno(permisos, claves) {
  const list = Array.isArray(claves) ? claves : [claves];
  return list.some((k) => tienePermiso(permisos, k));
}

function tieneAlgunaAlarma(alarmas, claves) {
  const list = Array.isArray(claves) ? claves : [claves];
  return list.some((k) => tieneAlarma(alarmas, k));
}

/** Incorpora permisos nuevos del catálogo al rol admin si quedó con lista explícita (sin *). */
async function fusionarPermisosAdminCatalogo() {
  const doc = await RolApp.findOne({ codigo: 'admin', esSistema: true }).lean();
  if (!doc?.permisos?.length || doc.permisos.includes('*')) return;
  const esperadas = todasLasClaves();
  const actuales = [...doc.permisos];
  const faltantes = esperadas.filter((k) => !actuales.includes(k));
  if (!faltantes.length) return;
  await RolApp.updateOne({ codigo: 'admin' }, { $set: { permisos: [...actuales, ...faltantes] } });
}

/** Incorpora alarmas nuevas del catálogo a roles del sistema ya guardados en BD. */
async function fusionarAlarmasSistema(codigo, defAlarmas) {
  if (!defAlarmas?.length || defAlarmas.includes('*')) return;
  const doc = await RolApp.findOne({ codigo, esSistema: true }).lean();
  if (!doc?.codigo) return;
  const actuales = doc.alarmas?.includes('*') ? ['*'] : [...(doc.alarmas || [])];
  if (actuales.includes('*')) return;

  const esperadas = clavesAlarmasValidas(defAlarmas);
  const faltantes = esperadas.filter((k) => !actuales.includes(k));
  if (!faltantes.length) return;

  await RolApp.updateOne({ codigo }, { $set: { alarmas: [...actuales, ...faltantes] } });
}

async function initRolesSistema(opts = {}) {
  const force = opts.force === true;
  const codigoForzado = opts.codigo ? normalizarRol(opts.codigo) : null;
  for (const [codigo, def] of Object.entries(ROLES_SISTEMA)) {
    if (codigoForzado && codigo !== codigoForzado) continue;
    const permisos = def.permisos.includes('*') ? ['*'] : clavesValidas(def.permisos);
    const alarmas = def.alarmas?.includes('*') ? ['*'] : clavesAlarmasValidas(def.alarmas || []);
    const payload = {
      codigo,
      nombre: def.nombre,
      descripcion: def.descripcion || '',
      permisos,
      alarmas,
      esSistema: true,
      activo: true,
    };

    if (force) {
      await RolApp.findOneAndUpdate({ codigo }, { $set: payload }, { upsert: true, new: true });
      continue;
    }

    await RolApp.findOneAndUpdate(
      { codigo },
      { $setOnInsert: payload },
      { upsert: true },
    );
    await fusionarAlarmasSistema(codigo, def.alarmas || []);
  }
  await fusionarPermisosAdminCatalogo();
  limpiarCache();
}

async function listarRolesActivos() {
  return RolApp.find({ activo: { $ne: false } }).sort({ esSistema: -1, nombre: 1 }).lean();
}

async function datosRol(rolRaw) {
  const codigo = normalizarRol(rolRaw);
  const hit = cache.get(codigo);
  if (hit && Date.now() - hit.ts < CACHE_MS) return hit;

  const doc = await RolApp.findOne({ codigo, activo: { $ne: false } }).lean();
  let permisos;
  let alarmas;

  if (doc && Array.isArray(doc.permisos)) {
    permisos = doc.permisos.includes('*') ? ['*'] : [...doc.permisos];
  } else if (codigo === 'admin' || esAdmin(codigo)) {
    permisos = ['*'];
  } else if (ROLES_SISTEMA[codigo]?.permisos?.length) {
    permisos = [...ROLES_SISTEMA[codigo].permisos];
  } else {
    permisos = [];
  }

  /** Red de seguridad: rol con permisos pero sin dashboard bloqueaba el login. */
  if (permisos.length > 0 && !permisos.includes('*') && !permisos.includes('dashboard')) {
    permisos = [...permisos, 'dashboard'];
  }

  if (Array.isArray(doc?.alarmas)) {
    alarmas = doc.alarmas.includes('*') ? ['*'] : [...doc.alarmas];
  } else if (codigo === 'admin' || esAdmin(codigo)) {
    alarmas = ['*'];
  } else if (ROLES_SISTEMA[codigo]?.alarmas?.length) {
    alarmas = [...ROLES_SISTEMA[codigo].alarmas];
  } else {
    alarmas = alarmasDefaultRol(codigo);
  }

  const data = {
    permisos,
    alarmas,
    nombre: doc?.nombre || ROLES_SISTEMA[codigo]?.nombre,
    permisosRev: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    ts: Date.now(),
  };
  cache.set(codigo, data);
  return data;
}

async function permisosParaRol(rolRaw) {
  return (await datosRol(rolRaw)).permisos;
}

async function alarmasParaRol(rolRaw) {
  return (await datosRol(rolRaw)).alarmas;
}

async function nombreRol(rolRaw) {
  const codigo = normalizarRol(rolRaw);
  const hit = cache.get(codigo);
  if (hit?.nombre) return hit.nombre;
  const doc = await RolApp.findOne({ codigo }).lean();
  return doc?.nombre || ROLES_SISTEMA[codigo]?.nombre || codigo;
}

async function rolExiste(codigo) {
  const c = normalizarRol(codigo);
  const n = await RolApp.countDocuments({ codigo: c, activo: { $ne: false } });
  return n > 0 || !!ROLES_SISTEMA[c];
}

async function puedeGestionarProgramasPorPermisos(rolRaw) {
  const p = await permisosParaRol(rolRaw);
  return tieneAlguno(p, ['programas.gestionar', 'programas.ver', '*']);
}

async function puedeGestionarServiciosPorPermisos(rolRaw) {
  const p = await permisosParaRol(rolRaw);
  return tieneAlguno(p, ['servicios.gestionar', 'servicios.ver', '*']);
}

function sanitizarPermisosDetallado(list) {
  if (!Array.isArray(list)) return { permisos: [], removidos: [] };
  if (list.includes('*')) return { permisos: ['*'], removidos: [] };
  const valid = new Set(todasLasClaves());
  const permisos = [];
  const removidos = [];
  for (const raw of list) {
    const k = String(raw || '').trim();
    if (!k || k === '*') continue;
    if (valid.has(k)) permisos.push(k);
    else removidos.push(k);
  }
  return { permisos, removidos };
}

function sanitizarPermisos(list) {
  return sanitizarPermisosDetallado(list).permisos;
}

/** Normaliza permisos al guardar: whitelist + dashboard mínimo si hay otros permisos. */
function prepararPermisosGuardado(list) {
  const { permisos: base, removidos } = sanitizarPermisosDetallado(list);
  const agregados = [];
  let permisos = base;
  if (!permisos.includes('*') && !permisos.includes('dashboard') && permisos.length > 0) {
    permisos = [...permisos, 'dashboard'];
    agregados.push('dashboard');
  }
  return { permisos, removidos, agregados };
}

function sanitizarAlarmas(list) {
  if (!Array.isArray(list)) return [];
  if (list.includes('*')) return ['*'];
  return clavesAlarmasValidas(list);
}

function codigoRolValido(codigo) {
  const c = String(codigo || '').trim().toLowerCase();
  return /^[a-z][a-z0-9_-]{1,39}$/.test(c);
}

module.exports = {
  ROLES_SISTEMA,
  initRolesSistema,
  listarRolesActivos,
  datosRol,
  permisosParaRol,
  alarmasParaRol,
  nombreRol,
  rolExiste,
  tienePermiso,
  tieneAlarma,
  tieneAlguno,
  tieneAlgunaAlarma,
  limpiarCache,
  sanitizarPermisos,
  sanitizarPermisosDetallado,
  prepararPermisosGuardado,
  sanitizarAlarmas,
  codigoRolValido,
  puedeGestionarProgramasPorPermisos,
  puedeGestionarServiciosPorPermisos,
  todasLasClaves,
};
