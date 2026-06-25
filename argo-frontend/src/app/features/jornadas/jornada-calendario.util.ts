/** Utilidades de calendario para jornadas (mes) y clases (semana por horas). */

export interface CeldaMes {
  fecha: Date | null;
  key: string;
  otroMes: boolean;
}

export interface DiaSemana {
  fecha: Date;
  key: string;
}

export interface LayoutHorario {
  topPct: number;
  heightPct: number;
  sinHorario: boolean;
}

/** Posición horizontal cuando varias clases comparten el mismo horario. */
export interface LayoutHorarioColumnas extends LayoutHorario {
  leftPct: number;
  widthPct: number;
}

const LAYOUT_COL_DEFAULT: Pick<LayoutHorarioColumnas, 'leftPct' | 'widthPct'> = {
  leftPct: 2,
  widthPct: 96,
};

const HORA_INICIO = 6;
const HORA_FIN = 21;
const HORAS_TOTAL = HORA_FIN - HORA_INICIO;

export function ymdLocal(iso?: string | Date | null): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** ¿La fecha cae en el día calendario actual del equipo? */
export function esFechaHoy(iso?: string | Date | null, hoy = ymdLocal(new Date())): boolean {
  const key = ymdCalendario(iso);
  return !!key && key === hoy;
}

/** ¿La fecha es hoy o anterior (no futura)? */
export function esFechaNoFutura(iso?: string | Date | null, hoy = ymdLocal(new Date())): boolean {
  const key = ymdCalendario(iso);
  return !!key && key <= hoy;
}

/** Día civil YYYY-MM-DD sin desfase UTC (fechas de contrato/jornada). */
export function ymdCalendario(iso?: string | Date | null): string {
  if (!iso) return '';
  if (typeof iso === 'string') {
    const t = iso.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  }
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getUTCHours();
  const min = d.getUTCMinutes();
  const sec = d.getUTCSeconds();
  const ms = d.getUTCMilliseconds();
  if ((h === 0 || h === 12) && min === 0 && sec === 0 && ms === 0) {
    return d.toISOString().slice(0, 10);
  }
  return ymdLocal(d);
}

export function fmtFechaCalendario(iso?: string | Date | null): string {
  const ymd = ymdCalendario(iso);
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-');
  return `${Number(d)}/${Number(m)}/${y}`;
}

export function inicioMes(anio: number, mes: number): Date {
  return new Date(anio, mes, 1, 0, 0, 0, 0);
}

export function finMes(anio: number, mes: number): Date {
  return new Date(anio, mes + 1, 0, 23, 59, 59, 999);
}

/** Cuadrícula mensual empezando en lunes (incluye días visibles del mes anterior/siguiente). */
export function celdasMes(anio: number, mes: number): CeldaMes[] {
  const lastDay = new Date(anio, mes + 1, 0).getDate();
  const pad = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const cells: CeldaMes[] = [];

  const prevLast = new Date(anio, mes, 0).getDate();
  for (let i = pad - 1; i >= 0; i--) {
    const fecha = new Date(anio, mes - 1, prevLast - i);
    cells.push({ fecha, key: ymdLocal(fecha), otroMes: true });
  }
  for (let d = 1; d <= lastDay; d++) {
    const fecha = new Date(anio, mes, d);
    cells.push({ fecha, key: ymdLocal(fecha), otroMes: false });
  }
  let next = 1;
  while (cells.length % 7 !== 0) {
    const fecha = new Date(anio, mes + 1, next++);
    cells.push({ fecha, key: ymdLocal(fecha), otroMes: true });
  }
  return cells;
}

/** Rango YYYY-MM-DD que cubre toda la cuadrícula visible del mes. */
export function rangoVisibleMes(anio: number, mes: number): { desde: string; hasta: string } {
  const cells = celdasMes(anio, mes).filter((c) => c.fecha);
  if (!cells.length) {
    return { desde: ymdLocal(inicioMes(anio, mes)), hasta: ymdLocal(finMes(anio, mes)) };
  }
  return { desde: ymdLocal(cells[0].fecha!), hasta: ymdLocal(cells[cells.length - 1].fecha!) };
}

