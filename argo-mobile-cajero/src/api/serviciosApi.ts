import { apiFetch } from './client';
import type { ServicioItem } from './domain';

export async function listarServicios(opts?: {
  q?: string;
  sinPrograma?: boolean;
  catalogo?: boolean;
}): Promise<ServicioItem[]> {
  const q = new URLSearchParams();
  if (opts?.q?.trim()) q.set('q', opts.q.trim());
  if (opts?.sinPrograma) q.set('sinPrograma', 'true');
  if (opts?.catalogo) q.set('catalogo', '1');
  const qs = q.toString();
  return apiFetch<ServicioItem[]>(`/servicios?${qs}`);
}
