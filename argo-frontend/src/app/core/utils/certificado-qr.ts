import { OrientacionCertificado } from '../constants/tipos-certificado';

export const QR_SIZE_PCT_MIN = 5;
export const QR_SIZE_PCT_MAX = 22;
export const QR_DEFAULT_SIZE_PCT = 9.5;

function pageWidthMm(orientacion: OrientacionCertificado): number {
  return orientacion === 'horizontal' ? 297 : 210;
}

function pageWidthPxAt96Dpi(orientacion: OrientacionCertificado): number {
  return (pageWidthMm(orientacion) / 25.4) * 96;
}

export function clampQrSizePct(v: unknown): number {
  const n = parseFloat(String(v ?? ''));
  if (!Number.isFinite(n)) return QR_DEFAULT_SIZE_PCT;
  return Math.min(QR_SIZE_PCT_MAX, Math.max(QR_SIZE_PCT_MIN, Math.round(n * 100) / 100));
}

export function sizePxLegacyToPct(sizePx: number, orientacion: OrientacionCertificado): number {
  const px = parseInt(String(sizePx), 10);
  if (!Number.isFinite(px) || px <= 0) return QR_DEFAULT_SIZE_PCT;
  const physicalPct = (px / pageWidthPxAt96Dpi(orientacion)) * 100;
  if (px <= 85) return clampQrSizePct(physicalPct);
  return clampQrSizePct((px / 380) * 100);
}

export function qrSizePctToMm(sizePct: number, orientacion: OrientacionCertificado): number {
  return (clampQrSizePct(sizePct) / 100) * pageWidthMm(orientacion);
}

/** Ancho en el editor: % del ancho de la miniatura (misma unidad que al imprimir). */
export function qrSizeToEditorWidth(sizePct: number): string {
  return `${clampQrSizePct(sizePct).toFixed(3)}cqw`;
}

export function resolveQrSizePct(
  raw: { sizePct?: number; sizePx?: number } | undefined,
  orientacion: OrientacionCertificado,
  globalPct?: number | null,
  globalPx?: number | null,
): number {
  if (raw?.sizePct != null && String(raw.sizePct).trim() !== '') {
    return clampQrSizePct(raw.sizePct);
  }
  if (raw?.sizePx != null) return sizePxLegacyToPct(raw.sizePx, orientacion);
  if (globalPct != null && String(globalPct).trim() !== '') return clampQrSizePct(globalPct);
  if (globalPx != null) return sizePxLegacyToPct(globalPx, orientacion);
  return QR_DEFAULT_SIZE_PCT;
}
