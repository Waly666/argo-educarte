import { apiFetch } from './client';
import type { CertificadoItem, CertificadoListadoRes } from './domain';
import { formatNumDoc } from '../utils/format';

export async function listarCertificadosAlumno(numDoc: string | number): Promise<CertificadoItem[]> {
  return apiFetch<CertificadoItem[]>(
    `/certificados/alumno/${encodeURIComponent(formatNumDoc(numDoc))}`,
  );
}

export async function listarCertificadosGlobal(opts?: {
  q?: string;
  tipoFormatoCert?: string;
  desde?: string;
  hasta?: string;
  limit?: number;
}): Promise<CertificadoListadoRes> {
  const q = new URLSearchParams();
  if (opts?.q?.trim()) q.set('q', opts.q.trim());
  if (opts?.tipoFormatoCert) q.set('tipoFormatoCert', opts.tipoFormatoCert);
  if (opts?.desde) q.set('desde', opts.desde);
  if (opts?.hasta) q.set('hasta', opts.hasta);
  if (opts?.limit != null) q.set('limit', String(opts.limit));
  q.set('_', String(Date.now()));
  const qs = q.toString();
  return apiFetch<CertificadoListadoRes>(`/certificados/listado?${qs}`);
}

export function certificadoHtmlPath(id: string): string {
  return `/certificados/${encodeURIComponent(id)}/html?v=${Date.now()}`;
}
