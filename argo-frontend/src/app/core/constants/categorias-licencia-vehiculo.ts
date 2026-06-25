/** Categorías de licencia — flags booleanos en catálogo claseVehiculo. */
export const CATEGORIAS_LICENCIA_VEHICULO = ['A1', 'A2', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'] as const;

export type CategoriaLicenciaVehiculo = (typeof CATEGORIAS_LICENCIA_VEHICULO)[number];

export function labelCategoriasLicencia(row: Record<string, unknown>): string {
  const activas = CATEGORIAS_LICENCIA_VEHICULO.filter((c) => row[c] === true || row[c] === 1 || row[c] === '1');
  return activas.length ? activas.join(', ') : '—';
}
