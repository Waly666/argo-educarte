const TemaProgramaCea = require('../models/TemaProgramaCea');
const { TIPOS_TEMA_CEA } = require('../constants/programacionCea');
const { obtenerConfig, guardarConfig } = require('./configProgramacionCea');
const { listarFestivos } = require('./festivosColombia');
const { idProgDePrograma } = require('./programaServicio');
const {
  listarProgramasCea,
  buscarProgramaCea,
  rastreoAlumno,
  rastreoGlobal,
  alertasPendientes,
  guardarPreferenciasAlumno,
} = require('./programacionCeaRastreo');
const { alertasClasesCreado } = require('./programacionCeaAuto');

function idProgCanonico(prog) {
  return String(idProgDePrograma(prog));
}

async function listarTemas(idProg) {
  const prog = await buscarProgramaCea(idProg);
  if (!prog) return null;
  const idNorm = idProgCanonico(prog);
  const ids = new Set([idNorm, String(idProg ?? '').trim()]);
  const n = Number(idNorm);
  if (Number.isFinite(n)) ids.add(String(n));
  return TemaProgramaCea.find({ idProg: { $in: [...ids] } })
    .sort({ tipo: 1, orden: 1, nombre: 1 })
    .lean();
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function sumHorasTemasAsignadas(prog, tipo, excludeId = null) {
  const idNorm = idProgCanonico(prog);
  const ids = new Set([idNorm, String(idNorm).trim()]);
  const n = Number(idNorm);
  if (Number.isFinite(n)) ids.add(String(n));
  const temas = await TemaProgramaCea.find({
    idProg: { $in: [...ids] },
    tipo,
    activo: { $ne: false },
  }).lean();
  let sum = 0;
  for (const t of temas) {
    if (excludeId && String(t._id) === String(excludeId)) continue;
    sum += num(t.horasTema);
  }
  return sum;
}

async function validarTopeHorasTema(prog, tipo, horasTema, excludeId = null) {
  const limite = tipo === 'taller' ? num(prog.horasTaller) : num(prog.horasTeoria);
  if (limite <= 0) return null;
  const h =
    horasTema != null && horasTema !== '' && Number.isFinite(Number(horasTema)) ? Number(horasTema) : 0;
  if (h <= 0) {
    const label = tipo === 'taller' ? 'taller' : 'teoría';
    return {
      error: `Indique las horas del tema (el programa tiene ${limite} h de ${label})`,
      status: 400,
    };
  }
  const sum = await sumHorasTemasAsignadas(prog, tipo, excludeId);
  if (sum + h > limite + 0.001) {
    const label = tipo === 'taller' ? 'taller' : 'teoría';
    return {
      error: `Supera el tope de ${label}: ${sum + h} h de ${limite} h del programa`,
      status: 400,
    };
  }
  return null;
}

async function crearTema(idProg, body, usuario) {
  const prog = await buscarProgramaCea(idProg);
  if (!prog) return { error: 'Programa CEA no encontrado', status: 404 };
  const tipo = String(body?.tipo || '').trim();
  if (!TIPOS_TEMA_CEA.includes(tipo)) {
    return { error: 'tipo debe ser teoria o taller', status: 400 };
  }
  const nombre = String(body?.nombre || '').trim();
  if (!nombre) return { error: 'nombre es obligatorio', status: 400 };
  const horasTema =
    body?.horasTema != null && body.horasTema !== '' ? Number(body.horasTema) : null;
  const topeErr = await validarTopeHorasTema(prog, tipo, horasTema);
  if (topeErr) return topeErr;
  const idNorm = idProgCanonico(prog);
  const doc = await TemaProgramaCea.create({
    idProg: idNorm,
    tipo,
    nombre,
    orden: Number(body?.orden) || 1,
    horasTema: horasTema != null && Number.isFinite(horasTema) ? horasTema : null,
    activo: body?.activo !== false,
    userAddReg: usuario?.username || 'sistema',
  });
  return { doc: doc.toObject() };
}

async function actualizarTema(id, body, usuario) {
  const tema = await TemaProgramaCea.findById(id);
  if (!tema) return { error: 'Tema no encontrado', status: 404 };
  const prog = await buscarProgramaCea(tema.idProg);
  if (!prog) return { error: 'Programa CEA no encontrado', status: 404 };
  const tipoFinal = body?.tipo != null ? String(body.tipo).trim() : tema.tipo;
  if (body?.tipo != null) {
    if (!TIPOS_TEMA_CEA.includes(tipoFinal)) return { error: 'tipo inválido', status: 400 };
    tema.tipo = tipoFinal;
  }
  if (body?.nombre != null) {
    const nombre = String(body.nombre).trim();
    if (!nombre) return { error: 'nombre no puede quedar vacío', status: 400 };
    tema.nombre = nombre;
  }
  if (body?.orden != null) tema.orden = Number(body.orden) || 1;
  let horasFinal = tema.horasTema;
  if (body?.horasTema !== undefined) {
    horasFinal = body.horasTema != null && body.horasTema !== '' ? Number(body.horasTema) : null;
    tema.horasTema = horasFinal;
  }
  if (body?.activo !== undefined) tema.activo = body.activo !== false;
  const topeErr = await validarTopeHorasTema(prog, tipoFinal, horasFinal, id);
  if (topeErr) return topeErr;
  tema.userChangeRecord = usuario?.username || 'sistema';
  await tema.save();
  return { doc: tema.toObject() };
}

async function eliminarTema(id) {
  const tema = await TemaProgramaCea.findByIdAndDelete(id);
  if (!tema) return { error: 'Tema no encontrado', status: 404 };
  return { ok: true };
}

module.exports = {
  obtenerConfig,
  guardarConfig,
  listarFestivos,
  listarProgramasCea,
  buscarProgramaCea,
  listarTemas,
  crearTema,
  actualizarTema,
  eliminarTema,
  rastreoAlumno,
  rastreoGlobal,
  alertasPendientes,
  alertasClasesCreado,
  guardarPreferenciasAlumno,
};
