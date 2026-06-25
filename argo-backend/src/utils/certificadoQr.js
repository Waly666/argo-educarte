/** Tamaño del QR como porcentaje del ancho de la hoja (WYSIWYG con posiciones en %). */

const QR_SIZE_PCT_MIN = 5;
const QR_SIZE_PCT_MAX = 22;
const QR_DEFAULT_SIZE_PCT = 9.5;

function pageWidthMm(orientacion) {
  return orientacion === 'horizontal' ? 297 : 210;
}

function pageWidthPxAt96Dpi(orientacion) {
  return (pageWidthMm(orientacion) / 25.4) * 96;
}

/** Convierte tamaño legado en px absolutos al % de la hoja. */
function sizePxLegacyToPct(sizePx, orientacion) {
  const px = parseInt(sizePx, 10);
  if (!Number.isFinite(px) || px <= 0) return QR_DEFAULT_SIZE_PCT;
  const physicalPct = (px / pageWidthPxAt96Dpi(orientacion)) * 100;
  // Valores bajos (p. ej. 72 por defecto) eran px de impresión reales.
  if (px <= 85) return clampSizePct(physicalPct);
  // Valores altos: el usuario los subió en el editor desfasado (px/380 como % visual).
  const editorPct = (px / 380) * 100;
  return clampSizePct(editorPct);
}

function clampSizePct(v) {
  const n = parseFloat(String(v ?? ''));
  if (!Number.isFinite(n)) return QR_DEFAULT_SIZE_PCT;
  return Math.min(QR_SIZE_PCT_MAX, Math.max(QR_SIZE_PCT_MIN, Math.round(n * 100) / 100));
}

function resolveSizePct(raw, orientacion, globalConfig) {
  if (raw?.sizePct != null && String(raw.sizePct).trim() !== '') {
    return clampSizePct(raw.sizePct);
  }
  if (globalConfig?.qrTamanoPct != null && String(globalConfig.qrTamanoPct).trim() !== '') {
    if (raw?.sizePx == null && raw?.sizePct == null) {
      return clampSizePct(globalConfig.qrTamanoPct);
    }
  }
  const legacyPx = raw?.sizePx ?? globalConfig?.qrTamanoPx;
  if (legacyPx != null) return sizePxLegacyToPct(legacyPx, orientacion);
  if (globalConfig?.qrTamanoPct != null) return clampSizePct(globalConfig.qrTamanoPct);
  return QR_DEFAULT_SIZE_PCT;
}

function sizePctToMm(sizePct, orientacion) {
  return (clampSizePct(sizePct) / 100) * pageWidthMm(orientacion);
}

/** Píxeles para rasterizar el QR (calidad de escaneo, no tamaño visual). */
function qrRasterPx(sizePct, orientacion) {
  const mm = sizePctToMm(sizePct, orientacion);
  return Math.max(160, Math.min(512, Math.round((mm / 25.4) * 96 * 3)));
}

function qrCssWidth(sizePct, orientacion) {
  const pct = clampSizePct(sizePct);
  const mm = sizePctToMm(pct, orientacion);
  return {
    pct,
    mm: `${mm.toFixed(2)}mm`,
    cqw: `${pct.toFixed(3)}cqw`,
  };
}

module.exports = {
  QR_SIZE_PCT_MIN,
  QR_SIZE_PCT_MAX,
  QR_DEFAULT_SIZE_PCT,
  pageWidthMm,
  pageWidthPxAt96Dpi,
  sizePxLegacyToPct,
  clampSizePct,
  resolveSizePct,
  sizePctToMm,
  qrRasterPx,
  qrCssWidth,
};
