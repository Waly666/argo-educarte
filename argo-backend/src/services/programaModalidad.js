const { TARIFA_VIRTUAL, TARIFAS_PRESENCIAL } = require('../constants/tarifa');
const {
  MODALIDAD_VIRTUAL,
  MODALIDAD_PRESENCIAL,
  MODALIDAD_MIXTA,
  MODALIDADES_PROGRAMA,
  ETIQUETAS_MODALIDAD,
  normalizarCodigoModalidad,
} = require('../constants/modalidadPrograma');
const { num } = require('./programaServicio');

const TARIFAS_POR_MODALIDAD = {
  [MODALIDAD_VIRTUAL]: [TARIFA_VIRTUAL],
  [MODALIDAD_PRESENCIAL]: [...TARIFAS_PRESENCIAL],
  [MODALIDAD_MIXTA]: [...TARIFAS_PRESENCIAL],
};

function normalizarModalidadesPrograma(progOrArray) {
  const raw = Array.isArray(progOrArray) ? progOrArray : progOrArray?.modalidades;
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    const code =
      typeof item === 'object'
        ? normalizarCodigoModalidad(item.codigo ?? item.idModalidad ?? item.id ?? item.descripcion)
        : normalizarCodigoModalidad(item);
    if (code && !out.includes(code)) out.push(code);
  }
  return out;
}

function inferirModalidadesLegacy(prog, servicios) {
  const servs = servicios || [];
  const hasVirtual =
    servs.some((s) => num(s.tarifaVirtual) > 0) || num(prog?.tarifaVirtual) > 0;
  const hasPres =
    servs.some(
      (s) => num(s.tarifa1) > 0 || num(s.tarifa2) > 0 || num(s.tarifa3) > 0,
    ) || num(prog?.valorMatricula) > 0;
  const mods = [];
  if (hasPres || !hasVirtual) mods.push(MODALIDAD_PRESENCIAL);
  if (hasVirtual) mods.push(MODALIDAD_VIRTUAL);
  return mods.length ? mods : [MODALIDAD_PRESENCIAL];
}

function modalidadesEfectivas(prog, servicios) {
  const explicit = normalizarModalidadesPrograma(prog);
  if (explicit.length) return explicit;
  return inferirModalidadesLegacy(prog, servicios);
}

function tarifasPermitidasModalidades(modalidades) {
  const set = new Set();
  for (const m of modalidades) {
    const ts = TARIFAS_POR_MODALIDAD[m];
    if (ts) ts.forEach((t) => set.add(t));
  }
  return [...set].sort((a, b) => a - b);
}

function esSoloVirtual(modalidades) {
  return modalidades.length === 1 && modalidades[0] === MODALIDAD_VIRTUAL;
}

function admiteModalidadVirtual(modalidades) {
  return modalidades.includes(MODALIDAD_VIRTUAL);
}

function admiteModalidadPresencial(modalidades) {
  return modalidades.some((m) => m === MODALIDAD_PRESENCIAL || m === MODALIDAD_MIXTA);
}

function resolverModalidadPrograma(prog, serviciosProg) {
  const modalidades = modalidadesEfectivas(prog, serviciosProg);
  const tarifasPermitidas = tarifasPermitidasModalidades(modalidades);
  return {
    modalidades,
    tarifasPermitidas,
    soloVirtual: esSoloVirtual(modalidades),
    admiteVirtual: admiteModalidadVirtual(modalidades),
    admitePresencial: admiteModalidadPresencial(modalidades),
    modalidadLabels: modalidades.map((m) => ETIQUETAS_MODALIDAD[m] || m),
  };
}

function programaAdmiteMatriculaVirtual(prog, serviciosProg) {
  const info = resolverModalidadPrograma(prog, serviciosProg);
  if (!info.admiteVirtual) return false;
  return (serviciosProg || []).some((s) => num(s.tarifaVirtual) > 0);
}

function validarModalidadesParaPrograma(modalidades, body, { esJornada = false } = {}) {
  if (esJornada) return [];
  const mods = normalizarModalidadesPrograma(modalidades);
  if (!mods.length) {
    const err = new Error('Seleccione al menos una modalidad (Virtual, Presencial o Mixta)');
    err.status = 400;
    throw err;
  }
  const invalid = mods.filter((m) => !MODALIDADES_PROGRAMA.includes(m));
  if (invalid.length) {
    const err = new Error(`Modalidades inválidas: ${invalid.join(', ')}`);
    err.status = 400;
    throw err;
  }
  const tarifaVirtual = num(body.tarifaVirtual);
  const tarifa1 = num(body.tarifa1 ?? body.valorMatricula);
  if (admiteModalidadVirtual(mods) && tarifaVirtual <= 0) {
    const err = new Error('Con modalidad Virtual configure tarifa virtual mayor a 0');
    err.status = 400;
    throw err;
  }
  if (admiteModalidadPresencial(mods) && tarifa1 <= 0) {
    const err = new Error('Con modalidad Presencial o Mixta configure tarifa 1 mayor a 0');
    err.status = 400;
    throw err;
  }
  return mods;
}

function valorMatriculaPrograma(prog, serviciosProg, tarifas = {}) {
  const info = resolverModalidadPrograma(prog, serviciosProg);
  if (info.soloVirtual) {
    const totalServ = (serviciosProg || []).reduce((acc, s) => acc + num(s.tarifaVirtual), 0);
    const tv = num(tarifas.tarifaVirtual ?? prog?.tarifaVirtual);
    if (tv > 0) return tv;
    if (totalServ > 0) return totalServ;
    return num(prog?.valorMatricula);
  }
  return num(tarifas.tarifa1 ?? tarifas.valorMatricula ?? prog?.valorMatricula);
}

function enriquecerProgramaModalidad(prog, serviciosProg) {
  const info = resolverModalidadPrograma(prog, serviciosProg);
  const tarifaVirtual = (serviciosProg || []).reduce((m, s) => Math.max(m, num(s.tarifaVirtual)), 0)
    || num(prog?.tarifaVirtual);
  const valorMatricula = valorMatriculaPrograma(prog, serviciosProg, {
    tarifaVirtual: prog?.tarifaVirtual ?? tarifaVirtual,
  });
  return {
    ...prog,
    tarifaVirtual,
    valorMatricula,
    modalidades: info.modalidades,
    tarifasPermitidas: info.tarifasPermitidas,
    soloVirtual: info.soloVirtual,
    admiteVirtual: info.admiteVirtual,
    admitePresencial: info.admitePresencial,
    modalidadLabels: info.modalidadLabels,
    esCapacitacionVirtual: info.admiteVirtual && (serviciosProg || []).some((s) => num(s.tarifaVirtual) > 0),
  };
}

module.exports = {
  MODALIDAD_VIRTUAL,
  MODALIDAD_PRESENCIAL,
  MODALIDAD_MIXTA,
  MODALIDADES_PROGRAMA,
  ETIQUETAS_MODALIDAD,
  normalizarModalidadesPrograma,
  modalidadesEfectivas,
  tarifasPermitidasModalidades,
  esSoloVirtual,
  admiteModalidadVirtual,
  admiteModalidadPresencial,
  resolverModalidadPrograma,
  programaAdmiteMatriculaVirtual,
  validarModalidadesParaPrograma,
  enriquecerProgramaModalidad,
  valorMatriculaPrograma,
};
