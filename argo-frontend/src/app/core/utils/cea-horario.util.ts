/** Calcula hora fin (HH:mm) sumando horas de sesión a hora inicio. */
export function calcularHoraHastaHHmm(horaDesde: string, horasDuracion: number): string {
  const [h1, m1] = String(horaDesde || '').split(':').map(Number);
  if (!Number.isFinite(h1) || !(Number(horasDuracion) > 0)) return '';
  const totalMin = h1 * 60 + (m1 || 0) + Math.round(Number(horasDuracion) * 60);
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Horas de la sesión según tipo de clase y datos ya programados. */
export function horasSesionClase(
  tipoClase: string | undefined,
  opts: { duracionHoras?: number | null; horasDescuento?: number | null },
): number {
  if (tipoClase === 'practica') {
    const d = Number(opts.duracionHoras);
    if (d > 0) return d;
    const hd = Number(opts.horasDescuento);
    if (hd > 0) return hd;
    return 0;
  }
  const hd = Number(opts.horasDescuento);
  return hd > 0 ? hd : 0;
}
