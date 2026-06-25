import { apiFetch } from './client';
import type {
  FacturacionResumen,
  FacturaElectronicaItem,
  FacturasListResponse,
  LiquidacionElegibleFe,
} from './domain';
import { formatNumDoc } from '../utils/format';

export async function fetchFacturacionResumen(): Promise<FacturacionResumen> {
  return apiFetch<FacturacionResumen>('/facturacion/resumen');
}

export async function listarFacturas(opts?: { q?: string; limit?: number }): Promise<FacturasListResponse> {
  const q = new URLSearchParams();
  if (opts?.q?.trim()) q.set('q', opts.q.trim());
  q.set('limit', String(opts?.limit ?? 30));
  const qs = q.toString();
  return apiFetch<FacturasListResponse>(`/facturacion?${qs}`);
}

export async function listarFacturasAlumno(numDoc: string | number): Promise<FacturaElectronicaItem[]> {
  return apiFetch<FacturaElectronicaItem[]>(
    `/facturacion/alumno/${encodeURIComponent(formatNumDoc(numDoc))}`,
  );
}

export async function listarElegiblesFe(numDoc: string | number): Promise<LiquidacionElegibleFe[]> {
  return apiFetch<LiquidacionElegibleFe[]>(
    `/facturacion/elegibles/${encodeURIComponent(formatNumDoc(numDoc))}`,
  );
}

export function facturaHtmlPath(id: string): string {
  return `/facturacion/${encodeURIComponent(id)}/html?v=${Date.now()}`;
}

export async function emitirFactura(body: {
  numDoc: string | number;
  idLiquidaciones: string[];
  tipoAdquirente?: 'alumno' | 'cliente';
}): Promise<FacturaElectronicaItem> {
  return apiFetch<FacturaElectronicaItem>('/facturacion/emitir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, numDoc: formatNumDoc(body.numDoc), tipoAdquirente: 'alumno' }),
  });
}
