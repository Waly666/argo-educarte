import { apiFetch } from './client';
import type { LiquidacionConSaldoResumen, LiquidacionItem, LiquidacionResumen } from './domain';
import { formatNumDoc } from '../utils/format';

export async function listarLiquidacionConSaldo(opts?: {
  q?: string;
  skip?: number;
  limit?: number;
}): Promise<LiquidacionConSaldoResumen> {
  const q = new URLSearchParams();
  if (opts?.q?.trim()) q.set('q', opts.q.trim());
  q.set('skip', String(opts?.skip ?? 0));
  q.set('limit', String(opts?.limit ?? 100));
  const qs = q.toString();
  return apiFetch<LiquidacionConSaldoResumen>(`/liquidacion/con-saldo?${qs}`);
}

export async function listarLiquidacionAlumno(numDoc: string | number): Promise<LiquidacionResumen> {
  return apiFetch<LiquidacionResumen>(
    `/liquidacion/alumno/${encodeURIComponent(formatNumDoc(numDoc))}`,
  );
}

export async function crearLiquidacion(body: {
  numDoc: string | number;
  idServ: string;
  descripcion?: string;
  valor?: number;
  cantidad?: number;
}): Promise<LiquidacionItem> {
  return apiFetch<LiquidacionItem>('/liquidacion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, numDoc: formatNumDoc(body.numDoc) }),
  });
}
