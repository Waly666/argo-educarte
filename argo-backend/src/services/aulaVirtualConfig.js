const fs = require('fs');
const path = require('path');
const CapacitacionVirtualConfig = require('../models/CapacitacionVirtualConfig');
const { models: cat } = require('../models/catalogos');
const { buscarPrograma, listarServiciosMatricula } = require('./programaServicio');
const { servicioMatriculaPrograma } = require('./aulaVirtualCatalogo');
const { programaAdmiteMatriculaVirtual } = require('./programaModalidad');
const { resolvePath, publicUrlPath } = require('../middleware/upload');
const { normalizarNivelVirtual } = require('../constants/nivelVirtual');
const { idsCategoriasConfig } = require('./aulaVirtualCategorias');

const DEFAULTS = {
  publicadoPortal: false,
  modoCertificado: 'al_pagar',
  requierePagoParaCursar: false,
  pctMinCompletitud: 80,
  pctMinEvaluaciones: 60,
  intentosMaxEval: 3,
  idCategorias: [],
  nivel: null,
  indexHtml: 'index.html',
  materiales: [],
  sesionesMeet: [],
};

async function asegurarProgramaVirtual(idPrograma) {
  const prog = await buscarPrograma(idPrograma);
  if (!prog) {
    const err = new Error('Programa no encontrado');
    err.status = 404;
    throw err;
  }
  const servicios = await listarServiciosMatricula(prog);
  if (!programaAdmiteMatriculaVirtual(prog, servicios)) {
    const err = new Error('El programa no admite modalidad virtual o no tiene tarifa virtual configurada.');
    err.status = 400;
    throw err;
  }
  const serv = servicios[0] || null;
  return { prog, serv };
}

async function obtenerConfig(idPrograma) {
  const id = String(idPrograma);
  let cfg = await CapacitacionVirtualConfig.findOne({ idPrograma: id }).lean();
  if (!cfg) cfg = { idPrograma, ...DEFAULTS };
  else cfg.idCategorias = idsCategoriasConfig(cfg);
  return cfg;
}

async function validarIdCategoriaItem(idCategoria) {
  if (idCategoria == null || idCategoria === '' || idCategoria === 0) return null;
  const id = Number(idCategoria);
  if (!Number.isFinite(id) || id <= 0) {
    const err = new Error('Categoría inválida');
    err.status = 400;
    throw err;
  }
  const row = await cat.categoriasVirtual.findOne({ idCategoria: id, activo: { $ne: false } }).lean();
  if (!row) {
    const err = new Error('Categoría no encontrada o inactiva');
    err.status = 400;
    throw err;
  }
  return id;
}

async function validarIdCategorias(raw) {
  const lista = Array.isArray(raw) ? raw : raw == null || raw === '' ? [] : [raw];
  const out = [];
  for (const item of lista) {
    const id = await validarIdCategoriaItem(item);
    if (id) out.push(id);
  }
  return [...new Set(out)];
}

async function actualizarFichaPrograma(idPrograma, body, usuario) {
  const prog = await buscarPrograma(idPrograma);
  if (!prog) return;
  const patch = {
    fechaMod: new Date(),
    userChangeRecord: usuario?.username || 'sistema',
  };
  let hay = false;

  if (body.descripcionVirtual !== undefined) {
    patch.descripcionVirtual = String(body.descripcionVirtual || '').trim() || null;
    hay = true;
  }
  if (body.horas !== undefined) {
    const h = body.horas === '' || body.horas == null ? null : Number(body.horas);
    patch.horas = h != null && Number.isFinite(h) && h >= 0 ? h : null;
    hay = true;
  }
  if (body.urlPortadaVirtual !== undefined) {
    patch.urlPortadaVirtual = String(body.urlPortadaVirtual || '').trim() || null;
    hay = true;
  }

  if (!hay) return prog;
  await cat.programas.updateOne({ idPrograma: prog.idPrograma }, { $set: patch });
  return buscarPrograma(idPrograma);
}

