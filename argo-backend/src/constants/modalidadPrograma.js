/** Modalidades de oferta del programa (catálogo modalidades). */
const MODALIDAD_VIRTUAL = 'VIRTUAL';
const MODALIDAD_PRESENCIAL = 'PRESENCIAL';
const MODALIDAD_MIXTA = 'MIXTA';

const MODALIDADES_PROGRAMA = [MODALIDAD_VIRTUAL, MODALIDAD_PRESENCIAL, MODALIDAD_MIXTA];

const ETIQUETAS_MODALIDAD = {
  [MODALIDAD_VIRTUAL]: 'Virtual',
  [MODALIDAD_PRESENCIAL]: 'Presencial',
  [MODALIDAD_MIXTA]: 'Mixta',
};

function normalizarCodigoModalidad(raw) {
  const t = String(raw ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!t) return null;
  if (t === 'VIR' || t.startsWith('VIRTUAL')) return MODALIDAD_VIRTUAL;
  if (t === 'PRE' || t.startsWith('PRESENCIAL')) return MODALIDAD_PRESENCIAL;
  if (t === 'MIX' || t.startsWith('MIXTA')) return MODALIDAD_MIXTA;
  const hit = MODALIDADES_PROGRAMA.find((m) => m === t);
  return hit || null;
}

module.exports = {
  MODALIDAD_VIRTUAL,
  MODALIDAD_PRESENCIAL,
  MODALIDAD_MIXTA,
  MODALIDADES_PROGRAMA,
  ETIQUETAS_MODALIDAD,
  normalizarCodigoModalidad,
};
