import { TARIFA_VIRTUAL } from '../alumnos/catalogo.helpers';

export const MODALIDAD_VIRTUAL = 'VIRTUAL';
export const MODALIDAD_PRESENCIAL = 'PRESENCIAL';
export const MODALIDAD_MIXTA = 'MIXTA';

export const MODALIDADES_PROGRAMA_OPTS = [
  { codigo: MODALIDAD_VIRTUAL, label: 'Virtual' },
  { codigo: MODALIDAD_PRESENCIAL, label: 'Presencial' },
  { codigo: MODALIDAD_MIXTA, label: 'Mixta' },
] as const;

const TARIFAS_POR_MODALIDAD: Record<string, number[]> = {
  [MODALIDAD_VIRTUAL]: [TARIFA_VIRTUAL],
  [MODALIDAD_PRESENCIAL]: [1, 2, 3],
  [MODALIDAD_MIXTA]: [1, 2, 3],
};

export interface ProgramaModalidadFields {
  modalidades?: string[];
  tarifasPermitidas?: number[];
  soloVirtual?: boolean;
  admiteVirtual?: boolean;
  admitePresencial?: boolean;
  tarifaVirtual?: number;
  valorMatricula?: number;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizarCodigo(raw: unknown): string | null {
  const t = String(raw ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!t) return null;
  if (t === 'VIR' || t.startsWith('VIRTUAL')) return MODALIDAD_VIRTUAL;
  if (t === 'PRE' || t.startsWith('PRESENCIAL')) return MODALIDAD_PRESENCIAL;
  if (t === 'MIX' || t.startsWith('MIXTA')) return MODALIDAD_MIXTA;
  if (MODALIDADES_PROGRAMA_OPTS.some((o) => o.codigo === t)) return t;
  return null;
}

export function modalidadesEfectivas(
  prog: ProgramaModalidadFields | null | undefined,
  servicios?: Array<{ tarifa1?: number; tarifa2?: number; tarifa3?: number; tarifaVirtual?: number }>,
): string[] {
  const raw = prog?.modalidades;
  if (Array.isArray(raw) && raw.length) {
    const out: string[] = [];
    for (const item of raw) {
      const c = normalizarCodigo(item);
      if (c && !out.includes(c)) out.push(c);
    }
    if (out.length) return out;
  }
  const servs = servicios || [];
  const hasVirtual =
    servs.some((s) => num(s.tarifaVirtual) > 0) || num(prog?.tarifaVirtual) > 0;
  const hasPres =
    servs.some((s) => num(s.tarifa1) > 0 || num(s.tarifa2) > 0 || num(s.tarifa3) > 0) ||
    num(prog?.valorMatricula) > 0;
  const mods: string[] = [];
  if (hasPres || !hasVirtual) mods.push(MODALIDAD_PRESENCIAL);
  if (hasVirtual) mods.push(MODALIDAD_VIRTUAL);
  return mods.length ? mods : [MODALIDAD_PRESENCIAL];
}

export function tarifasPermitidasPrograma(
  prog: ProgramaModalidadFields | null | undefined,
  servicios?: Array<{ tarifa1?: number; tarifa2?: number; tarifa3?: number; tarifaVirtual?: number }>,
): number[] {
  if (prog?.tarifasPermitidas?.length) {
    return [...prog.tarifasPermitidas].sort((a, b) => a - b);
  }
  const set = new Set<number>();
  for (const m of modalidadesEfectivas(prog, servicios)) {
    for (const t of TARIFAS_POR_MODALIDAD[m] || []) set.add(t);
  }
  return [...set].sort((a, b) => a - b);
}

export function esProgramaSoloVirtual(
  prog: ProgramaModalidadFields | null | undefined,
  servicios?: Array<{ tarifaVirtual?: number; tarifa1?: number }>,
): boolean {
  if (prog?.soloVirtual === true) return true;
  const mods = modalidadesEfectivas(prog, servicios);
  return mods.length === 1 && mods[0] === MODALIDAD_VIRTUAL;
}

export function programaAdmiteVirtual(prog: ProgramaModalidadFields | null | undefined): boolean {
  if (prog?.admiteVirtual != null) return prog.admiteVirtual;
  return modalidadesEfectivas(prog).includes(MODALIDAD_VIRTUAL);
}

export function programaAdmitePresencial(prog: ProgramaModalidadFields | null | undefined): boolean {
  if (prog?.admitePresencial != null) return prog.admitePresencial;
  return modalidadesEfectivas(prog).some(
    (m) => m === MODALIDAD_PRESENCIAL || m === MODALIDAD_MIXTA,
  );
}

export function etiquetasModalidad(prog: ProgramaModalidadFields | null | undefined): string[] {
  return modalidadesEfectivas(prog).map(
    (c) => MODALIDADES_PROGRAMA_OPTS.find((o) => o.codigo === c)?.label || c,
  );
}
