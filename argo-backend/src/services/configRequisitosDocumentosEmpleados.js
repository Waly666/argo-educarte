const Config = require('../models/Config');
const Cargo = require('../models/Cargo');
const { models } = require('../models/catalogos');
const { ensureConfigDocument } = require('./configEnsure');

const CLAVE = 'requisitosDocumentosEmpleados';
const DEFAULT_DIAS_AVISO = 30;
const itemDocModel = models.itemDocumentosInstructores;

function slugCodigo(nombre, id) {
  const n = String(nombre || '').trim().toUpperCase();
  if (/CEDULA|CÉDULA/.test(n)) return 'CEDULA';
  if (/CONDUCC/.test(n)) return 'LIC_COND';
  if (/INSTRUCTOR/.test(n)) return 'LIC_INSTR';
  return `DOC_${id}`;
}

function nextId(list) {
  let max = 0;
  for (const t of list || []) {
    const n = parseInt(String(t.id), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return String(max + 1);
}

function normBool(v) {
  if (v === true || v === 1 || v === '1' || v === 'true' || v === 'si' || v === 'Sí') return true;
  if (v === false || v === 0 || v === '0' || v === 'false' || v === 'no' || v === 'No') return false;
  return null;
}

function inferirControlaVencimiento(_codigo, nombre) {
  const t = String(nombre || '').toUpperCase();
  if (/CEDULA|CÉDULA/.test(t)) return false;
  return true;
}

function normalizeDiasAviso(v, fallback = DEFAULT_DIAS_AVISO) {
  const n = parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 365);
}

function normalizeTiposDocumento(raw) {
  const src = Array.isArray(raw) ? raw : [];
  const out = [];
  const usedIds = new Set();
  for (const t of src) {
    let id = String(t.id ?? '').trim();
    if (!id || usedIds.has(id)) id = nextId(out);
    usedIds.add(id);
    const codigo = String(t.codigo || slugCodigo(t.nombre, id))
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^\w]/g, '_')
      .slice(0, 40);
    out.push({
      id,
      codigo: codigo || slugCodigo(t.nombre, id),
      nombre: String(t.nombre || '').trim() || `Documento ${id}`,
      descripcion: String(t.descripcion || '').trim(),
      activo: t.activo !== false,
      controlaVencimiento:
        normBool(t.controlaVencimiento) ?? inferirControlaVencimiento(codigo || slugCodigo(t.nombre, id), t.nombre),
      diasAvisoVencimiento:
        t.diasAvisoVencimiento != null && String(t.diasAvisoVencimiento).trim() !== ''
          ? normalizeDiasAviso(t.diasAvisoVencimiento, null)
          : null,
    });
  }
  return out;
}

function normalizeRequisitosPorCargo(raw, tiposDocumento) {
  const validDocIds = new Set(tiposDocumento.map((t) => t.id));
  const src = Array.isArray(raw) ? raw : [];
  return src
    .map((r) => ({
      idCargo: String(r.idCargo ?? '').trim(),
      idDocumentos: [...new Set((r.idDocumentos || []).map((d) => String(d).trim()))].filter((d) =>
        validDocIds.has(d),
      ),
    }))
    .filter((r) => r.idCargo);
}

async function tiposDesdeCatalogo() {
  const rows = await itemDocModel.find({}).sort({ idDocInst: 1 }).lean();
  return rows
    .filter((r) => r.idDocInst != null && r.idDocInst !== '')
    .map((r) => {
      const codigo = slugCodigo(r.documentoInst, r.idDocInst);
      const nombre = String(r.documentoInst || '').trim() || `Documento ${r.idDocInst}`;
      return {
        id: String(r.idDocInst),
        codigo,
        nombre,
        descripcion: String(r.descripcionDocInst || '').trim(),
        activo: true,
        controlaVencimiento:
          normBool(r.controlaVencimiento) ?? inferirControlaVencimiento(codigo, nombre),
        diasAvisoVencimiento: null,
      };
    });
}

