const mongoose = require('mongoose');
const { models } = require('../models/catalogos');
const CapacitacionVirtualConfig = require('../models/CapacitacionVirtualConfig');
const { metaCatalogo, inferirCamposId, nombreValido, docSegunEsquema, resolverCamposListado, camposEsquema, CATALOGOS_INSPECCION, CATALOGOS_DOCUMENTOS, validarClaseServCatalogo } = require('./catalogoMeta');
const { syncControlaVencimientoDesdeCatalogo: syncVehiDesdeCatalogo, invalidarCacheClases } = require('./configRequisitosDocumentosVehiculos');
const { syncControlaVencimientoDesdeCatalogo: syncEmpDesdeCatalogo } = require('./configRequisitosDocumentosEmpleados');
const { coerceDocument, num: numCoerce } = require('../utils/coerceTypes');

function num(v) {
  if (v == null || v === '') return null;
  const n = numCoerce(v);
  return Number.isFinite(n) ? n : null;
}

function limpiarBody(body) {
  return coerceDocument(docSegunEsquema(null, body));
}

function limpiarBodyCatalogo(nombre, body) {
  return coerceDocument(docSegunEsquema(nombre, body));
}

async function sincronizarVencimientoConfig(nombre, doc) {
  if (nombre === 'itemDocumentosVehiculo') {
    await syncVehiDesdeCatalogo(doc.idDocVehi, doc.controlaVencimiento !== false);
    return;
  }
  if (nombre === 'itemDocumentosInstructores') {
    await syncEmpDesdeCatalogo(doc.idDocInst, doc.controlaVencimiento !== false);
  }
}

