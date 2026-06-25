const ComboPrograma = require('../models/ComboPrograma');
const {
  buscarPrograma,
  listarServiciosMatricula,
  programaUsaSemestres,
  num,
  valorTarifaServicio,
} = require('./programaServicio');

const TARIFA_COMBO = 2; // Combos siempre usan tarifa 2

function mapCombo(c) {
  return {
    id: String(c._id),
    nombre: c.nombre,
    descripcion: c.descripcion || '',
    programas: c.programas || [],
    activo: c.activo !== false,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

async function listarCombos({ soloActivos = true } = {}) {
  const filtro = soloActivos ? { activo: true } : {};
  const docs = await ComboPrograma.find(filtro).sort({ nombre: 1 }).lean();
  return docs.map(mapCombo);
}

async function obtenerCombo(id) {
  const doc = await ComboPrograma.findById(id).lean();
  if (!doc) {
    const err = new Error('Combo no encontrado');
    err.status = 404;
    throw err;
  }
  return mapCombo(doc);
}

async function crearCombo({ nombre, descripcion, programas, usuarioErp }) {
  const nom = String(nombre || '').trim();
  if (!nom) {
    const err = new Error('El nombre del combo es obligatorio');
    err.status = 400;
    throw err;
  }
  if (!Array.isArray(programas) || programas.length < 2) {
    const err = new Error('El combo debe incluir al menos 2 programas');
    err.status = 400;
    throw err;
  }
  const doc = await ComboPrograma.create({
    nombre: nom,
    descripcion: String(descripcion || '').trim(),
    programas: programas.map((p) => String(p).trim()).filter(Boolean),
    activo: true,
    userAddReg: usuarioErp || 'erp',
  });
  return mapCombo(doc.toObject());
}

async function actualizarCombo(id, { nombre, descripcion, programas, activo }) {
  const patch = {};
  if (nombre !== undefined) {
    const nom = String(nombre || '').trim();
    if (!nom) {
      const err = new Error('El nombre del combo es obligatorio');
      err.status = 400;
      throw err;
    }
    patch.nombre = nom;
  }
  if (descripcion !== undefined) patch.descripcion = String(descripcion || '').trim();
  if (Array.isArray(programas)) {
    if (programas.length < 2) {
      const err = new Error('El combo debe incluir al menos 2 programas');
      err.status = 400;
      throw err;
    }
    patch.programas = programas.map((p) => String(p).trim()).filter(Boolean);
  }
  if (activo !== undefined) patch.activo = activo === true || activo === 'true';

  const doc = await ComboPrograma.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
  if (!doc) {
    const err = new Error('Combo no encontrado');
    err.status = 404;
    throw err;
  }
  return mapCombo(doc);
}

async function eliminarCombo(id) {
  const doc = await ComboPrograma.findByIdAndDelete(id).lean();
  if (!doc) {
    const err = new Error('Combo no encontrado');
    err.status = 404;
    throw err;
  }
  return { ok: true, message: `Combo "${doc.nombre}" eliminado.` };
}

/**
 * Calcula el detalle de un combo para un alumno (programas, valores a tarifa 2, totales).
 * No crea nada — solo devuelve la vista previa.
 */
async function previstaCombo(id) {
  const combo = await obtenerCombo(id);
  const detalles = [];
  let totalValor = 0;

  for (const idProg of combo.programas) {
    const prog = await buscarPrograma(idProg);
    if (!prog) continue;
    const servicios = await listarServiciosMatricula(prog);
    const usaSem = programaUsaSemestres(prog) && servicios.length > 0;
    let valor = 0;
    if (usaSem) {
      valor = servicios.reduce((acc, s) => acc + valorTarifaServicio(s, TARIFA_COMBO, prog), 0);
    } else {
      valor = valorTarifaServicio(servicios[0] || null, TARIFA_COMBO, prog);
    }
    totalValor += valor;
    detalles.push({
      idPrograma: String(prog.idPrograma ?? prog._id),
      nombreProg: prog.nombreProg || prog.descripcion || idProg,
      valor,
    });
  }

  return {
    id: combo.id,
    nombre: combo.nombre,
    descripcion: combo.descripcion,
    tarifa: TARIFA_COMBO,
    totalValor,
    programas: detalles,
  };
}

module.exports = {
  listarCombos,
  obtenerCombo,
  crearCombo,
  actualizarCombo,
  eliminarCombo,
  previstaCombo,
  TARIFA_COMBO,
};
