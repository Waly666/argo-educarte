export type AmPm = 'AM' | 'PM';

export interface Hora12Parts {
  hour12: number;
  minute: number;
  ampm: AmPm;
}

export const HORAS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** Hora de inicio mostrada y usada al programar clases sin horario previo. */
export const DEFAULT_HORA_INICIO_HHMM = '08:00';

export const MINUTOS_0_59 = Array.from({ length: 60 }, (_, i) => i);

/** HH:mm (24 h) → componentes 12 h con AM/PM. */
export function hhmmTo12Parts(hhmm?: string | null, fallback: Hora12Parts = { hour12: 8, minute: 0, ampm: 'AM' }): Hora12Parts {
  const m = String(hhmm ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { ...fallback };
  const h24 = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(h24) || h24 < 0 || h24 > 23 || minute < 0 || minute > 59) return { ...fallback };
  const ampm: AmPm = h24 >= 12 ? 'PM' : 'AM';
  let hour12 = h24 % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute, ampm };
}

/** Componentes 12 h → HH:mm (24 h) para API/backend. */
export function parts12ToHhmm(hour12: number, minute: number, ampm: AmPm): string {
  let h = Math.max(1, Math.min(12, Number(hour12) || 12));
  const m = Math.max(0, Math.min(59, Number(minute) || 0));
  if (ampm === 'AM') {
    if (h === 12) h = 0;
  } else if (h !== 12) {
    h += 12;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Devuelve HH:mm válido o la hora por defecto (p. ej. al guardar sin tocar el selector). */
export function horaInicioEfectiva(hhmm?: string | null, fallback = DEFAULT_HORA_INICIO_HHMM): string {
  const v = String(hhmm ?? '').trim();
  return /^\d{1,2}:\d{2}$/.test(v) ? v : fallback;
}
