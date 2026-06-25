import { apiFetch } from './client';

export interface ClienteItem {
  _id: string;
  razonSocial?: string;
  nombreComercial?: string;
  nombres?: string;
  identificacion?: string;
}

export async function buscarClientes(q: string): Promise<ClienteItem[]> {
  const term = q.trim();
  if (!term) return [];
  return apiFetch<ClienteItem[]>(`/clientes?q=${encodeURIComponent(term)}`);
}

export function labelCliente(c: ClienteItem): string {
  return (
    c.razonSocial?.trim() ||
    c.nombreComercial?.trim() ||
    c.nombres?.trim() ||
    c.identificacion ||
    'Cliente'
  );
}
