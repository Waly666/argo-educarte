import { apiFetch } from './client';
import type { ProgramaItem } from './domain';

export async function listarProgramas(opts?: { q?: string; catalogo?: boolean }): Promise<ProgramaItem[]> {
  const q = new URLSearchParams();
  if (opts?.q?.trim()) q.set('q', opts.q.trim());
  if (opts?.catalogo) q.set('catalogo', '1');
  q.set('activos', 'true');
  const qs = q.toString();
  return apiFetch<ProgramaItem[]>(`/programas?${qs}`);
}

export async function obtenerPrograma(id: string | number): Promise<{
  programa: ProgramaItem;
  servicios?: unknown[];
}> {
  return apiFetch(`/programas/${encodeURIComponent(String(id))}`);
}
