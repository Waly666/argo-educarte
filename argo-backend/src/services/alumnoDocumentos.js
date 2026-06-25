const mongoose = require('mongoose');
const Matricula = require('../models/Matricula');
const Certificado = require('../models/Certificado');
const { models: cat } = require('../models/catalogos');
const { numDocQuery } = require('../utils/numDoc');
const {
  obtenerConfigRequisitosDocumentos,
  tipoDocumentoPorCodigo,
} = require('./configRequisitosDocumentos');
const {
  cargarIndiceTipCap,
  resolverIdTipCapCanonico,
  matchIdTipCap: matchIdTipCapConIndice,
  findRequisitoPorCap,
} = require('./tipoCapacitacionMatch');

async function buscarPrograma(idPrograma) {
  const q = String(idPrograma || '').trim();
  if (!q) return null;
  const n = Number(q);
  return cat.programas
    .findOne({
      $or: [
        { idPrograma: q },
        ...(Number.isFinite(n) ? [{ idPrograma: n }, { idProg: n }] : []),
        { idProg: q },
        { codigoProg: q },
        mongoose.Types.ObjectId.isValid(q) ? { _id: new mongoose.Types.ObjectId(q) } : null,
      ].filter(Boolean),
    })
    .lean();
}

/** Compatibilidad: usa catálogo si está en caché; preferir matchIdTipCapAsync. */
function matchIdTipCap(a, b) {
  const sa = String(a ?? '').trim();
  const sb = String(b ?? '').trim();
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  const na = sa.match(/^(\d+)/);
  const nb = sb.match(/^(\d+)/);
  return !!(na && nb && na[1] === nb[1]);
}

async function matchIdTipCapAsync(a, b) {
  const indice = await cargarIndiceTipCap();
  return matchIdTipCapConIndice(a, b, indice);
}

async function etiquetasTipoCap(ids) {
  const rows = await cat.catTipoCapacitacion.find({}).lean();
  const map = new Map();
  for (const r of rows) {
    const id = String(r.idTipCap ?? r.id ?? '').trim();
    const label = String(r.tipoCap || r.descripcion || r.nombre || id).trim();
    if (id) map.set(id, label);
    const m = id.match(/^(\d+)/);
    if (m) map.set(m[1], label);
  }
  return (idTipCap) => {
    const k = String(idTipCap).trim();
    if (map.has(k)) return map.get(k);
    const m = k.match(/^(\d+)/);
    return (m && map.get(m[1])) || k;
  };
}

function docsAlumnoMap(alumno) {
  const raw = alumno?.docsAlumno;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...raw };
  }
  return {};
}

/** Matrícula vigente (no anulada / cancelada / eliminada). */
function esMatriculaActiva(m) {
  const est = String(m?.estado ?? 'activa').trim().toLowerCase();
  if (['anulada', 'anulado', 'cancelada', 'inactiva', 'eliminada'].includes(est)) return false;
  return true;
}

function idsProgramaEquivalentes(progId, prog) {
  const ids = new Set();
  const raw = String(progId ?? '').trim();
  if (raw) ids.add(raw);
  if (prog) {
    if (prog.idPrograma != null && String(prog.idPrograma).trim()) {
      ids.add(String(prog.idPrograma).trim());
    }
    if (prog.idProg != null && String(prog.idProg).trim()) {
      ids.add(String(prog.idProg).trim());
    }
  }
  return ids;
}

/** Programas con certificado emitido (no anulado) — ya no exigen documentos por esa matrícula. */
async function idsProgramaConCertificadoValido(numDoc) {
  const certs = await Certificado.find({
    ...numDocQuery(numDoc),
    estado: { $nin: ['anulado', 'anulada'] },
  })
    .select('idProg')
    .lean();

  const ids = new Set();
  for (const c of certs) {
    const raw = String(c.idProg ?? '').trim();
    if (!raw) continue;
    const prog = await buscarPrograma(raw);
    for (const id of idsProgramaEquivalentes(raw, prog)) ids.add(id);
  }
  return ids;
}

function matriculaExcluidaDeRequisitosDocs(m, prog, idsCertificados) {
  if (!esMatriculaActiva(m)) return true;
  const progId = m.idProg || m.idPrograma;
  for (const id of idsProgramaEquivalentes(progId, prog)) {
    if (idsCertificados.has(id)) return true;
  }
  return false;
}

function tipoDocumentoConfig(config, idDoc) {
  const id = String(idDoc).trim();
  return (config.tiposDocumento || []).find(
    (t) => String(t.id).trim() === id && t.activo !== false,
  );
}

function urlDocumentoAlumno(alumno, config, idDoc) {
  const id = String(idDoc).trim();
  const map = docsAlumnoMap(alumno);
  if (map[id]) return map[id];
  const tipo = tipoDocumentoConfig(config, id);
  if (!tipo) return '';
  if (tipo.codigo === 'CEDULA' && alumno?.urlCedula) return alumno.urlCedula;
  if (tipo.codigo === 'LICENCIA' && alumno?.urlLicencia) return alumno.urlLicencia;
  return '';
}