export function agruparPorFecha<T>(items: T[], fn: (item: T) => string | undefined): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = fn(item);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

export function inicioSemana(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

export function finSemana(inicio: Date): Date {
  const d = new Date(inicio);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function diasSemana(inicio: Date): DiaSemana[] {
  const out: DiaSemana[] = [];
  for (let i = 0; i < 7; i++) {
    const fecha = new Date(inicio);
    fecha.setDate(inicio.getDate() + i);
    out.push({ fecha, key: ymdLocal(fecha) });
  }
  return out;
}

export function horasSlots(): number[] {
  const slots: number[] = [];
  for (let h = HORA_INICIO; h < HORA_FIN; h++) slots.push(h);
  return slots;
}

function minutosDesdeMedianoche(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

export function layoutHorarioClase(
  horaInicio?: string | null,
  horaFin?: string | null,
): LayoutHorario {
  const iniMin = minutosDesdeMedianoche(horaInicio);
  if (iniMin == null) {
    return { topPct: 0, heightPct: 0, sinHorario: true };
  }
  const finMin = minutosDesdeMedianoche(horaFin) ?? iniMin + 60;
  const start = HORA_INICIO * 60;
  const end = HORA_FIN * 60;
  const top = Math.max(0, iniMin - start);
  const bottom = Math.min(end - start, Math.max(iniMin + 30, finMin) - start);
  return {
    topPct: (top / (HORAS_TOTAL * 60)) * 100,
    heightPct: Math.max(((bottom - top) / (HORAS_TOTAL * 60)) * 100, 4),
    sinHorario: false,
  };
}

/** Posición en rejilla semanal a partir de horas HH:mm (programación CEA). */
export function layoutHorarioHHmm(horaDesde?: string | null, horaHasta?: string | null): LayoutHorario {
  const parse = (h?: string | null) => parseMinutosHHmm(h);
  const iniMin = parse(horaDesde);
  if (iniMin == null) return { topPct: 0, heightPct: 0, sinHorario: true };
  const finMin = parse(horaHasta) ?? iniMin + 60;
  const start = HORA_INICIO * 60;
  const end = HORA_FIN * 60;
  const top = Math.max(0, iniMin - start);
  const bottom = Math.min(end - start, Math.max(iniMin + 30, finMin) - start);
  return {
    topPct: (top / (HORAS_TOTAL * 60)) * 100,
    heightPct: Math.max(((bottom - top) / (HORAS_TOTAL * 60)) * 100, 4),
    sinHorario: false,
  };
}

export function parseMinutosHHmm(hora?: string | null): number | null {
  const m = String(hora ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function rangoMinutosHHmm(horaDesde?: string | null, horaHasta?: string | null): { start: number; end: number } | null {
  const start = parseMinutosHHmm(horaDesde);
  if (start == null) return null;
  const end = parseMinutosHHmm(horaHasta) ?? start + 60;
  if (end <= start) return null;
  return { start, end };
}

function rangoMinutosIso(horaInicio?: string | null, horaFin?: string | null): { start: number; end: number } | null {
  const start = minutosDesdeMedianoche(horaInicio);
  if (start == null) return null;
  const end = minutosDesdeMedianoche(horaFin) ?? start + 60;
  if (end <= start) return null;
  return { start, end };
}

/** Reparte eventos solapados en columnas (estilo Google Calendar). */
export function calcularColumnasSolapamiento(
  events: { id: string; startMin: number; endMin: number }[],
): Map<string, { column: number; totalColumns: number }> {
  const result = new Map<string, { column: number; totalColumns: number }>();
  if (!events.length) return result;

  const sorted = [...events].sort(
    (a, b) => a.startMin - b.startMin || b.endMin - b.startMin - (a.endMin - a.startMin),
  );

  const columnEnds: number[] = [];
  const colById = new Map<string, number>();

  for (const ev of sorted) {
    let col = columnEnds.findIndex((end) => end <= ev.startMin);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(ev.endMin);
    } else {
      columnEnds[col] = ev.endMin;
    }
    colById.set(ev.id, col);
  }

  for (const ev of sorted) {
    const overlapping = sorted.filter((o) => o.startMin < ev.endMin && o.endMin > ev.startMin);
    const totalColumns = Math.max(...overlapping.map((o) => colById.get(o.id)!)) + 1;
    result.set(ev.id, { column: colById.get(ev.id)!, totalColumns });
  }

  return result;
}

function combinarLayoutConColumnas(
  base: LayoutHorario,
  column: number,
  totalColumns: number,
): LayoutHorarioColumnas {
  if (base.sinHorario) {
    return { ...base, ...LAYOUT_COL_DEFAULT };
  }
  if (totalColumns <= 1) {
    return { ...base, ...LAYOUT_COL_DEFAULT };
  }
  const gap = 0.6;
  const colWidth = 100 / totalColumns;
  return {
    ...base,
    leftPct: column * colWidth + gap,
    widthPct: Math.max(colWidth - gap * 2, 8),
  };
}

/** Layouts de un día con columnas para clases HH:mm (programación CEA). */
export function layoutsCalendarioDiaHHmm(
  items: { id: string; horaDesde?: string | null; horaHasta?: string | null }[],
): Map<string, LayoutHorarioColumnas> {
  const events: { id: string; startMin: number; endMin: number }[] = [];
  const bases = new Map<string, LayoutHorario>();

  for (const item of items) {
    const base = layoutHorarioHHmm(item.horaDesde, item.horaHasta);
    if (base.sinHorario) continue;
    const range = rangoMinutosHHmm(item.horaDesde, item.horaHasta);
    if (!range) continue;
    bases.set(item.id, base);
    events.push({ id: item.id, startMin: range.start, endMin: range.end });
  }

  const columns = calcularColumnasSolapamiento(events);
  const out = new Map<string, LayoutHorarioColumnas>();
  for (const [id, base] of bases) {
    const col = columns.get(id) ?? { column: 0, totalColumns: 1 };
    out.set(id, combinarLayoutConColumnas(base, col.column, col.totalColumns));
  }
  return out;
}

/** Layouts de un día con columnas para clases con hora ISO (jornadas carpa). */
export function layoutsCalendarioDiaClase(
  items: { id: string; horaInicio?: string | null; horaFin?: string | null }[],
): Map<string, LayoutHorarioColumnas> {
  const events: { id: string; startMin: number; endMin: number }[] = [];
  const bases = new Map<string, LayoutHorario>();

  for (const item of items) {
    const base = layoutHorarioClase(item.horaInicio, item.horaFin);
    if (base.sinHorario) continue;
    const range = rangoMinutosIso(item.horaInicio, item.horaFin);
    if (!range) continue;
    bases.set(item.id, base);
    events.push({ id: item.id, startMin: range.start, endMin: range.end });
  }

  const columns = calcularColumnasSolapamiento(events);
  const out = new Map<string, LayoutHorarioColumnas>();
  for (const [id, base] of bases) {
    const col = columns.get(id) ?? { column: 0, totalColumns: 1 };
    out.set(id, combinarLayoutConColumnas(base, col.column, col.totalColumns));
  }
  return out;
}

export function fmtMesAnio(anio: number, mes: number): string {
  return new Date(anio, mes, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

export function fmtRangoSemana(inicio: Date): string {
  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const a = inicio.toLocaleDateString('es-CO', opts);
  const b = fin.toLocaleDateString('es-CO', { ...opts, year: 'numeric' });
  return `${a} – ${b}`;
}

export function fmtDiaSemanaCorto(fecha: Date): string {
  return fecha.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Posición vertical (%) de la hora actual en la rejilla semanal, o null si fuera del rango. */
export function ahoraLineaTopPct(now = new Date()): number | null {
  const mins = now.getHours() * 60 + now.getMinutes();
  const start = HORA_INICIO * 60;
  const end = HORA_FIN * 60;
  if (mins < start || mins >= end) return null;
  return ((mins - start) / (HORAS_TOTAL * 60)) * 100;
}

export function esFinDeSemana(fecha: Date): boolean {
  const d = fecha.getDay();
  return d === 0 || d === 6;
}

export const DIAS_SEMANA_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
