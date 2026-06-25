import type { ProgramaItem, ServicioItem } from '../api/domain';
import { coincideBusqueda, normalizarBlob } from './buscarTexto';
import { TARIFA_VIRTUAL } from './pago';

export type TarifaMatricula = 1 | 2 | 3 | 4;

export { TARIFA_VIRTUAL };

const MODALIDAD_VIRTUAL = 'VIRTUAL';
const MODALIDAD_PRESENCIAL = 'PRESENCIAL';
const MODALIDAD_MIXTA = 'MIXTA';

const TARIFAS_POR_MODALIDAD: Record<string, number[]> = {
  [MODALIDAD_VIRTUAL]: [TARIFA_VIRTUAL],
  [MODALIDAD_PRESENCIAL]: [1, 2, 3],
  [MODALIDAD_MIXTA]: [1, 2, 3],
};

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || 0;
  if (typeof v === 'object' && v !== null && '$numberDecimal' in v) {
    return Number((v as { $numberDecimal: string }).$numberDecimal) || 0;
  }
  return Number(v) || 0;
}

function normalizarCodigoModalidad(raw: unknown): string | null {
  const t = String(raw ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!t) return null;
  if (t === 'VIR' || t.startsWith('VIRTUAL')) return MODALIDAD_VIRTUAL;
  if (t === 'PRE' || t.startsWith('PRESENCIAL')) return MODALIDAD_PRESENCIAL;
  if (t === 'MIX' || t.startsWith('MIXTA')) return MODALIDAD_MIXTA;
  if ([MODALIDAD_VIRTUAL, MODALIDAD_PRESENCIAL, MODALIDAD_MIXTA].includes(t)) return t;
  return null;
}

