const mongoose = require('mongoose');

const { ObjectId } = mongoose.Types;

const FRASE_VACIAR = 'VACIAR TABLA';
const FRASE_BORRAR = 'BORRAR REGISTROS';

/** Colecciones sensibles: se permiten pero la UI advierte. */
const COLECCIONES_CRITICAS = new Set(['usuarios', 'config', 'roles_app']);

const MAX_COLUMNAS = 10;
const MAX_CELDA = 120;

function db() {
  return mongoose.connection.db;
}

function nombreValido(nombre) {
  const n = String(nombre || '').trim();
  if (!n) {
    const err = new Error('Nombre de tabla inválido');
    err.status = 400;
    throw err;
  }
  if (n.startsWith('system.') || n.includes('__argo_restore') || n.includes('__staging')) {
    const err = new Error(`La tabla "${n}" no se puede modificar desde esta utilidad`);
    err.status = 403;
    throw err;
  }
  return n;
}

async function coleccionExiste(nombre) {
  const cols = await db().listCollections({ name: nombre }).toArray();
  return cols.length > 0;
}

function stringifyCelda(valor) {
  if (valor == null) return '';
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'object') {
    if (ObjectId.isValid(valor) && String(valor).length === 24) return String(valor);
    const s = JSON.stringify(valor);
    return s.length > MAX_CELDA ? `${s.slice(0, MAX_CELDA)}…` : s;
  }
  const s = String(valor);
  return s.length > MAX_CELDA ? `${s.slice(0, MAX_CELDA)}…` : s;
}

function inferirColumnas(doc) {
  if (!doc || typeof doc !== 'object') return ['_id'];
  const keys = Object.keys(doc).filter((k) => k !== '_id');
  keys.sort();
  return ['_id', ...keys.slice(0, MAX_COLUMNAS - 1)];
}

function filtroBusquedaSeguro(buscar, columnas) {
  const q = String(buscar || '').trim();
  if (!q) return {};
  if (/^[a-f0-9]{24}$/i.test(q)) {
    try {
      return { _id: new ObjectId(q) };
    } catch {
      /* noop */
    }
  }
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const or = [];
  for (const col of columnas) {
    if (col === '_id') continue;
    or.push({ [col]: rx });
  }
  if (!or.length) return {};
  return { $or: or };
}

async function listarColecciones() {
  const cols = await db()
    .listCollections()
    .toArray();
  const nombres = cols
    .map((c) => c.name)
    .filter((n) => !n.startsWith('system.') && !n.includes('__argo_restore') && !n.includes('__staging'))
    .sort();

  const items = await Promise.all(
    nombres.map(async (nombre) => {
      const total = await db().collection(nombre).estimatedDocumentCount();
      return {
        nombre,
        total,
        critica: COLECCIONES_CRITICAS.has(nombre),
      };
    }),
  );
  return items;
}

async function listarRegistros(nombre, { page = 1, limit = 50, buscar = '' } = {}) {
  const col = nombreValido(nombre);
  if (!(await coleccionExiste(col))) {
    const err = new Error(`La tabla "${col}" no existe`);
    err.status = 404;
    throw err;
  }

  const pagina = Math.max(1, parseInt(page, 10) || 1);
  const porPagina = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pagina - 1) * porPagina;

  const collection = db().collection(col);
  const muestra = await collection.find({}).limit(1).toArray();
  const columnas = inferirColumnas(muestra[0]);

  const filtro = buscar ? filtroBusquedaSeguro(buscar, columnas) : {};
  const total = await collection.countDocuments(filtro);
  const docs = await collection.find(filtro).sort({ _id: -1 }).skip(skip).limit(porPagina).toArray();

  const filas = docs.map((doc) => {
    const row = { _id: String(doc._id) };
    for (const c of columnas) {
      if (c === '_id') continue;
      row[c] = stringifyCelda(doc[c]);
    }
    return row;
  });

  return {
    coleccion: col,
    columnas,
    filas,
    pagina,
    porPagina,
    total,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
    critica: COLECCIONES_CRITICAS.has(col),
  };
}

async function vaciarColeccion(nombre) {
  const col = nombreValido(nombre);
  if (!(await coleccionExiste(col))) {
    const err = new Error(`La tabla "${col}" no existe`);
    err.status = 404;
    throw err;
  }
  const r = await db().collection(col).deleteMany({});
  return { coleccion: col, eliminados: r.deletedCount || 0 };
}

async function eliminarRegistros(nombre, ids) {
  const col = nombreValido(nombre);
  if (!(await coleccionExiste(col))) {
    const err = new Error(`La tabla "${col}" no existe`);
    err.status = 404;
    throw err;
  }
  const lista = Array.isArray(ids) ? ids : [];
  if (!lista.length) {
    const err = new Error('Indique al menos un registro a eliminar');
    err.status = 400;
    throw err;
  }
  const objectIds = [];
  for (const id of lista) {
    if (!ObjectId.isValid(String(id))) {
      const err = new Error(`Id inválido: ${id}`);
      err.status = 400;
      throw err;
    }
    objectIds.push(new ObjectId(String(id)));
  }
  const r = await db().collection(col).deleteMany({ _id: { $in: objectIds } });
  return { coleccion: col, eliminados: r.deletedCount || 0, solicitados: lista.length };
}

module.exports = {
  FRASE_VACIAR,
  FRASE_BORRAR,
  COLECCIONES_CRITICAS,
  listarColecciones,
  listarRegistros,
  vaciarColeccion,
  eliminarRegistros,
};
