/** Utilidades calendario ARGO — siempre fecha calendario local (sin UTC). */

export type ArgoDateView = 'day' | 'month' | 'year';

export const MESES_CORTO = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
] as const;

export const MESES_LARGO = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

export const DIAS_CORTO = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'] as const;

export const YEARS_PER_PAGE = 12;
export const YEAR_GRID_COLS = 4;

export function ymdToday(): string {
  return ymdFromParts(new Date());
}

export function ymdFromParts(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseYmd(s: string | null | undefined): Date | null {
  if (s == null || s === '') return null;
  const t = String(s).trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(+iso[1], +iso[2] - 1, +iso[3]);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const lat = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (lat) {
    const d = new Date(+lat[3], +lat[2] - 1, +lat[1]);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatYmdDisplay(ymd: string | null | undefined): string {
  const d = parseYmd(ymd);
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${m}/${d.getFullYear()}`;
}

export function yearPageStart(year: number): number {
  return Math.floor(year / YEARS_PER_PAGE) * YEARS_PER_PAGE;
}

export function yearsOnPage(start: number): number[] {
  return Array.from({ length: YEARS_PER_PAGE }, (_, i) => start + i);
}

/** Celdas del mes: null = vacío, number = día del mes. */
export function buildMonthGrid(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

export function compareYmd(a: string, b: string): number {
  return a.localeCompare(b);
}

export function isYmdInRange(ymd: string, min?: string | null, max?: string | null): boolean {
  if (min && compareYmd(ymd, min) < 0) return false;
  if (max && compareYmd(ymd, max) > 0) return false;
  return true;
}
