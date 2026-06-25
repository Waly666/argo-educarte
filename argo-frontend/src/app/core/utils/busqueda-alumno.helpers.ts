/** Misma lógica de búsqueda por tokens que el backend (apellido2, nombre2, etc.). */
export function normalizarTextoBusqueda(s: string | number | null | undefined): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function tokensBusqueda(q: string): string[] {
  return String(q || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function coincideBusquedaTexto(texto: string | null | undefined, q: string): boolean {
  const trimmed = String(q || '').trim();
  if (!trimmed) return true;

  const normTexto = normalizarTextoBusqueda(texto);
  const normQ = normalizarTextoBusqueda(trimmed);
  if (normTexto.includes(normQ)) return true;

  const tokens = tokensBusqueda(trimmed).map(normalizarTextoBusqueda);
  if (tokens.length >= 2) {
    const palabras = normTexto.split(/\s+/).filter(Boolean);
    return tokens.every((tok) => palabras.some((p) => p.includes(tok)));
  }

  return normTexto.includes(normQ);
}

export function coincideBusquedaDocumento(
  numDoc: string | number | null | undefined,
  q: string,
): boolean {
  const digits = String(q || '').replace(/\D/g, '');
  if (digits.length < 3) return false;
  return String(numDoc ?? '').includes(digits);
}

export function coincideBusquedaAlumnoPartes(
  partes: Array<string | number | null | undefined>,
  q: string,
): boolean {
  const trimmed = String(q || '').trim();
  if (!trimmed) return true;

  const normNombre = normalizarTextoBusqueda(
    partes.map((p) => String(p ?? '').trim()).filter(Boolean).join(' '),
  );
  const normQ = normalizarTextoBusqueda(trimmed);
  if (normNombre.includes(normQ)) return true;

  const tokens = tokensBusqueda(trimmed).map(normalizarTextoBusqueda);
  const partesNorm = partes.map((p) => normalizarTextoBusqueda(p));
  if (tokens.length >= 2) {
    return tokens.every((tok) => partesNorm.some((p) => p.includes(tok)));
  }

  return partesNorm.some((p) => p.includes(normQ));
}
