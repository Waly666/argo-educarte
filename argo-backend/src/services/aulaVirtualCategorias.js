const CapacitacionVirtualConfig = require('../models/CapacitacionVirtualConfig');
const { models } = require('../models/catalogos');
const { maxNumericId } = require('./programaServicio');

const CategoriaModel = () => models.categoriasVirtual;

/** IDs de categorías del curso (soporta legado idCategoria único). */
function idsCategoriasConfig(cfg) {
  if (!cfg) return [];
  if (Array.isArray(cfg.idCategorias) && cfg.idCategorias.length) {
    return [...new Set(cfg.idCategorias.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
  }
  if (cfg.idCategoria != null && cfg.idCategoria !== '') {
    const n = Number(cfg.idCategoria);
    return Number.isFinite(n) && n > 0 ? [n] : [];
  }
  return [];
}

function resolverCategoriasCurso(cfg, categoriasMap) {
  const ids = idsCategoriasConfig(cfg);
  const categoriaNombres = ids
    .map((id) => categoriasMap?.get(id)?.nombre)
    .filter(Boolean);
  return {
    idCategorias: ids,
    categoriaNombres,
    categoriaNombre: categoriaNombres[0] || null,
  };
}

async function listarCategorias({ soloActivas = false } = {}) {
  const filter = soloActivas ? { activo: { $ne: false } } : {};
  const rows = await CategoriaModel().find(filter).sort({ orden: 1, nombre: 1 }).lean();
  return rows;
}

async function crearCategoria(body, usuario) {
  const nombre = String(body?.nombre || '').trim();
  if (!nombre) {
    const err = new Error('El nombre de la categoría es obligatorio');
    err.status = 400;
    throw err;
  }
  const dup = await CategoriaModel().findOne({ nombre: new RegExp(`^${nombre}$`, 'i') }).lean();
  if (dup) {
    const err = new Error('Ya existe una categoría con ese nombre');
    err.status = 409;
    throw err;
  }
  const idCategoria = await maxNumericId(CategoriaModel(), 'idCategoria');
  const res = await CategoriaModel().collection.insertOne({
    idCategoria,
    nombre,
    orden: Number(body?.orden) || 0,
    activo: body?.activo !== false,
    userChangeRecord: usuario?.username || 'sistema',
  });
  return {
    _id: res.insertedId,
    idCategoria,
    nombre,
    orden: Number(body?.orden) || 0,
    activo: body?.activo !== false,
  };
}

async function actualizarCategoria(idCategoria, body, usuario) {
  const id = Number(idCategoria);
  const existing = await CategoriaModel().findOne({ idCategoria: id }).lean();
  if (!existing) {
    const err = new Error('Categoría no encontrada');
    err.status = 404;
    throw err;
  }
  const patch = { userChangeRecord: usuario?.username || 'sistema' };
  if (body?.nombre !== undefined) {
    const nombre = String(body.nombre || '').trim();
    if (!nombre) {
      const err = new Error('El nombre de la categoría es obligatorio');
      err.status = 400;
      throw err;
    }
    const dup = await CategoriaModel().findOne({
      nombre: new RegExp(`^${nombre}$`, 'i'),
      idCategoria: { $ne: id },
    }).lean();
    if (dup) {
      const err = new Error('Ya existe una categoría con ese nombre');
      err.status = 409;
      throw err;
    }
    patch.nombre = nombre;
  }
  if (body?.orden !== undefined) patch.orden = Number(body.orden) || 0;
  if (body?.activo !== undefined) patch.activo = body.activo !== false && body.activo !== 'false';
  await CategoriaModel().updateOne({ idCategoria: id }, { $set: patch });
  return CategoriaModel().findOne({ idCategoria: id }).lean();
}

async function eliminarCategoria(idCategoria) {
  const id = Number(idCategoria);
  const cat = await CategoriaModel().findOne({ idCategoria: id }).lean();
  if (!cat) {
    const err = new Error('Categoría no encontrada');
    err.status = 404;
    throw err;
  }
  const enUso = await CapacitacionVirtualConfig.countDocuments({
    $or: [{ idCategorias: id }, { idCategoria: id }],
  });
  if (enUso > 0) {
    const err = new Error(
      `No se puede eliminar: ${enUso} curso(s) usan esta categoría. Desactívela o reasigne los cursos.`,
    );
    err.status = 409;
    throw err;
  }
  await CategoriaModel().deleteOne({ idCategoria: id });
  return { ok: true };
}

async function mapaCategorias() {
  const rows = await listarCategorias();
  return new Map(rows.map((c) => [Number(c.idCategoria), c]));
}

module.exports = {
  listarCategorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
  mapaCategorias,
  idsCategoriasConfig,
  resolverCategoriasCurso,
};
