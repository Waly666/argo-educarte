/** Tipos de certificado / plantilla según capacitación */
const TIPOS = {
  CURSO: 'curso',
  TECNICO: 'tecnico',
  COMPETENCIAS: 'competencias',
  DIPLOMADO: 'diplomado',
  LICENCIA: 'licencia',
  MERCANCIAS: 'mercancias_peligrosas',
  JORNADA_CAPACITACION: 'jornada_capacitacion',
};

const TIPOS_VALIDOS = Object.values(TIPOS);

const TIPOS_LABEL = {
  [TIPOS.CURSO]: 'Cursos',
  [TIPOS.TECNICO]: 'Técnico',
  [TIPOS.COMPETENCIAS]: 'Capacitación por competencias',
  [TIPOS.DIPLOMADO]: 'Diplomados',
  [TIPOS.LICENCIA]: 'Certificación licencia',
  [TIPOS.MERCANCIAS]: 'Mercancías peligrosas',
  [TIPOS.JORNADA_CAPACITACION]: 'Jornada Capacitacion',
};

const ORIENTACIONES = ['vertical', 'horizontal'];

const RE_MP =
  /mercanc[ií]as\s*peligrosas|peligrosas\s*clase|transporte\s*de\s*mercanc/i;

const RE_JORNADA_CAP =
  /jornadas?\s*de\s*capacitaci[oó]n|cap\s*jornada\s*capacitacion|jornada\s*capacitacion/i;

function esCapJornadaCapacitacion(text) {
  const t = norm(text);
  if (!t) return false;
  return RE_JORNADA_CAP.test(t) || (t.includes('jornada') && t.includes('capacitacion'));
}

function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

function normalizarTipoCertificado(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (TIPOS_VALIDOS.includes(s)) return s;
  const n = norm(s.replace(/_/g, ' '));
  if (esCapJornadaCapacitacion(n)) return TIPOS.JORNADA_CAPACITACION;
  if (n.includes('competenc')) return TIPOS.COMPETENCIAS;
  if (n.includes('diplomado')) return TIPOS.DIPLOMADO;
  if (n.includes('tecnico')) return TIPOS.TECNICO;
  if (n.includes('licencia') || n.includes('conduccion')) return TIPOS.LICENCIA;
  if (n.includes('mercanc')) return TIPOS.MERCANCIAS;
  if (n.includes('curso')) return TIPOS.CURSO;
  return null;
}

function slotVacio() {
  return { orientacion: 'vertical', id: null };
}

/** Un formato por tipo: orientación elegida + id plantilla */
function normalizePlantillaPorTipo(raw) {
  const out = {};
  for (const t of TIPOS_VALIDOS) out[t] = slotVacio();
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) {
    if (!TIPOS_VALIDOS.includes(k)) continue;
    if (v == null || typeof v === 'string') {
      out[k] = { orientacion: 'vertical', id: v || null };
      continue;
    }
    if (typeof v !== 'object') continue;
    // Legado: { vertical, horizontal }
    if ('vertical' in v || 'horizontal' in v) {
      if (v.vertical) out[k] = { orientacion: 'vertical', id: v.vertical };
      else if (v.horizontal) out[k] = { orientacion: 'horizontal', id: v.horizontal };
      continue;
    }
    const id = v.id || v.plantillaId || null;
    const orientacion = v.orientacion === 'horizontal' ? 'horizontal' : 'vertical';
    out[k] = { orientacion, id: id || null };
  }
  return out;
}

function tipoDesdeTexto(text) {
  const t = norm(text);
  if (!t) return null;
  if (esCapJornadaCapacitacion(t)) return TIPOS.JORNADA_CAPACITACION;
  if (t.includes('competenc')) return TIPOS.COMPETENCIAS;
  if (t.includes('diplomado')) return TIPOS.DIPLOMADO;
  if (t.includes('tecnico')) return TIPOS.TECNICO;
  if (t.includes('licencia') || t.includes('conduccion')) return TIPOS.LICENCIA;
  if (t.includes('mercanc')) return TIPOS.MERCANCIAS;
  if (t.includes('curso')) return TIPOS.CURSO;
  return null;
}

async function etiquetaIdTipCap(idTipCap, catTipoCapModel) {
  if (idTipCap == null || idTipCap === '') return '';
  const s = String(idTipCap).trim();
  if (!/^\d+$/.test(s)) return s;
  if (!catTipoCapModel) return '';
  const n = Number(s);
  const row = await catTipoCapModel
    .findOne({ $or: [{ idTipCap: n }, { idTipCap: s }] })
    .lean();
  return row?.tipoCap || row?.descripcion || row?.nombre || '';
}

function clasificarPrograma(prog) {
  if (!prog) return TIPOS.CURSO;
  const explicito = normalizarTipoCertificado(prog.tipoCertificado);
  if (explicito) return explicito;

  const blob = [prog.nombreProg, prog.nomCert, prog.descripcion, prog.codigoProg].join(' ');
  if (RE_MP.test(blob)) return TIPOS.MERCANCIAS;

  const rawTip = String(prog.idTipCap ?? '').trim();
  if (rawTip && !/^\d+$/.test(rawTip)) {
    if (esCapJornadaCapacitacion(rawTip)) return TIPOS.JORNADA_CAPACITACION;
    const fromRaw = tipoDesdeTexto(rawTip);
    if (fromRaw) return fromRaw;
  }

  return TIPOS.CURSO;
}

async function clasificarProgramaAsync(prog, catTipoCapModel) {
  if (!prog) return TIPOS.CURSO;
  const explicito = normalizarTipoCertificado(prog.tipoCertificado);
  if (explicito) return explicito;

  const blob = [prog.nombreProg, prog.nomCert, prog.descripcion, prog.codigoProg].join(' ');
  if (RE_MP.test(blob)) return TIPOS.MERCANCIAS;

  const tipLabel = await etiquetaIdTipCap(prog.idTipCap, catTipoCapModel);
  if (esCapJornadaCapacitacion(tipLabel)) return TIPOS.JORNADA_CAPACITACION;
  const fromTip = tipoDesdeTexto(tipLabel);
  if (fromTip) return fromTip;

  const rawTip = String(prog.idTipCap ?? '').trim();
  if (rawTip && !/^\d+$/.test(rawTip)) {
    const fromRaw = tipoDesdeTexto(rawTip);
    if (fromRaw) return fromRaw;
  }

  return TIPOS.CURSO;
}

function slotPlantillaPorTipo(config, tipo) {
  const map = normalizePlantillaPorTipo(config.plantillaPorTipo);
  return map[tipo] || slotVacio();
}

function idPlantillaPorTipo(config, tipo) {
  return slotPlantillaPorTipo(config, tipo).id || null;
}

function orientacionPorTipo(config, tipo) {
  const o = slotPlantillaPorTipo(config, tipo).orientacion;
  return o === 'horizontal' ? 'horizontal' : 'vertical';
}

module.exports = {
  TIPOS,
  TIPOS_VALIDOS,
  TIPOS_LABEL,
  ORIENTACIONES,
  esCapJornadaCapacitacion,
  clasificarPrograma,
  clasificarProgramaAsync,
  normalizarTipoCertificado,
  normalizePlantillaPorTipo,
  slotPlantillaPorTipo,
  idPlantillaPorTipo,
  orientacionPorTipo,
  etiquetaIdTipCap,
};
