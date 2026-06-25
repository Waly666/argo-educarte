const Sede = require('../models/Sede');
const Usuario = require('../models/Usuario');
const { esAdmin } = require('../utils/roles');
const { tieneAlguno } = require('./rolesPermisos');

const ID_SEDE_PRINCIPAL = 'PRINCIPAL';
const HEADER_SEDE = 'x-argo-sede';

function normalizarIdSede(raw) {
  const t = String(raw || '').trim();
  return t || null;
}

async function obtenerSedePrincipal() {
  let s = await Sede.findOne({ esPrincipal: true, activa: true }).lean();
  if (!s) s = await Sede.findOne({ idSede: ID_SEDE_PRINCIPAL }).lean();
  return s;
}

async function asegurarSedePrincipal() {
  let s = await Sede.findOne({ idSede: ID_SEDE_PRINCIPAL }).lean();
  if (s) {
    if (!s.esPrincipal || !s.activa) {
      await Sede.updateOne(
        { _id: s._id },
        { $set: { esPrincipal: true, activa: true, nombre: s.nombre || 'Principal' } },
      );
    }
    return Sede.findOne({ idSede: ID_SEDE_PRINCIPAL }).lean();
  }
  await Sede.updateMany({ esPrincipal: true }, { $set: { esPrincipal: false } });
  const creada = await Sede.create({
    idSede: ID_SEDE_PRINCIPAL,
    nombre: 'Principal',
    codigo: 'PRIN',
    activa: true,
    esPrincipal: true,
    userAddReg: 'sistema',
  });
  return creada.toObject();
}

async function listarSedesActivas() {
  return Sede.find({ activa: true }).sort({ esPrincipal: -1, nombre: 1 }).lean();
}

async function sedesPermitidasUsuario(userId, rol) {
  if (!userId) return [];
  if (esAdmin(rol)) {
    return listarSedesActivas();
  }
  const permisos = await require('./rolesPermisos').permisosParaRol(rol);
  if (tieneAlguno(permisos, ['sedes.ver_todas'])) {
    return listarSedesActivas();
  }
  const u = await Usuario.findById(userId).lean();
  const ids = Array.isArray(u?.sedesPermitidas)
    ? u.sedesPermitidas.map(normalizarIdSede).filter(Boolean)
    : [];
  if (!ids.length) {
    const principal = await asegurarSedePrincipal();
    return principal ? [principal] : [];
  }
  return Sede.find({ idSede: { $in: ids }, activa: true }).sort({ nombre: 1 }).lean();
}

async function usuarioPuedeSede(userId, rol, idSede) {
  const sid = normalizarIdSede(idSede);
  if (!sid) return false;
  const sedes = await sedesPermitidasUsuario(userId, rol);
  return sedes.some((s) => s.idSede === sid);
}

async function resolverSedeActiva(req) {
  const header = req.headers[HEADER_SEDE] || req.headers['X-ARGO-Sede'] || req.query?.idSede;
  const idSede = normalizarIdSede(header);
  if (!idSede) return null;
  const sede = await Sede.findOne({ idSede, activa: true }).lean();
  if (!sede) {
    const err = new Error(`Sede «${idSede}» no encontrada o inactiva`);
    err.status = 400;
    err.code = 'SEDE_INVALIDA';
    throw err;
  }
  if (req.user?.sub) {
    const ok = await usuarioPuedeSede(req.user.sub, req.user.rol, idSede);
    if (!ok) {
      const err = new Error('No tiene permiso para operar en esta sede');
      err.status = 403;
      err.code = 'SEDE_NO_PERMITIDA';
      throw err;
    }
  }
  return sede;
}

function filtroSedeQuery(idSede, campo = 'idSede') {
  const sid = normalizarIdSede(idSede);
  return sid ? { [campo]: sid } : {};
}

module.exports = {
  ID_SEDE_PRINCIPAL,
  HEADER_SEDE,
  normalizarIdSede,
  asegurarSedePrincipal,
  obtenerSedePrincipal,
  listarSedesActivas,
  sedesPermitidasUsuario,
  usuarioPuedeSede,
  resolverSedeActiva,
  filtroSedeQuery,
};
