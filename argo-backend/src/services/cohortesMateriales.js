const MaterialCohorte = require('../models/MaterialCohorte');
const MateriaCohorte = require('../models/MateriaCohorte');
const Cohorte = require('../models/Cohorte');

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const TIPOS = ['ENLACE', 'VIDEO', 'DOCUMENTO', 'ARCHIVO'];

function dto(m, matNombre) {
  return {
    _id: String(m._id),
    idProg: m.idProg,
    numSemestre: m.numSemestre,
    idMateria: String(m.idMateria),
    materiaNombre: matNombre || '',
    idCohorte: m.idCohorte ? String(m.idCohorte) : null,
    titulo: m.titulo,
    tipo: m.tipo,
    url: m.url,
    descripcion: m.descripcion,
    orden: m.orden,
    activo: m.activo,
  };
}

/** Lista materiales por programa/semestre (y opcionalmente cohorte). */
async function listarMateriales(filtros = {}) {
  const q = {};
  if (filtros.idProg) q.idProg = String(filtros.idProg);
  if (filtros.numSemestre) q.numSemestre = Number(filtros.numSemestre);
  if (filtros.idMateria) q.idMateria = filtros.idMateria;
  const rows = await MaterialCohorte.find(q).sort({ idMateria: 1, orden: 1 }).lean();
  const materias = await MateriaCohorte.find({ _id: { $in: rows.map((r) => r.idMateria) } })
    .select('nombre')
    .lean();
  const matMap = new Map(materias.map((m) => [String(m._id), m.nombre]));
  return rows.map((r) => dto(r, matMap.get(String(r.idMateria))));
}

async function crearMaterial(body, usuario) {
  if (!body?.idMateria) throw httpError('idMateria requerido');
  const materia = await MateriaCohorte.findById(body.idMateria).lean();
  if (!materia) throw httpError('Materia no encontrada', 404);
  if (!String(body?.titulo || '').trim()) throw httpError('El título es obligatorio');
  const tipo = TIPOS.includes(body.tipo) ? body.tipo : 'ENLACE';
  const doc = await MaterialCohorte.create({
    idProg: materia.idProg,
    numSemestre: materia.numSemestre,
    idMateria: materia._id,
    idCohorte: body.idCohorte || null,
    titulo: String(body.titulo).trim(),
    tipo,
    url: String(body.url || '').trim(),
    descripcion: String(body.descripcion || '').trim(),
    orden: num(body.orden) || 1,
    activo: body.activo !== false,
    userAddReg: usuario,
  });
  return dto(doc.toObject(), materia.nombre);
}

async function actualizarMaterial(id, body, usuario) {
  const m = await MaterialCohorte.findById(id);
  if (!m) throw httpError('Material no encontrado', 404);
  if (body.titulo !== undefined) m.titulo = String(body.titulo).trim();
  if (body.tipo !== undefined && TIPOS.includes(body.tipo)) m.tipo = body.tipo;
  if (body.url !== undefined) m.url = String(body.url).trim();
  if (body.descripcion !== undefined) m.descripcion = String(body.descripcion).trim();
  if (body.orden !== undefined) m.orden = num(body.orden) || 1;
  if (body.activo !== undefined) m.activo = body.activo !== false;
  if (body.idCohorte !== undefined) m.idCohorte = body.idCohorte || null;
  m.userChangeRecord = usuario;
  await m.save();
  const materia = await MateriaCohorte.findById(m.idMateria).select('nombre').lean();
  return dto(m.toObject(), materia?.nombre);
}

async function eliminarMaterial(id) {
  await MaterialCohorte.deleteOne({ _id: id });
  return { ok: true };
}

/** Materiales visibles para una cohorte (los del programa/semestre + los específicos de la cohorte). */
async function materialesParaCohorte(idCohorte) {
  const cohorte = await Cohorte.findById(idCohorte).lean();
  if (!cohorte) throw httpError('Cohorte no encontrada', 404);
  const rows = await MaterialCohorte.find({
    idProg: cohorte.idProg,
    numSemestre: cohorte.numSemestre,
    activo: { $ne: false },
    $or: [{ idCohorte: null }, { idCohorte }],
  })
    .sort({ idMateria: 1, orden: 1 })
    .lean();
  const materias = await MateriaCohorte.find({ _id: { $in: rows.map((r) => r.idMateria) } })
    .select('nombre')
    .lean();
  const matMap = new Map(materias.map((m) => [String(m._id), m.nombre]));
  return rows.map((r) => dto(r, matMap.get(String(r.idMateria))));
}

module.exports = {
  listarMateriales,
  crearMaterial,
  actualizarMaterial,
  eliminarMaterial,
  materialesParaCohorte,
};
