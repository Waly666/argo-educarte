/** Convierte tamaño en pt (guardado en config) a unidades que escalan con la hoja del certificado. */

function parsePt(fsStr) {
  const m = String(fsStr ?? '').match(/(\d+(?:\.\d+)?)\s*(pt|mm|px)?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] || 'pt').toLowerCase();
  if (unit === 'mm') return (n * 72) / 25.4;
  if (unit === 'px') return (n * 72) / 96;
  return n;
}

function pageHeightMm(orientacion) {
  return orientacion === 'horizontal' ? 210 : 297;
}

/** Tamaños para impresión: mm (físico) + cqh (% alto del contenedor = misma proporción que % de posición). */
function fsToPrintSizes(fsStr, orientacion) {
  const pt = parsePt(fsStr);
  if (pt == null) return null;
  const hmm = pageHeightMm(orientacion);
  const mm = (pt * 25.4) / 72;
  const cqh = (mm / hmm) * 100;
  return {
    mm: `${mm.toFixed(2)}mm`,
    cqh: `${cqh.toFixed(3)}cqh`,
    pt: `${pt}pt`,
  };
}

function fsToCssFontSize(fsStr, orientacion) {
  const s = fsToPrintSizes(fsStr, orientacion);
  if (!s) return String(fsStr || '').trim() || null;
  return `${s.mm};font-size:${s.cqh}`;
}

module.exports = { parsePt, fsToPrintSizes, fsToCssFontSize, pageHeightMm };
