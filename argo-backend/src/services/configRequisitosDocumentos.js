const Config = require('../models/Config');
const { ensureConfigDocument } = require('./configEnsure');

const CLAVE = 'requisitosDocumentos';

const DEFAULTS = {
  clave: CLAVE,
  tiposDocumento: [
    {
      id: '1',
      codigo: 'CEDULA',
      nombre: 'Cédula de ciudadanía',
      descripcion: 'Documento de identidad (frente y reverso en una imagen vertical).',
      activo: true,
    },
    {
      id: '2',
      codigo: 'LICENCIA',
      nombre: 'Licencia de conducción',
      descripcion: 'Licencia vigente o última expedida.',
      activo: true,
    },
    {
      id: '3',
      codigo: 'DIPLOMA_BACH',
      nombre: 'Diploma de bachiller',
      descripcion: 'Acta o diploma de bachiller académico.',
      activo: true,
    },
  ],
  /** idTipCap (catTipoCapacitacion) → ids de tiposDocumento */
  requisitosPorCap: [
    { idTipCap: '3', idDocumentos: ['1'] },
    { idTipCap: '2', idDocumentos: ['1', '3'] },
    { idTipCap: '1', idDocumentos: ['1', '3'] },
    { idTipCap: '4', idDocumentos: ['1', '2'] },
  ],
};

function nextId(list) {
  let max = 0;
  for (const t of list || []) {
    const n = parseInt(String(t.id), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return String(max + 1);
}

function normalizeTiposDocumento(raw) {
  const src = Array.isArray(raw) && raw.length ? raw : DEFAULTS.tiposDocumento;
  const out = [];
  const usedIds = new Set();
  for (const t of src) {
    let id = String(t.id || '').trim();
    if (!id || usedIds.has(id)) id = nextId(out);
    usedIds.add(id);
    const codigo = String(t.codigo || `DOC_${id}`)
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^\w]/g, '_')
      .slice(0, 40);
    out.push({
      id,
      codigo: codigo || `DOC_${id}`,
      nombre: String(t.nombre || '').trim() || `Documento ${id}`,
      descripcion: String(t.descripcion || '').trim(),
      activo: t.activo !== false,
    });
  }
  return out;
}

function normalizeRequisitosPorCap(raw, tiposDocumento) {
  const validDocIds = new Set(tiposDocumento.map((t) => t.id));
  const src = Array.isArray(raw) ? raw : DEFAULTS.requisitosPorCap;
  return src
    .map((r) => ({
      idTipCap: String(r.idTipCap ?? '').trim(),
      idDocumentos: [...new Set((r.idDocumentos || []).map((d) => String(d).trim()))].filter((d) =>
        validDocIds.has(d),
      ),
    }))
    .filter((r) => r.idTipCap);
}

async function obtenerConfigRequisitosDocumentos() {
  const found = await ensureConfigDocument(CLAVE, DEFAULTS);
  const tiposDocumento = normalizeTiposDocumento(found.tiposDocumento);
  const requisitosPorCap = normalizeRequisitosPorCap(found.requisitosPorCap, tiposDocumento);
  return { clave: CLAVE, tiposDocumento, requisitosPorCap };
}

async function guardarConfigRequisitosDocumentos(body) {
  const tiposDocumento = normalizeTiposDocumento(body?.tiposDocumento);
  const requisitosPorCap = normalizeRequisitosPorCap(body?.requisitosPorCap, tiposDocumento);
  const dto = { clave: CLAVE, tiposDocumento, requisitosPorCap };
  const updated = await Config.findOneAndUpdate({ clave: CLAVE }, dto, { new: true, upsert: true }).lean();
  return {
    clave: CLAVE,
    tiposDocumento: normalizeTiposDocumento(updated.tiposDocumento),
    requisitosPorCap: normalizeRequisitosPorCap(updated.requisitosPorCap, tiposDocumento),
  };
}

function tipoDocumentoPorId(config, id) {
  return (config.tiposDocumento || []).find((t) => t.id === String(id) && t.activo !== false);
}

function tipoDocumentoPorCodigo(config, codigo) {
  const c = String(codigo || '').trim().toUpperCase();
  return (config.tiposDocumento || []).find((t) => t.codigo === c && t.activo !== false);
}

module.exports = {
  CLAVE,
  DEFAULTS,
  obtenerConfigRequisitosDocumentos,
  guardarConfigRequisitosDocumentos,
  normalizeTiposDocumento,
  normalizeRequisitosPorCap,
  tipoDocumentoPorId,
  tipoDocumentoPorCodigo,
};