async function calcularDocumentosRequeridos(alumno) {
  const numDoc = alumno?.numDoc;
  if (numDoc == null) {
    return { tiposCapacitacion: [], documentos: [], sinMatriculas: true };
  }

  const [config, matriculasRaw, labelCap, indiceTipCap, idsCertificados] = await Promise.all([
    obtenerConfigRequisitosDocumentos(),
    Matricula.find(numDocQuery(numDoc)).sort({ createdAt: -1 }).lean(),
    etiquetasTipoCap(),
    cargarIndiceTipCap(),
    idsProgramaConCertificadoValido(numDoc),
  ]);

  const matriculas = matriculasRaw.filter(esMatriculaActiva);

  const capMap = new Map();

  for (const m of matriculas) {
    const progId = m.idProg || m.idPrograma;
    const prog = await buscarPrograma(progId);
    if (matriculaExcluidaDeRequisitosDocs(m, prog, idsCertificados)) continue;
    const idTipCap = prog?.idTipCap;
    if (idTipCap == null || idTipCap === '') continue;
    const key = resolverIdTipCapCanonico(idTipCap, indiceTipCap);
    if (!key) continue;
    const nombreProg = String(prog?.nombreProg || prog?.descripcion || progId || '').trim();
    if (!capMap.has(key)) {
      capMap.set(key, {
        idTipCap: key,
        label: labelCap(idTipCap),
        programas: [],
      });
    }
    if (nombreProg && !capMap.get(key).programas.includes(nombreProg)) {
      capMap.get(key).programas.push(nombreProg);
    }
  }

  const tiposCapacitacion = [...capMap.values()];
  const idDocsUnion = new Set();
  const docRequeridoPor = new Map();

  for (const cap of tiposCapacitacion) {
    const req = findRequisitoPorCap(config, cap.idTipCap, indiceTipCap);
    if (!req) continue;
    for (const idDoc of req.idDocumentos || []) {
      idDocsUnion.add(String(idDoc));
      if (!docRequeridoPor.has(idDoc)) docRequeridoPor.set(idDoc, []);
      const labels = docRequeridoPor.get(idDoc);
      if (!labels.includes(cap.label)) labels.push(cap.label);
    }
  }

  const documentos = [...idDocsUnion]
    .map((id) => {
      const meta = tipoDocumentoConfig(config, id);
      if (!meta) return null;
      const url = urlDocumentoAlumno(alumno, config, id);
      return {
        id: meta.id,
        codigo: meta.codigo,
        nombre: meta.nombre,
        descripcion: meta.descripcion,
        url: url || '',
        subido: !!url,
        requeridoPor: docRequeridoPor.get(id) || [],
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return {
    tiposCapacitacion,
    documentos,
    sinMatriculas: matriculas.length === 0,
  };
}

async function validarDocumentosParaPrograma(alumno, idPrograma) {
  const prog = await buscarPrograma(idPrograma);
  if (!prog) {
    return { ok: false, pendientes: [], error: 'Programa no encontrado' };
  }
  const [config, labelCap, indiceTipCap] = await Promise.all([
    obtenerConfigRequisitosDocumentos(),
    etiquetasTipoCap(),
    cargarIndiceTipCap(),
  ]);
  const idTipCapRaw = prog.idTipCap != null ? String(prog.idTipCap).trim() : '';
  const idTipCap = idTipCapRaw ? resolverIdTipCapCanonico(idTipCapRaw, indiceTipCap) : '';
  if (!idTipCap) {
    return { ok: true, pendientes: [], programa: prog.nombreProg || prog.descripcion, idTipCap: '' };
  }

  const req = findRequisitoPorCap(config, idTipCapRaw, indiceTipCap);
  if (!req?.idDocumentos?.length) {
    return {
      ok: true,
      pendientes: [],
      programa: prog.nombreProg || prog.descripcion,
      idTipCap,
      tipoCapLabel: labelCap(idTipCapRaw),
    };
  }

  const pendientes = [];
  for (const idDoc of req.idDocumentos) {
    const meta = tipoDocumentoConfig(config, idDoc);
    if (!meta) continue;
    const url = urlDocumentoAlumno(alumno, config, idDoc);
    if (!url) {
      pendientes.push({
        id: meta.id,
        codigo: meta.codigo,
        nombre: meta.nombre,
        requeridoPor: [labelCap(idTipCapRaw)],
      });
    }
  }

  return {
    ok: pendientes.length === 0,
    pendientes,
    programa: prog.nombreProg || prog.descripcion,
    idTipCap,
    tipoCapLabel: labelCap(idTipCapRaw),
  };
}

async function validarDocumentosPendientesAlumno(alumno) {
  const resumen = await calcularDocumentosRequeridos(alumno);
  const pendientes = (resumen.documentos || []).filter((d) => !d.subido);
  return {
    ok: pendientes.length === 0,
    pendientes,
    tiposCapacitacion: resumen.tiposCapacitacion,
    sinMatriculas: resumen.sinMatriculas,
  };
}

function mensajeDocumentosPendientes(pendientes, contexto) {
  const nombres = pendientes.map((p) => p.nombre).join(', ');
  if (contexto === 'matricula') {
    return `No se puede matricular: faltan documentos obligatorios (${nombres}). Cárguelos en la pestaña Documentos.`;
  }
  return `No se puede certificar: faltan documentos obligatorios (${nombres}). Cárguelos en la pestaña Documentos.`;
}

function patchDocsAlumno(alumno, idDoc, urlPath, config) {
  const map = docsAlumnoMap(alumno);
  map[String(idDoc)] = urlPath;
  const dto = { docsAlumno: map };
  const tipo = (config.tiposDocumento || []).find((t) => t.id === String(idDoc));
  if (tipo?.codigo === 'CEDULA') dto.urlCedula = urlPath;
  if (tipo?.codigo === 'LICENCIA') dto.urlLicencia = urlPath;
  return dto;
}

module.exports = {
  calcularDocumentosRequeridos,
  validarDocumentosParaPrograma,
  validarDocumentosPendientesAlumno,
  mensajeDocumentosPendientes,
  patchDocsAlumno,
  urlDocumentoAlumno,
  matchIdTipCap,
  matchIdTipCapAsync,
  tipoDocumentoPorCodigo,
  buscarPrograma,
};
