import { OrientacionCertificado } from '../constants/tipos-certificado';

function parsePt(fsStr?: string | null): number | null {
  const m = String(fsStr ?? '').match(/(\d+(?:\.\d+)?)\s*(pt|mm|px)?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] || 'pt').toLowerCase();
  if (unit === 'mm') return (n * 72) / 25.4;
  if (unit === 'px') return (n * 72) / 96;
  return n;
}

function pageHeightMm(orientacion: OrientacionCertificado): number {
  return orientacion === 'horizontal' ? 210 : 297;
}

/** Tamaño en el editor: % del alto de la miniatura (igual proporción que al imprimir). */
export function fsToEditorFontSize(
  fsStr: string | undefined | null,
  orientacion: OrientacionCertificado,
): string {
  const pt = parsePt(fsStr);
  if (pt == null) return fsStr || '12pt';
  const hmm = pageHeightMm(orientacion);
  const mm = (pt * 25.4) / 72;
  const cqh = (mm / hmm) * 100;
  return `${cqh.toFixed(3)}cqh`;
}
