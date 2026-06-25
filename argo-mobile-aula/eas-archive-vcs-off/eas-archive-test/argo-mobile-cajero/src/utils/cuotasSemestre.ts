import type { ServicioItem } from '../api/domain';
import { TARIFA_VIRTUAL } from './pago';

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || 0;
  if (typeof v === 'object' && v !== null && '$numberDecimal' in v) {
    return Number((v as { $numberDecimal: string }).$numberDecimal) || 0;
  }
  return Number(v) || 0;
}

/** Entero COP ≥ 0; null si vacío o inválido. */
export function normalizarCuotaEntera(raw: number | string | null | undefined): number | null {
  if (raw === '' || raw === null || raw === undefined) return null;
  const v = Math.round(Number(raw));
  if (!Number.isFinite(v) || v < 0) return null;
  return v;
}

export function cuotasSemestreCatalogo(
  servicios: ServicioItem[],
  tarifa: number,
): number[] {
  return servicios.map((s) => {
    if (tarifa === TARIFA_VIRTUAL) return num(s.tarifaVirtual);
    const key = `tarifa${tarifa}` as keyof ServicioItem;
    const v = s[key];
    if (v != null && v !== '') return num(v);
    return num(s.tarifa1);
  });
}

export function repartirCuotasEquitativo(total: number, n: number): number[] {
  if (!n) return [];
  const base = Math.floor(total / n);
  const arr = Array(n).fill(base);
  let rest = total - base * n;
  for (let i = 0; i < rest; i++) arr[i] += 1;
  return arr;
}

export function resolverCuotasSemestreNumeros(
  vals: (number | null)[],
  esperado: number,
): number[] | null {
  if (vals.length !== esperado) return null;
  const nums: number[] = [];
  for (const v of vals) {
    if (v === null || !Number.isFinite(v) || v < 0) return null;
    nums.push(Math.round(v));
  }
  return nums;
}

export function etiquetaSemestre(servicios: ServicioItem[], index: number): string {
  const serv = servicios[index];
  const descr = String(serv?.descrServicio || serv?.descripcion || '').trim();
  if (descr) return descr;
  return `Semestre ${index + 1}`;
}