async function maxIdEnCampo(model, field) {
  const rows = await model.find({ [field]: { $exists: true, $ne: null } }).lean();
  let max = 0;
  for (const r of rows) {
    const raw = r[field];
    const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

async function listar(nombre, opts = {}) {
  const meta = metaCatalogo(nombre);
  if (!meta) return null;

  const q = (opts.q || '').trim();
  const skip = Math.max(0, parseInt(opts.skip, 10) || 0);
  const limit = Math.min(Math.max(1, parseInt(opts.limit, 10) || 50), 200);

  const filter = {};
  const esquema = camposEsquema(nombre);
  if (q.length >= 2) {
    const sample = await models[nombre].findOne({}).lean();
    const keys = esquema?.length
      ? esquema
      : Object.keys(sample || {}).filter((k) => k !== '_id' && k !== '__v' && !/^col\d+$/i.test(k));
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const or = [];
    for (const k of keys.slice(0, 8)) {
      or.push({ [k]: re });
      if (or.length >= 6) break;
    }
    if (or.length) filter.$or = or;
  }

  const model = models[nombre];
  const sort = nombre === 'categoriasVirtual' ? { orden: 1, nombre: 1 } : {};
  const [total, rows] = await Promise.all([
    model.countDocuments(filter),
    model.find(filter).sort(sort).skip(skip).limit(limit).lean(),
  ]);

  let campos = resolverCamposListado(nombre, rows[0]);
  if (!campos.length) {
    const one = await model.findOne({}).lean();
    campos = resolverCamposListado(nombre, one);
  }

  const idFields =
    meta.idFields.length > 0
      ? meta.idFields
      : rows[0]
        ? inferirCamposId(rows[0])
        : [];

  return { meta, total, skip, limit, campos, idFields, rows };
}

async function validarCategoriaVirtual(doc, excludeId = null) {
  const nombre = String(doc?.nombre || '').trim();
  if (!nombre) {
    const err = new Error('El nombre de la categoría es obligatorio');
    err.status = 400;
    throw err;
  }
  const dupQ = { nombre: new RegExp(`^${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
  if (excludeId != null) dupQ.idCategoria = { $ne: Number(excludeId) };
  const dup = await models.categoriasVirtual.findOne(dupQ).lean();
  if (dup) {
    const err = new Error('Ya existe una categoría con ese nombre');
    err.status = 409;
    throw err;
  }
  if (doc.activo === undefined || doc.activo === null || doc.activo === '') doc.activo = true;
  if (doc.orden == null || doc.orden === '') doc.orden = 0;
}

async function crear(nombre, body) {
  if (!nombreValido(nombre)) return null;
  const doc = limpiarBodyCatalogo(nombre, body);
  if (nombre === 'categoriasVirtual') await validarCategoriaVirtual(doc);
  if (nombre === 'catTipServicio') validarClaseServCatalogo(doc);
  const meta = metaCatalogo(nombre);
  const idField = meta.idFields[0];
  if (idField && (doc[idField] == null || doc[idField] === '')) {
    const next = await maxIdEnCampo(models[nombre], idField);
    doc[idField] = next;
  }
  const res = await models[nombre].collection.insertOne(doc);
  const saved = { ...doc, _id: res.insertedId };
  if (CATALOGOS_DOCUMENTOS.has(nombre)) {
    await sincronizarVencimientoConfig(nombre, saved);
  }
  if (nombre === 'claseVehiculo') invalidarCacheClases();
  return saved;
}

async function actualizar(nombre, mongoId, body) {
  if (!nombreValido(nombre)) return null;
  if (!mongoose.Types.ObjectId.isValid(mongoId)) {
    const err = new Error('ID de documento inválido');
    err.status = 400;
    throw err;
  }
  const doc = limpiarBodyCatalogo(nombre, body);
  const oid = new mongoose.Types.ObjectId(mongoId);
  const existing = await models[nombre].findOne({ _id: oid }).lean();
  if (!existing) {
    const err = new Error('Registro no encontrado');
    err.status = 404;
    throw err;
  }
  if (nombre === 'categoriasVirtual') {
    await validarCategoriaVirtual({ ...existing, ...doc }, existing.idCategoria);
  }
  if (nombre === 'catTipServicio') validarClaseServCatalogo(doc);
  const update = { $set: doc };
  if (CATALOGOS_INSPECCION.has(nombre)) {
    update.$unset = { claseVehiculo: '' };
  }
  await models[nombre].updateOne({ _id: oid }, update);
  const saved = await models[nombre].findOne({ _id: oid }).lean();
  if (CATALOGOS_DOCUMENTOS.has(nombre)) {
    await sincronizarVencimientoConfig(nombre, saved);
  }
  if (nombre === 'claseVehiculo') invalidarCacheClases();
  return saved;
}

async function eliminar(nombre, mongoId) {
  if (!nombreValido(nombre)) return null;
  if (!mongoose.Types.ObjectId.isValid(mongoId)) {
    const err = new Error('ID de documento inválido');
    err.status = 400;
    throw err;
  }
  const oid = new mongoose.Types.ObjectId(mongoId);
  if (nombre === 'categoriasVirtual') {
    const existing = await models[nombre].findOne({ _id: oid }).lean();
    if (!existing) {
      const err = new Error('Registro no encontrado');
      err.status = 404;
      throw err;
    }
    const idCat = Number(existing.idCategoria);
    const enUso = await CapacitacionVirtualConfig.countDocuments({
      $or: [{ idCategorias: idCat }, { idCategoria: idCat }],
    });
    if (enUso > 0) {
      const err = new Error(
        `No se puede eliminar: ${enUso} curso(s) usan esta categoría. Desactívela o reasigne los cursos.`,
      );
      err.status = 409;
      throw err;
    }
  }
  const r = await models[nombre].deleteOne({ _id: oid });
  if (r.deletedCount === 0) {
    const err = new Error('Registro no encontrado');
    err.status = 404;
    throw err;
  }
  return { ok: true };
}

async function importar(nombre, rows, modo = 'reemplazar') {
  if (!nombreValido(nombre)) return null;
  if (!Array.isArray(rows) || rows.length === 0) {
    const err = new Error('Se requiere un arreglo "rows" con al menos un registro');
    err.status = 400;
    throw err;
  }
  const limpias = rows.map((r) => limpiarBodyCatalogo(nombre, limpiarBody(r)));
  if (nombre === 'catTipServicio') {
    for (const row of limpias) validarClaseServCatalogo(row);
  }
  const col = models[nombre].collection;
  if (modo === 'reemplazar') {
    await col.deleteMany({});
    if (limpias.length) await col.insertMany(limpias);
  } else {
    await col.insertMany(limpias);
  }
  const total = await models[nombre].countDocuments({});
  if (nombre === 'claseVehiculo') invalidarCacheClases();
  return { insertados: limpias.length, total, modo };
}

module.exports = { listar, crear, actualizar, eliminar, importar, limpiarBody, num };