export function modalidadesEfectivas(
  prog: ProgramaItem | null | undefined,
  servicios?: ServicioItem[],
): string[] {
  const raw = prog?.modalidades;
  if (Array.isArray(raw) && raw.length) {
    const out: string[] = [];
    for (const item of raw) {
      const c = normalizarCodigoModalidad(item);
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
  prog: ProgramaItem | null | undefined,
  servicios?: ServicioItem[],
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
  prog: ProgramaItem | null | undefined,
  servicios?: ServicioItem[],
): boolean {
  if (prog?.soloVirtual === true) return true;
  const mods = modalidadesEfectivas(prog, servicios);
  return mods.length === 1 && mods[0] === MODALIDAD_VIRTUAL;
}

export function serviciosPrograma(prog: ProgramaItem | null | undefined, servicios: ServicioItem[]): ServicioItem[] {
  if (!prog) return [];
  const idP = idPrograma(prog);
  return servicios.filter(
    (s) => String(s.idProg) === idP && !esHoraPractica(s) && !esDerechosGrado(s),
  );
}

function normTipoCap(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function esTipCapJornadaLabel(text: string): boolean {
  const t = normTipoCap(text);
  if (!t) return false;
  return (
    /jornadas? de capacitacion/.test(t) ||
    /jornada capacitacion/.test(t) ||
    /cap jornada/.test(t) ||
    (t.includes('jornada') && t.includes('capacitacion'))
  );
}

/** Programas de jornadas de capacitación no se matriculan desde ficha alumno (módulo Jornadas). */
export function esProgramaJornadasCap(prog: ProgramaItem | null | undefined): boolean {
  if (!prog) return false;
  const tc = String(prog.tipoCertificado || '')
    .toLowerCase()
    .replace(/-/g, '_');
  if (tc === 'jornada_capacitacion') return true;
  const campos = [
    String(prog.idTipCap ?? ''),
    String(prog.tipoCap ?? ''),
    String(prog.nombreProg ?? ''),
    String(prog.descripcion ?? ''),
  ];
  return campos.some((c) => esTipCapJornadaLabel(c));
}

export function idPrograma(prog: ProgramaItem): string {
  return String(prog.idPrograma ?? prog.idProg ?? prog._id ?? '');
}

export function programasParaMatricula(programas: ProgramaItem[]): ProgramaItem[] {
  return programas
    .filter((p) => !esProgramaJornadasCap(p))
    .sort((a, b) => {
      const ca = String(a.codigoProg || idPrograma(a)).trim();
      const cb = String(b.codigoProg || idPrograma(b)).trim();
      return ca.localeCompare(cb, 'es', { sensitivity: 'base', numeric: true });
    });
}

export function filtrarProgramasBusqueda(programas: ProgramaItem[], q: string): ProgramaItem[] {
  const t = q.trim();
  if (!t) return programas;
  return programas.filter((p) => {
    const blob = normalizarBlob([p.nombreProg, p.codigoProg, p.descripcion, p.nomCert, idPrograma(p)]);
    return coincideBusqueda(blob, t);
  });
}

export function filtrarServiciosBusqueda(servicios: ServicioItem[], q: string): ServicioItem[] {
  const t = q.trim();
  if (!t) return servicios;
  return servicios.filter((s) => {
    const blob = normalizarBlob([
      s.descrServicio,
      s.descripcion,
      s.programaNombre,
      s.idServ,
      s._id,
      s.tipoServ,
    ]);
    return coincideBusqueda(blob, t);
  });
}

export function idServicio(s: ServicioItem): string {
  return String(s.idServ ?? s._id ?? '');
}

export function labelPrograma(prog: ProgramaItem): string {
  const nombre = String(prog.nombreProg || prog.descripcion || '').trim();
  const cod = String(prog.codigoProg || '').trim();
  return cod ? `${nombre} (${cod})` : nombre || idPrograma(prog);
}

export function etiquetaTarifa(t: number): string {
  if (t === TARIFA_VIRTUAL) return 'Virtual (aula en línea)';
  return `Tarifa ${t}`;
}

function esHoraPractica(s: ServicioItem | null | undefined): boolean {
  if (!s) return false;
  if (s.rolServicio === 'hora_practica') return true;
  return /\bhoras?\b.*\bpractic/i.test(String(s.descrServicio || s.descripcion || ''));
}

function esDerechosGrado(s: ServicioItem | null | undefined): boolean {
  if (!s) return false;
  if (s.rolServicio === 'derechos_grado') return true;
  return /derechos\s+de\s+grado/i.test(String(s.descrServicio || s.descripcion || ''));
}

function tieneIdProg(s: ServicioItem | null | undefined): boolean {
  return s?.idProg != null && String(s.idProg).trim() !== '';
}

export function esProgramaTecnicoLaboral(prog: ProgramaItem | null | undefined): boolean {
  if (!prog) return false;
  const cod = String(prog.codigoProg || '').trim().toUpperCase();
  if (cod.startsWith('TEC')) return true;
  const tip = String(prog.idTipCap || '').toLowerCase();
  return /tecnico|competenc/.test(tip);
}

export function esServicioMatriculaPrograma(s: ServicioItem | null | undefined): boolean {
  return tieneIdProg(s) && !esHoraPractica(s) && !esDerechosGrado(s);
}

export function serviciosAdicionalesLista(servicios: ServicioItem[]): ServicioItem[] {
  return servicios.filter((s) => !esServicioMatriculaPrograma(s));
}

export function permiteCantidadServicio(s: ServicioItem | null | undefined): boolean {
  if (!s) return false;
  if (s.permiteCantidad === true) return num(s.tarifa1) > 0;
  if (s.permiteCantidad === false) return false;
  if (s.valorVariable === true) return false;
  if (s.usaCantidad === false) return false;
  if (esServicioMatriculaPrograma(s)) return false;
  if (num(s.tarifa1) <= 0) return false;
  if (esHoraPractica(s)) return true;
  if (s.usaCantidad === true) return true;
  return false;
}

export function calcularValorMatricula(
  prog: ProgramaItem | null | undefined,
  servicios: ServicioItem[],
  tarifa: TarifaMatricula,
): number {
  if (!prog) return 0;
  const idP = idPrograma(prog);
  const porProg = servicios.filter(
    (s) => String(s.idProg) === idP && !esHoraPractica(s) && !esDerechosGrado(s),
  );
  if (tarifa === TARIFA_VIRTUAL) {
    return porProg.reduce((acc, s) => acc + num(s.tarifaVirtual), 0);
  }
  let base = 0;
  const sem = Number(prog.semestres);
  if (Number.isFinite(sem) && sem >= 1 && porProg.length > 0) {
    base = porProg.reduce((acc, s) => {
      const key = `tarifa${tarifa}` as keyof ServicioItem;
      const v = s[key];
      if (v != null && v !== '') return acc + num(v);
      return acc + num(s.tarifa1);
    }, 0);
  } else {
    const serv = porProg[0] || servicios.find((s) => String(s.idServ) === String(prog.idServ));
    if (serv) {
      const key = `tarifa${tarifa}` as keyof ServicioItem;
      const v = serv[key];
      if (v != null && v !== '') base = num(v);
    } else {
      const keyProg = `tarifa${tarifa}` as keyof ProgramaItem;
      const vProg = prog[keyProg];
      if (vProg != null && vProg !== '') base = num(vProg);
      else base = num(prog.valorMatricula);
    }
  }
  return base;
}

export function esProgramaCea(prog: ProgramaItem | null | undefined): boolean {
  if (!prog) return false;
  return num(prog.horasTeoria) + num(prog.horasPractica) + num(prog.horasTaller) > 0;
}

export function descrConCantidad(base: string, cant: number): string {
  const limpio = base
    .replace(/\s+x\s*\d+\s*$/i, '')
    .replace(/\s*\(\s*\d+\s*h\s*\)\s*$/i, '')
    .replace(/\s*\(\s*cant\.\s*\d+\s*\)\s*$/i, '')
    .trim();
  return `${limpio} x ${cant}`;
}

export function valorServicioAdicional(
  servicio: ServicioItem | null | undefined,
  cantidad: number,
  valorManual: number,
): number {
  if (!servicio) return 0;
  if (permiteCantidadServicio(servicio)) {
    return num(servicio.tarifa1) * Math.max(1, Math.floor(cantidad));
  }
  return valorManual;
}
