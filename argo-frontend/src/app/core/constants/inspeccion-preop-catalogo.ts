/** Secciones válidas en caractInspeccion (valor guardado en BD). */
export const SECCIONES_CARACT_INSPECCION = [
  { value: 'estadoGeneral', label: 'Estado general del vehículo' },
  { value: 'adaptaciones', label: 'Adaptaciones y estado técnico' },
  { value: 'aspecto1', label: 'Emergencias, primeros auxilios y otros' },
  { value: 'aspecto2', label: 'Seguridad activa y pasiva' },
] as const;

export function labelSeccionCaractInspeccion(valor: string): string {
  const v = String(valor || '').trim();
  return SECCIONES_CARACT_INSPECCION.find((s) => s.value === v)?.label || v || '—';
}
