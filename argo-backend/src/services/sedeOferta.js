const Sede = require('../models/Sede');
const { models: cat } = require('../models/catalogos');
const { resolverIdTipCapCanonico, cargarIndiceTipCap } = require('./tipoCapacitacionMatch');

const MODOS = ['todos', 'tipos', 'especificos'];

function normalizarModo(v) {
  const m = String(v || 'todos').trim().toLowerCase();
  return MODOS.includes(m) ? m : 'todos';
}

function defaultsOferta() {
  return {
    programasMode: 'todos',
    programasTiposPermitidos: [],
    programasIdsPermitidos: [],
    serviciosMode: 'todos',
    serviciosTiposPermitidos: [],
    serviciosIdsPermitidos: [],
  };
}

function parseNumArray(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
}

function parseStrArray(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((x) => String(x ?? '').trim()).filter(Boolean))];
}

function aplicarPayloadOferta(body, target = {}) {
  if (body.programasMode != null) target.programasMode = normalizarModo(body.programasMode);
  if (body.programasTiposPermitidos != null) {
    target.programasTiposPermitidos = parseStrArray(body.programasTiposPermitidos);
  }
  if (body.programasIdsPermitidos != null) {
    target.programasIdsPermitidos = parseNumArray(body.programasIdsPermitidos);
  }
  if (body.serviciosMode != null) target.serviciosMode = normalizarModo(body.serviciosMode);
  if (body.serviciosTiposPermitidos != null) {
    target.serviciosTiposPermitidos = parseStrArray(body.serviciosTiposPermitidos).map((s) =>
      s.toUpperCase(),
    );
  }
  if (body.serviciosIdsPermitidos != null) {
    target.serviciosIdsPermitidos = parseNumArray(body.serviciosIdsPermitidos);
  }
  return target;
}

function mapOfertaFromDoc(s) {
  if (!s) return defaultsOferta();
  return {
    programasMode: normalizarModo(s.programasMode),
    programasTiposPermitidos: parseStrArray(s.programasTiposPermitidos),
    programasIdsPermitidos: parseNumArray(s.programasIdsPermitidos),
    serviciosMode: normalizarModo(s.serviciosMode),
    serviciosTiposPermitidos: parseStrArray(s.serviciosTiposPermitidos).map((x) => x.toUpperCase()),
    serviciosIdsPermitidos: parseNumArray(s.serviciosIdsPermitidos),
  };
}

async function obtenerConfigOfertaSede(idSede) {
  if (!idSede) return defaultsOferta();
  const s = await Sede.findOne({ idSede: String(idSede).trim(), activa: true }).lean();
  return mapOfertaFromDoc(s);
}

async function programaPermitidoEnSede(prog, config, indice) {
  if (!config || config.programasMode === 'todos') return true;
  const idProg = Number(prog.idPrograma);
  if (config.programasMode === 'especificos') {
    return config.programasIdsPermitidos.includes(idProg);
  }
  if (config.programasMode === 'tipos') {
    const idx = indice || (await cargarIndiceTipCap());
    const canon = resolverIdTipCapCanonico(prog.idTipCap, idx);
    return config.programasTiposPermitidos.some((t) => {
      const tc = resolverIdTipCapCanonico(t, idx);
      return tc && tc === canon;
    });
  }
  return true;
}

async function idsProgramasPermitidos(config) {
  if (config.programasMode === 'todos') return null;
  if (config.programasMode === 'especificos') {
    return new Set(config.programasIdsPermitidos);
  }
  const indice = await cargarIndiceTipCap();
  const tiposSet = new Set(
    config.programasTiposPermitidos
      .map((t) => resolverIdTipCapCanonico(t, indice))
      .filter(Boolean),
  );
  const rows = await cat.programas.find({}).lean();
  const ids = new Set();
  for (const p of rows) {
    const c = resolverIdTipCapCanonico(p.idTipCap, indice);
    if (tiposSet.has(c)) ids.add(Number(p.idPrograma));
  }
  return ids;
}

async function filtrarProgramas(rows, idSede) {
  const config = await obtenerConfigOfertaSede(idSede);
  if (config.programasMode === 'todos') return rows;
  const indice = await cargarIndiceTipCap();
  const out = [];
  for (const p of rows) {
    if (await programaPermitidoEnSede(p, config, indice)) out.push(p);
  }
  return out;
}

async function filtrarServicios(rows, idSede) {
  const config = await obtenerConfigOfertaSede(idSede);
  const progPermitidos = await idsProgramasPermitidos(config);
  const out = [];

  for (const s of rows) {
    const idProg = s.idProg != null && s.idProg !== '' ? Number(s.idProg) : null;
    if (idProg != null && progPermitidos != null && !progPermitidos.has(idProg)) continue;

    if (config.serviciosMode === 'todos') {
      out.push(s);
      continue;
    }

    const idServ = Number(s.idServ);
    const tipo = String(s.tipoServ || '').trim().toUpperCase();
    if (config.serviciosMode === 'especificos') {
      if (config.serviciosIdsPermitidos.includes(idServ)) out.push(s);
    } else if (config.serviciosMode === 'tipos') {
      if (config.serviciosTiposPermitidos.includes(tipo)) out.push(s);
    }
  }
  return out;
}

module.exports = {
  MODOS,
  normalizarModo,
  defaultsOferta,
  aplicarPayloadOferta,
  mapOfertaFromDoc,
  obtenerConfigOfertaSede,
  filtrarProgramas,
  filtrarServicios,
};
