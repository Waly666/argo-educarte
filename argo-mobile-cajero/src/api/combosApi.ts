import { apiFetch } from './client';

export interface ComboItem {
  id: string;
  nombre: string;
  descripcion?: string;
  programas: string[];
  activo: boolean;
}

export interface ComboPrevista {
  id: string;
  nombre: string;
  descripcion?: string;
  tarifa: number;
  totalValor: number;
  programas: { idPrograma: string; nombreProg: string; valor: number }[];
}

export interface ComboAplicarRes {
  ok: boolean;
  message: string;
  combo: { id: string; nombre: string };
  numDoc: number;
  nombreAlumno: string;
  totalValor: number;
  resultados: { idPrograma: string; nombreProg: string; valor: number }[];
  errores: { idPrograma: string; nombreProg: string; error: string }[];
}

export async function listarCombos(): Promise<ComboItem[]> {
  return apiFetch<ComboItem[]>('/combos');
}

export async function previstaCombo(id: string): Promise<ComboPrevista> {
  return apiFetch<ComboPrevista>(`/combos/${encodeURIComponent(id)}/prevista`);
}

export async function aplicarCombo(id: string, numDoc: string | number): Promise<ComboAplicarRes> {
  return apiFetch<ComboAplicarRes>(`/combos/${encodeURIComponent(id)}/aplicar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numDoc: String(numDoc) }),
  });
}
