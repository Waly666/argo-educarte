export const CLAVES_TIPO_INGRESO_CAJA = [
  'INGRESO CONTRATO',
  'APROVISIONAMIENTO DE CAJA',
  'OTROS INGRESOS',
] as const;

export interface TipoIngresoCat {
  idTipoIngreso: string | number;
  tipo?: string;
  descripcion?: string;
}

function normalizarTipo(txt?: string | null): string {
  return String(txt ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function esTipoIngresoCaja(t?: TipoIngresoCat | string | null): boolean {
  const label = typeof t === 'string' ? t : t?.tipo || t?.descripcion || '';
  const n = normalizarTipo(label);
  return CLAVES_TIPO_INGRESO_CAJA.some((k) => n === normalizarTipo(k) || n.includes(normalizarTipo(k)));
}

export function filtrarTiposIngresoCaja(tipos: TipoIngresoCat[]): TipoIngresoCat[] {
  return (tipos || []).filter((t) => esTipoIngresoCaja(t));
}

export function esIngresoContrato(t?: TipoIngresoCat | null): boolean {
  return normalizarTipo(t?.tipo).includes('CONTRATO');
}

export function esAprovisionamientoCaja(t?: TipoIngresoCat | null): boolean {
  return normalizarTipo(t?.tipo).includes('APROVISION');
}

export function esOtrosIngresos(t?: TipoIngresoCat | null): boolean {
  const n = normalizarTipo(t?.tipo);
  return n.includes('OTROS INGRESO');
}

export function labelTipoIngreso(t?: TipoIngresoCat | null): string {
  return t?.tipo || t?.descripcion || '—';
}
