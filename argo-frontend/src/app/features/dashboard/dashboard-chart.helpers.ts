export const CHART_PALETTE = [
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#10b981',
  '#f97316',
  '#a855f7',
  '#22d3ee',
  '#84cc16',
];

export interface ChartSlice {
  label: string;
  value: number;
  pct: number;
  color: string;
}

export interface DonutSegment {
  d: string;
  color: string;
}

function polar(cx: number, cy: number, r: number, degFromTop: number) {
  const rad = (degFromTop * Math.PI) / 180 - Math.PI / 2;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function ringArc(cx: number, cy: number, ro: number, ri: number, a0: number, a1: number): string {
  if (a1 - a0 >= 359.99) {
    return [
      `M ${cx} ${cy - ro}`,
      `A ${ro} ${ro} 0 1 1 ${cx - 0.01} ${cy - ro}`,
      `M ${cx} ${cy - ri}`,
      `A ${ri} ${ri} 0 1 0 ${cx + 0.01} ${cy - ri}`,
      'Z',
    ].join(' ');
  }
  const p0 = polar(cx, cy, ro, a0);
  const p1 = polar(cx, cy, ro, a1);
  const p2 = polar(cx, cy, ri, a1);
  const p3 = polar(cx, cy, ri, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return [
    `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)}`,
    `A ${ro} ${ro} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `A ${ri} ${ri} 0 ${large} 0 ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

/** Segmentos SVG para gráfico circular con colores visibles. */
export function donutSegmentPaths(
  slices: ChartSlice[],
  size = 140,
  thickness = 30,
): DonutSegment[] {
  if (!slices.length) return [];
  const cx = size / 2;
  const cy = size / 2;
  const ro = size / 2 - 2;
  const ri = Math.max(8, ro - thickness);
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  let angle = 0;
  const out: DonutSegment[] = [];
  for (const s of slices) {
    const sweep = (s.value / total) * 360;
    if (sweep < 0.05) continue;
    const start = angle;
    const end = angle + sweep;
    out.push({ d: ringArc(cx, cy, ro, ri, start, end), color: s.color });
    angle = end;
  }
  return out;
}

export function slicesFromRows<T>(
  rows: T[],
  labelFn: (r: T) => string,
  valueFn: (r: T) => number,
  colors: string[] = CHART_PALETTE,
): ChartSlice[] {
  const total = rows.reduce((a, r) => a + valueFn(r), 0);
  return rows.map((r, i) => {
    const value = valueFn(r);
    const raw = labelFn(r);
    const label =
      typeof raw === 'string' && raw.trim() && raw !== '[object Object]'
        ? raw.trim()
        : 'Sin tipo';
    return {
      label,
      value,
      pct: total ? Math.round((value / total) * 1000) / 10 : 0,
      color: colors[i % colors.length],
    };
  });
}

export function maxEnSerie(values: number[]): number {
  return values.length ? Math.max(...values, 1) : 1;
}

export function colorAt(i: number, colors: string[] = CHART_PALETTE): string {
  return colors[i % colors.length];
}
