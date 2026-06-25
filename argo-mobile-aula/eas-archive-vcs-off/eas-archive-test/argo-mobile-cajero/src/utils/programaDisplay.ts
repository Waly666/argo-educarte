import type { CatalogoItem, ProgramaItem } from '../api/domain';
import { esProgramaCea, esProgramaJornadasCap, esProgramaTecnicoLaboral } from './matricula';

export type TipoCapOption = { id: string | number; label: string };

function num(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normTipoCap(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function idsTipCapCoinciden(a: string | number, b: string | number): boolean {
  const sa = String(a).trim();
  const sb = String(b).trim();
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  const na = sa.match(/^(\d+)/)?.[1];
  const nb = sb.match(/^(\d+)/)?.[1];
  return !!(na && nb && na === nb);
}

export function parseTiposCap(rows: CatalogoItem[]): TipoCapOption[] {
  return rows
    .map((t) => {
      const idRaw = t.idTipCap ?? t.id ?? '';
      const id = typeof idRaw === 'string' || typeof idRaw === 'number' ? idRaw : String(idRaw);
      const label = String(t.tipoCap ?? t.descripcion ?? t.nombre ?? id).trim();
      return { id, label };
    })
    .filter((t) => t.label);
}

export function horasPrograma(prog: ProgramaItem | null | undefined): number {
  if (!prog) return 0;
  const directa = num(prog.horas);
  if (directa > 0) return directa;
  const suma = num(prog.horasTeoria) + num(prog.horasPractica) + num(prog.horasTaller);
  return suma > 0 ? suma : 0;
}

export function desgloseHorasPrograma(prog: ProgramaItem | null | undefined): {
  teoria: number;
  practica: number;
  taller: number;
  total: number;
} {
  if (!prog) return { teoria: 0, practica: 0, taller: 0, total: 0 };
  const teoria = num(prog.horasTeoria);
  const practica = num(prog.horasPractica);
  const taller = num(prog.horasTaller);
  const suma = teoria + practica + taller;
  const total = suma > 0 ? suma : num(prog.horas);
  return { teoria, practica, taller, total };
}

export function labelTipoPrograma(
  prog: ProgramaItem | null | undefined,
  tiposCap: TipoCapOption[] = [],
): string {
  if (!prog) return '—';
  if (esProgramaJornadasCap(prog)) {
    const jornada = tiposCap.find((t) => /jornada/i.test(t.label) && /capacit/i.test(t.label));
    return jornada?.label || 'Jornadas de capacitación';
  }
  const tipoCap = String(prog.tipoCap ?? '').trim();
  if (tipoCap && !/^\d+$/.test(tipoCap)) return tipoCap;

  const id = prog.idTipCap;
  if (id == null || id === '') return '—';

  const idStr = String(id).trim();
  const porId = tiposCap.find((t) => idsTipCapCoinciden(t.id, idStr));
  if (porId) return porId.label;

  const norm = normTipoCap(idStr);
  const porEtiqueta = tiposCap.find((t) => normTipoCap(t.label) === norm);
  if (porEtiqueta) return porEtiqueta.label;

  if (!/^\d+$/.test(idStr)) return idStr;
  return '—';
}

const ETIQUETAS_MODALIDAD: Record<string, string> = {
  VIRTUAL: 'Virtual',
  PRESENCIAL: 'Presencial',
  MIXTA: 'Mixta',
};

export function labelModalidadesPrograma(prog: ProgramaItem | null | undefined): string {
  if (!prog) return '—';
  if (esProgramaJornadasCap(prog)) return 'Jornada';
  if (prog.modalidadLabels?.length) return prog.modalidadLabels.join(' · ');
  if (prog.modalidades?.length) {
    return prog.modalidades
      .map((m) => ETIQUETAS_MODALIDAD[String(m).toUpperCase()] || String(m))
      .join(' · ');
  }
  if (prog.soloVirtual) return 'Virtual';
  if (prog.admiteVirtual && prog.admitePresencial !== false) return 'Presencial · Virtual';
  if (prog.admiteVirtual) return 'Virtual';
  return 'Presencial';
}

export function esProgramaActivo(prog: ProgramaItem | null | undefined): boolean {
  if (!prog) return false;
  const e = String(prog.estado ?? '').trim().toLowerCase();
  return !e || e === 'activo';
}

export function iconoPrograma(prog: ProgramaItem): 'calendar-outline' | 'car-outline' | 'construct-outline' | 'book-outline' {
  if (esProgramaJornadasCap(prog)) return 'calendar-outline';
  if (esProgramaCea(prog)) return 'car-outline';
  if (esProgramaTecnicoLaboral(prog)) return 'construct-outline';
  return 'book-outline';
}

export function gradientePrograma(
  prog: ProgramaItem,
  highContrast: boolean,
): [string, string] {
  if (highContrast) return ['#1e293b', '#334155'];
  if (esProgramaJornadasCap(prog)) return ['#d97706', '#f59e0b'];
  if (esProgramaCea(prog)) return ['#0891b2', '#06b6d4'];
  if (esProgramaTecnicoLaboral(prog)) return ['#7c3aed', '#a78bfa'];
  return ['#4f46e5', '#6366f1'];
}

export function textoHorasPrograma(prog: ProgramaItem): string {
  const { teoria, practica, taller, total } = desgloseHorasPrograma(prog);
  if (total <= 0) return 'Sin horas';
  const partes: string[] = [];
  if (teoria > 0) partes.push(`T ${teoria}`);
  if (practica > 0) partes.push(`P ${practica}`);
  if (taller > 0) partes.push(`L ${taller}`);
  if (partes.length > 1) return `${total} h · ${partes.join(' · ')}`;
  return `${total} h`;
}
