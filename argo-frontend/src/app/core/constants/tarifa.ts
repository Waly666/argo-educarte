/** Tarifas 1–3: presencial (app web). Tarifa 4: educación virtual. */
export const TARIFA_VIRTUAL = 4;

export const TARIFAS_PRESENCIAL = [1, 2, 3] as const;

export function esTarifaVirtual(tarifa: number | string | null | undefined): boolean {
  return Number(tarifa) === TARIFA_VIRTUAL;
}
