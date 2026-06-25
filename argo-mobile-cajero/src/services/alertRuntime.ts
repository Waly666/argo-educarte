import type { ReglaAlerta } from '../api/types';

const FALLBACK: Omit<ReglaAlerta, 'key' | 'label'> = {
  activo: true,
  ventanaInicio: 'desde_registro',
  duracionMinutos: 30,
  intervaloPollSegundos: 60,
};

let mapa = new Map<string, ReglaAlerta>();

export function aplicarReglasAlertas(reglas: ReglaAlerta[]): void {
  mapa = new Map(reglas.map((r) => [r.key, r]));
}

export function regla(key: string): ReglaAlerta {
  const hit = mapa.get(key);
  if (hit) return hit;
  return { key, label: key, ...FALLBACK };
}

export function activaGlobal(key: string): boolean {
  return regla(key).activo !== false;
}

export function duracionMs(key: string): number {
  const m = regla(key).duracionMinutos;
  return m > 0 ? m * 60_000 : 0;
}

export function intervaloPollMs(key: string): number {
  const s = regla(key).intervaloPollSegundos;
  return s > 0 ? s * 1000 : 60_000;
}

export function ventanaInicioDia(key: string): boolean {
  return regla(key).ventanaInicio === 'desde_inicio_dia';
}

export function pollIntervalMs(keys: string[], habilitada: (k: string) => boolean): number {
  let ms = 60_000;
  for (const k of keys) {
    if (habilitada(k)) ms = Math.min(ms, intervaloPollMs(k));
  }
  return ms;
}

export function claveComprobante(tipo: string): string {
  if (tipo === 'ingreso') return 'alarmas.alumnos.comprobante_ingreso';
  if (tipo === 'egreso') return 'alarmas.alumnos.comprobante_egreso';
  return 'alarmas.alumnos.factura';
}
