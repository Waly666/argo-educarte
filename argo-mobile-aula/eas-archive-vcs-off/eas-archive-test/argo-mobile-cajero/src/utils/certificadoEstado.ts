import type { CertificadoItem } from '../api/domain';

export type EstadoCertificadoVigencia = 'vigente' | 'vencido' | 'anulado';

function inicioDia(iso?: string | Date | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

export function esAnuladoCertificado(c: Pick<CertificadoItem, 'estado'>): boolean {
  return String(c.estado || '').trim().toLowerCase() === 'anulado';
}

export function esVencidoCertificado(
  c: Pick<CertificadoItem, 'estado' | 'fechaVencimiento'>,
): boolean {
  if (esAnuladoCertificado(c)) return false;
  if (String(c.estado || '').trim().toLowerCase() === 'vencido') return true;
  const fv = inicioDia(c.fechaVencimiento);
  const hoy = inicioDia(new Date());
  if (!fv || !hoy) return false;
  return fv.getTime() <= hoy.getTime();
}

export function estadoVigenciaCertificado(c: CertificadoItem): EstadoCertificadoVigencia {
  if (esAnuladoCertificado(c)) return 'anulado';
  if (esVencidoCertificado(c)) return 'vencido';
  return 'vigente';
}

export function labelEstadoCertificado(c: CertificadoItem): string {
  const e = estadoVigenciaCertificado(c);
  if (e === 'anulado') return 'Anulado';
  if (e === 'vencido') return 'Vencido';
  return 'Vigente';
}

export function coloresEstadoCertificado(
  c: CertificadoItem,
  cTheme: { ok: string; okBg: string; warn: string; warnBg: string; danger: string; dangerBg: string },
): { color: string; bg: string } {
  const e = estadoVigenciaCertificado(c);
  if (e === 'anulado') return { color: cTheme.danger, bg: cTheme.dangerBg };
  if (e === 'vencido') return { color: cTheme.warn, bg: cTheme.warnBg };
  return { color: cTheme.ok, bg: cTheme.okBg };
}