function mergeTiposConCatalogo(tiposConfig, tiposCatalogo) {
  const catalogoById = new Map((tiposCatalogo || []).map((t) => [t.id, t]));
  const vistos = new Set();
  const out = [];

  for (const t of tiposConfig || []) {
    const cat = catalogoById.get(t.id);
    vistos.add(t.id);
    out.push({
      ...(cat || {}),
      ...t,
      id: t.id,
      codigo: t.codigo || cat?.codigo || slugCodigo(t.nombre, t.id),
      nombre: cat?.nombre || t.nombre,
      descripcion: cat?.descripcion ?? t.descripcion ?? '',
      controlaVencimiento:
        normBool(t.controlaVencimiento) ??
        normBool(cat?.controlaVencimiento) ??
        inferirControlaVencimiento(t.codigo, t.nombre),
      diasAvisoVencimiento: t.diasAvisoVencimiento ?? cat?.diasAvisoVencimiento ?? null,
      activo: t.activo !== false,
    });
  }

  for (const cat of tiposCatalogo || []) {
    if (vistos.has(cat.id)) continue;
    out.push(cat);
  }

  return out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

async function syncControlaVencimientoEnCatalogo(tiposDocumento) {
  for (const t of tiposDocumento || []) {
    const id = String(t.id ?? '').trim();
    if (!id) continue;
    await itemDocModel.updateOne(
      { idDocInst: id },
      { $set: { controlaVencimiento: t.controlaVencimiento !== false } },
    );
  }
}

async function syncControlaVencimientoDesdeCatalogo(idDocInst, controlaVencimiento) {
  const id = String(idDocInst ?? '').trim();
  if (!id) return;
  const found = await Config.findOne({ clave: CLAVE }).lean();
  if (!found) return;
  const tipos = normalizeTiposDocumento(found.tiposDocumento);
  const idx = tipos.findIndex((t) => t.id === id);
  if (idx < 0) return;
  tipos[idx] = { ...tipos[idx], controlaVencimiento: controlaVencimiento !== false };
  await Config.updateOne({ clave: CLAVE }, { $set: { tiposDocumento: tipos } });
}

async function buildDefaultRequisitosPorCargo(tiposDocumento) {
  const cargos = await Cargo.find({}).sort({ idCargo: 1 }).lean();
  const allIds = tiposDocumento.map((t) => t.id);
  return cargos
    .map((c) => ({
      idCargo: String(c.idCargo ?? '').trim(),
      idDocumentos: [...allIds],
    }))
    .filter((r) => r.idCargo);
}

async function obtenerConfigRequisitosDocumentosEmpleados() {
  const tiposCatalogo = await tiposDesdeCatalogo();
  let found = await Config.findOne({ clave: CLAVE }).lean();

  if (!found) {
    const tiposDocumento = tiposCatalogo.length ? tiposCatalogo : [];
    const requisitosPorCargo = tiposDocumento.length ? await buildDefaultRequisitosPorCargo(tiposDocumento) : [];
    found = await ensureConfigDocument(CLAVE, {
      tiposDocumento,
      requisitosPorCargo,
      diasAvisoVencimiento: DEFAULT_DIAS_AVISO,
    });
  }

  let tiposDocumento = normalizeTiposDocumento(found.tiposDocumento);
  if (!tiposDocumento.length && tiposCatalogo.length) {
    tiposDocumento = tiposCatalogo;
  } else if (tiposCatalogo.length) {
    tiposDocumento = mergeTiposConCatalogo(tiposDocumento, tiposCatalogo);
  }

  let requisitosPorCargo = normalizeRequisitosPorCargo(found.requisitosPorCargo, tiposDocumento);
  if (!requisitosPorCargo.length && tiposDocumento.length) {
    requisitosPorCargo = await buildDefaultRequisitosPorCargo(tiposDocumento);
  }

  return {
    clave: CLAVE,
    tiposDocumento,
    requisitosPorCargo,
    diasAvisoVencimiento: normalizeDiasAviso(found.diasAvisoVencimiento, DEFAULT_DIAS_AVISO),
  };
}

async function guardarConfigRequisitosDocumentosEmpleados(body) {
  const tiposDocumento = normalizeTiposDocumento(body?.tiposDocumento);
  const requisitosPorCargo = normalizeRequisitosPorCargo(body?.requisitosPorCargo, tiposDocumento);
  const diasAvisoVencimiento = normalizeDiasAviso(body?.diasAvisoVencimiento, DEFAULT_DIAS_AVISO);
  const dto = { clave: CLAVE, tiposDocumento, requisitosPorCargo, diasAvisoVencimiento };
  const updated = await Config.findOneAndUpdate({ clave: CLAVE }, dto, { new: true, upsert: true }).lean();
  await syncControlaVencimientoEnCatalogo(tiposDocumento);
  return {
    clave: CLAVE,
    tiposDocumento: normalizeTiposDocumento(updated.tiposDocumento),
    requisitosPorCargo: normalizeRequisitosPorCargo(updated.requisitosPorCargo, tiposDocumento),
    diasAvisoVencimiento: normalizeDiasAviso(updated.diasAvisoVencimiento, DEFAULT_DIAS_AVISO),
  };
}

function findRequisitoPorCargo(config, idCargoRaw) {
  const idCargo = String(idCargoRaw ?? '').trim();
  if (!idCargo) return null;
  const num = Number(idCargo);
  return (
    (config.requisitosPorCargo || []).find((r) => {
      const rid = String(r.idCargo ?? '').trim();
      if (rid === idCargo) return true;
      return Number.isFinite(num) && Number(rid) === num;
    }) || null
  );
}

function tipoDocumentoPorId(config, id) {
  return (config.tiposDocumento || []).find((t) => t.id === String(id) && t.activo !== false);
}

function documentosRequeridosPorCargo(config, cargoId) {
  const req = findRequisitoPorCargo(config, cargoId);
  return (req?.idDocumentos || [])
    .map((id) => tipoDocumentoPorId(config, id))
    .filter(Boolean)
    .map((t) => ({ id: t.id, codigo: t.codigo, nombre: t.nombre }));
}

function diasAvisoParaTipo(config, tipoMeta) {
  const perTipo = tipoMeta?.diasAvisoVencimiento;
  if (perTipo != null && Number(perTipo) > 0) return normalizeDiasAviso(perTipo, null);
  return normalizeDiasAviso(config?.diasAvisoVencimiento, DEFAULT_DIAS_AVISO);
}

module.exports = {
  CLAVE,
  DEFAULT_DIAS_AVISO,
  obtenerConfigRequisitosDocumentosEmpleados,
  guardarConfigRequisitosDocumentosEmpleados,
  normalizeTiposDocumento,
  normalizeRequisitosPorCargo,
  findRequisitoPorCargo,
  tipoDocumentoPorId,
  documentosRequeridosPorCargo,
  tiposDesdeCatalogo,
  buildDefaultRequisitosPorCargo,
  mergeTiposConCatalogo,
  syncControlaVencimientoDesdeCatalogo,
  diasAvisoParaTipo,
};
