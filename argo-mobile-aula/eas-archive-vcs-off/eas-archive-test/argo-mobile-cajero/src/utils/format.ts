export function formatMoney(value: number | null | undefined): string {
  const n = Number(value) || 0;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumDoc(value: number | string): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function nombreCompleto(parts: {
  nombre1?: string;
  nombre2?: string;
  apellido1?: string;
  apellido2?: string;
  nombreCompleto?: string;
  nombres?: string;
}): string {
  if (parts.nombreCompleto?.trim()) return parts.nombreCompleto.trim();
  if (parts.nombres?.trim()) return parts.nombres.trim();
  return [parts.nombre1, parts.nombre2, parts.apellido1, parts.apellido2]
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function inicialesAlumno(parts: {
  nombre1?: string;
  apellido1?: string;
  nombreCompleto?: string;
}): string {
  const n = parts.nombreCompleto?.trim();
  if (n) {
    const bits = n.split(/\s+/).filter(Boolean);
    if (bits.length >= 2) return `${bits[0][0]}${bits[1][0]}`.toUpperCase();
    return bits[0]?.slice(0, 2).toUpperCase() || '?';
  }
  const a = (parts.apellido1 || '?').charAt(0);
  const b = (parts.nombre1 || '?').charAt(0);
  return `${b}${a}`.toUpperCase();
}

export function mayusculasNombre(v: string): string {
  return v.trim().toUpperCase().replace(/\s+/g, ' ');
}