async function guardarConfig(idPrograma, body, usuario) {
  const { prog } = await asegurarProgramaVirtual(idPrograma);
  const id = String(idPrograma);
  const patch = {
    idPrograma: id,
    publicadoPortal: body.publicadoPortal === true || body.publicadoPortal === 'true',
    modoCertificado: body.modoCertificado === 'al_aprobar' ? 'al_aprobar' : 'al_pagar',
    requierePagoParaCursar:
      body.requierePagoParaCursar === true || body.requierePagoParaCursar === 'true',
    pctMinCompletitud: Math.min(100, Math.max(0, Number(body.pctMinCompletitud ?? 80))),
    pctMinEvaluaciones: Math.min(100, Math.max(0, Number(body.pctMinEvaluaciones ?? 60))),
    intentosMaxEval: Math.max(1, Number(body.intentosMaxEval ?? 3)),
    indexHtml: String(body.indexHtml || 'index.html').trim() || 'index.html',
    materiales: Array.isArray(body.materiales) ? body.materiales : [],
    sesionesMeet: Array.isArray(body.sesionesMeet) ? body.sesionesMeet : [],
    userChangeRecord: usuario?.username || 'sistema',
  };

  if (body.idCategorias !== undefined || body.idCategoria !== undefined) {
    const raw = body.idCategorias !== undefined ? body.idCategorias : body.idCategoria;
    patch.idCategorias = await validarIdCategorias(raw);
  }
  if (body.nivel !== undefined) {
    const nivel = normalizarNivelVirtual(body.nivel);
    patch.nivel = nivel;
  }

  if (body.rutaPaquete !== undefined) {
    patch.rutaPaquete = body.rutaPaquete ? String(body.rutaPaquete).trim() : null;
  }

  const update = { $set: patch };
  if (patch.idCategorias !== undefined) update.$unset = { idCategoria: '' };
  await CapacitacionVirtualConfig.updateOne({ idPrograma: id }, update, { upsert: true });
  await actualizarFichaPrograma(prog.idPrograma, body, usuario);
  return obtenerConfig(id);
}

async function asignarPaquete(idPrograma, destDirRelative, usuario) {
  await asegurarProgramaVirtual(idPrograma);
  const id = String(idPrograma);
  const patch = {
    idPrograma: id,
    rutaPaquete: destDirRelative,
    userChangeRecord: usuario?.username || 'sistema',
  };
  await CapacitacionVirtualConfig.updateOne(
    { idPrograma: id },
    { $set: patch, $setOnInsert: { ...DEFAULTS } },
    { upsert: true },
  );
  return obtenerConfig(id);
}

function agregarMaterialArchivo(idPrograma, material, usuario) {
  return CapacitacionVirtualConfig.findOneAndUpdate(
    { idPrograma: String(idPrograma) },
    {
      $push: { materiales: material },
      $set: { userChangeRecord: usuario?.username || 'sistema' },
      $setOnInsert: { idPrograma: String(idPrograma), ...DEFAULTS },
    },
    { upsert: true, new: true },
  ).lean();
}

function eliminarMaterial(idPrograma, materialId) {
  return CapacitacionVirtualConfig.findOneAndUpdate(
    { idPrograma: String(idPrograma) },
    { $pull: { materiales: { _id: materialId } } },
    { new: true },
  ).lean();
}

function rutaPaquetePrograma(idPrograma) {
  const safe = String(idPrograma).replace(/[^\w.-]+/g, '_');
  return publicUrlPath('aula-virtual-cursos', safe);
}

function asegurarDirPaquete(idPrograma) {
  const rel = rutaPaquetePrograma(idPrograma);
  const abs = resolvePath(rel);
  if (!abs) throw new Error('Ruta de paquete inválida');
  fs.mkdirSync(abs, { recursive: true });
  return { rel, abs };
}

function requierePagoParaCursar(cfg) {
  return cfg?.requierePagoParaCursar === true;
}

/** Matriculado + paquete instalado; si el curso exige pago, saldo debe estar en cero. */
function puedeCursarVirtual({ cfg, tienePaquete, matriculado, pago }) {
  if (!matriculado || !tienePaquete) return false;
  if (!requierePagoParaCursar(cfg)) return true;
  return !!pago?.pagado;
}

module.exports = {
  obtenerConfig,
  guardarConfig,
  requierePagoParaCursar,
  puedeCursarVirtual,
  asignarPaquete,
  agregarMaterialArchivo,
  eliminarMaterial,
  rutaPaquetePrograma,
  asegurarDirPaquete,
  asegurarProgramaVirtual,
  actualizarFichaPrograma,
};
