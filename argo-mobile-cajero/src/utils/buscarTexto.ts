/** Filtra texto: cada palabra escrita debe aparecer en el blob (orden libre). */
export function coincideBusqueda(blob: string, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const hay = blob.toLowerCase();
  return t.split(/\s+/).every((token) => token.length > 0 && hay.includes(token));
}

export function normalizarBlob(parts: Array<string | number | null | undefined>): string {
  return parts
    .filter((p) => p != null && String(p).trim() !== '')
    .map((p) => String(p).trim())
    .join(' ');
}
