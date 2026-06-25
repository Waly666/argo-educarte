const RolApp = require('../models/RolApp');
const Usuario = require('../models/Usuario');
const { GRUPOS } = require('../constants/permisosCatalogo');
const { GRUPOS: ALARMAS_GRUPOS } = require('../constants/alarmasCatalogo');
const {
  sanitizarAlarmas,
  prepararPermisosGuardado,
  codigoRolValido,
  limpiarCache,
  initRolesSistema,
  ROLES_SISTEMA,
} = require('../services/rolesPermisos');
const { normalizarRol } = require('../utils/roles');

function limpiar(doc) {
  if (!doc) return null;
  return doc.toJSON ? doc.toJSON() : { ...doc };
}

function codigoDeUrl(req) {
  return String(req.params.codigo || '').trim().toLowerCase();
}

function validarCodigoNuevo(c) {
  if (!codigoRolValido(c)) {
    return 'Código inválido. Use 2–40 caracteres: letras minúsculas, números, guión o guión bajo.';
  }
  if (ROLES_SISTEMA[c]) {
    return `El código «${c}» está reservado para un rol del sistema.`;
  }
  const norm = normalizarRol(c);
  if (norm !== c && ROLES_SISTEMA[norm]) {
    return `El código «${c}» se confunde con el rol del sistema «${norm}». Elija otro código.`;
  }
  return null;
}

function respuestaRol(doc, meta = {}) {
  return { ...limpiar(doc), meta };
}

exports.catalogo = (_req, res) => {
  res.json({ grupos: GRUPOS, alarmasGrupos: ALARMAS_GRUPOS });
};

exports.listar = async (_req, res, next) => {
  try {
    const rows = await RolApp.find().sort({ esSistema: -1, nombre: 1 });
    res.json(rows.map(limpiar));
  } catch (e) {
    next(e);
  }
};

exports.obtener = async (req, res, next) => {
  try {
    const codigo = codigoDeUrl(req);
    const doc = await RolApp.findOne({ codigo });
    if (!doc) return res.status(404).json({ message: 'Rol no encontrado' });
    res.json(limpiar(doc));
  } catch (e) {
    next(e);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const { codigo, nombre, descripcion, permisos, alarmas, activo } = req.body || {};
    const c = String(codigo || '').trim().toLowerCase();
    const errCodigo = validarCodigoNuevo(c);
    if (errCodigo) return res.status(400).json({ message: errCodigo });
    if (!String(nombre || '').trim()) {
      return res.status(400).json({ message: 'Nombre del rol es obligatorio' });
    }
    const dup = await RolApp.findOne({ codigo: c });
    if (dup) return res.status(409).json({ message: 'Ya existe un rol con ese código' });

    const prep = prepararPermisosGuardado(permisos);
    const doc = await RolApp.create({
      codigo: c,
      nombre: String(nombre).trim(),
      descripcion: String(descripcion || '').trim(),
      permisos: prep.permisos,
      alarmas: sanitizarAlarmas(alarmas),
      esSistema: false,
      activo: activo !== false,
    });
    limpiarCache();
    res.status(201).json(
      respuestaRol(doc, {
        permisosRemovidos: prep.removidos,
        permisosAgregados: prep.agregados,
      }),
    );
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const codigo = codigoDeUrl(req);
    const doc = await RolApp.findOne({ codigo });
    if (!doc) return res.status(404).json({ message: 'Rol no encontrado' });

    const { nombre, descripcion, permisos, alarmas, activo } = req.body || {};
    let meta = {};

    if (doc.esSistema && doc.codigo === 'admin' && permisos != null) {
      const p = Array.isArray(permisos) ? permisos : [];
      if (!p.includes('*')) {
        return res.status(400).json({
          message: 'El rol Administrador debe conservar acceso total (*).',
        });
      }
    }

    if (nombre != null) doc.nombre = String(nombre).trim();
    if (descripcion != null) doc.descripcion = String(descripcion).trim();
    if (permisos != null) {
      const prep = prepararPermisosGuardado(permisos);
      doc.permisos = prep.permisos;
      meta = {
        permisosRemovidos: prep.removidos,
        permisosAgregados: prep.agregados,
      };
    }
    if (alarmas != null) doc.alarmas = sanitizarAlarmas(alarmas);
    if (activo != null) doc.activo = activo === true || activo === 'true';

    await doc.save();
    limpiarCache();
    res.json(
      respuestaRol(doc, {
        ...meta,
        permisosEfectivos: doc.permisos,
        permisosRev: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
      }),
    );
  } catch (e) {
    next(e);
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    const codigo = codigoDeUrl(req);
    const doc = await RolApp.findOne({ codigo });
    if (!doc) return res.status(404).json({ message: 'Rol no encontrado' });
    if (doc.esSistema) {
      return res.status(400).json({ message: 'No se puede eliminar un rol del sistema' });
    }

    const enUso = await Usuario.countDocuments({ rol: doc.codigo, activo: { $ne: false } });
    if (enUso > 0) {
      return res.status(400).json({
        message: `Hay ${enUso} usuario(s) activo(s) con este rol. Reasígnelos antes de eliminar.`,
      });
    }

    await RolApp.findByIdAndDelete(doc._id);
    limpiarCache(doc.codigo);
    res.json({ ok: true, message: `Rol «${doc.nombre}» eliminado` });
  } catch (e) {
    next(e);
  }
};

exports.reiniciarSistema = async (req, res, next) => {
  try {
    const codigo = req.body?.codigo || req.query?.codigo;
    await initRolesSistema({ force: true, ...(codigo ? { codigo: String(codigo) } : {}) });
    limpiarCache();
    res.json({
      ok: true,
      message: codigo
        ? `Rol «${String(codigo).trim().toLowerCase()}» restaurado a valores del sistema`
        : 'Roles del sistema restaurados',
    });
  } catch (e) {
    next(e);
  }
};
