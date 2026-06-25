import type { CatalogoItem, ServicioItem } from '../api/domain';
import { esServicioMatriculaPrograma } from './matricula';

export type TipoServOption = { code: string; label: string };

export type CategoriaServicio =
  | 'matricula'
  | 'hora_practica'
  | 'derechos_grado'
  | 'programa_otro'
  | 'general';

export type TarifaServicio = { key: string; label: string; valor: number };

function num(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function descr(s: ServicioItem): string {
  return String(s.descrServicio || s.descripcion || '').trim();
}

export function esServicioDePrograma(s: ServicioItem | null | undefined): boolean {
  return s?.idProg != null && String(s.idProg).trim() !== '';
}

export function categoriaServicio(s: ServicioItem): CategoriaServicio {
  const d = descr(s).toLowerCase();
  if (s.rolServicio === 'hora_practica' || /\bhoras?\b.*\bpractic/.test(d)) return 'hora_practica';
  if (s.rolServicio === 'derechos_grado' || /derechos\s+de\s+grado/.test(d)) return 'derechos_grado';
  if (esServicioDePrograma(s)) {
    if (esServicioMatriculaPrograma(s)) return 'matricula';
    return 'programa_otro';
  }
  return 'general';
}

export function labelCategoriaServicio(cat: CategoriaServicio): string {
  switch (cat) {
    case 'matricula':
      return 'Matrícula de programa';
    case 'hora_practica':
      return 'Hora práctica';
    case 'derechos_grado':
      return 'Derechos de grado';
    case 'programa_otro':
      return 'Vinculado a programa';
    default:
      return 'Servicio general';
  }
}

export function parseTiposServ(rows: CatalogoItem[]): TipoServOption[] {
  return rows
    .map((t) => {
      const code = String(t.tipoServ ?? t.codigo ?? '').trim();
      const label = String(t.descTipoServ ?? t.descripcion ?? t.tipoServ ?? code).trim();
      return { code, label };
    })
    .filter((t) => t.code || t.label);
}

export function labelTipoServicio(s: ServicioItem, tipos: TipoServOption[] = []): string {
  const code = String(s.tipoServ ?? '').trim();
  if (!code) return '—';
  const t = tipos.find((x) => x.code === code);
  return t?.label || code;
}

export function tarifasServicio(s: ServicioItem): TarifaServicio[] {
  const out: TarifaServicio[] = [];
  if (num(s.tarifa1) > 0) out.push({ key: 't1', label: 'Tarifa 1', valor: num(s.tarifa1) });
  if (num(s.tarifa2) > 0) out.push({ key: 't2', label: 'Tarifa 2', valor: num(s.tarifa2) });
  if (num(s.tarifa3) > 0) out.push({ key: 't3', label: 'Tarifa 3', valor: num(s.tarifa3) });
  if (num(s.tarifaVirtual) > 0) out.push({ key: 'tv', label: 'Virtual', valor: num(s.tarifaVirtual) });
  return out;
}

export function tarifaPrincipal(s: ServicioItem): number {
  const tarifas = tarifasServicio(s);
  if (tarifas.length) return tarifas[0].valor;
  return num(s.tarifa1);
}

export function iconoServicio(cat: CategoriaServicio): 'school-outline' | 'car-outline' | 'ribbon-outline' | 'link-outline' | 'pricetag-outline' {
  switch (cat) {
    case 'matricula':
      return 'school-outline';
    case 'hora_practica':
      return 'car-outline';
    case 'derechos_grado':
      return 'ribbon-outline';
    case 'programa_otro':
      return 'link-outline';
    default:
      return 'pricetag-outline';
  }
}

export function gradienteServicio(cat: CategoriaServicio, highContrast: boolean): [string, string] {
  if (highContrast) return ['#1e293b', '#334155'];
  switch (cat) {
    case 'matricula':
      return ['#4f46e5', '#6366f1'];
    case 'hora_practica':
      return ['#0891b2', '#06b6d4'];
    case 'derechos_grado':
      return ['#7c3aed', '#a78bfa'];
    case 'programa_otro':
      return ['#0d9488', '#14b8a6'];
    default:
      return ['#e11d48', '#f43f5e'];
  }
}

export function chipsServicio(s: ServicioItem): string[] {
  const chips: string[] = [];
  if (s.permiteCantidad) chips.push('Por cantidad');
  if (s.valorVariable) chips.push('Valor variable');
  if (String(s.facturar ?? '').toUpperCase() === 'SI') chips.push('Facturable');
  return chips;
}
