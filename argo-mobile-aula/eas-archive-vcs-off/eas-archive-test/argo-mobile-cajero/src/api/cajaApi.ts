import { apiFetch } from './client';
import type { CajaActivaFull, CierreCajaResponse, CajaSesion } from './domain';

export async function fetchCajaActivaFull(): Promise<CajaActivaFull> {
  return apiFetch<CajaActivaFull>('/caja/sesiones/activa');
}

export async function abrirCaja(body: { saldoInicial: number; observaciones?: string }): Promise<CajaSesion> {
  return apiFetch<CajaSesion>('/caja/sesiones/abrir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function cerrarCaja(
  idSesion: number,
  body: { efectivoContado: number; observaciones?: string },
): Promise<CierreCajaResponse> {
  return apiFetch<CierreCajaResponse>(`/caja/sesiones/${idSesion}/cerrar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchIngresosSesionActiva(): Promise<unknown[]> {
  return apiFetch<unknown[]>('/caja/sesiones/activa/ingresos');
}

export async function fetchEgresosSesionActiva(): Promise<unknown[]> {
  return apiFetch<unknown[]>('/caja/sesiones/activa/egresos');
}
