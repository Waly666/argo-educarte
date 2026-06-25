/** Cédula / NUIP Colombia: mínimo histórico 6, capacidad hasta 14 dígitos. */
export const NUM_DOC_MIN_DIGITS = 6;
export const NUM_DOC_MAX_DIGITS = 14;

export function numDocValidationHint(): string {
  return `${NUM_DOC_MIN_DIGITS}–${NUM_DOC_MAX_DIGITS} dígitos`;
}

export function isValidNumDocDigits(digits: string): boolean {
  return digits.length >= NUM_DOC_MIN_DIGITS && digits.length <= NUM_DOC_MAX_DIGITS;
}

/** Muestra numDoc en inputs (sin puntos, sin notación científica). */
export function formatNumDoc(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  const digits = String(value).replace(/\D/g, '');
  return digits || String(value).trim();
}

/** Normaliza entrada de documento: solo dígitos, máximo permitido. */
export function sanitizeNumDocInput(value: unknown): string {
  return formatNumDoc(value).slice(0, NUM_DOC_MAX_DIGITS);
}

/** Envía numDoc al API como número (6–14 dígitos). */
export function parseNumDocForApi(value: unknown): number | null {
  const digits = formatNumDoc(value);
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (!isValidNumDocDigits(digits)) return null;
  return n;
}
