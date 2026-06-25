/** Etiqueta corta para alertas de saldo (semestres, horas práctica, etc.) */
export function etiquetaSaldoCorta(descripcion?: string | null, max = 34): string {
  const d = String(descripcion || 'Servicio').trim();
  const sem = d.match(/^(\d+\s+SEM\b)/i);
  if (sem) return sem[1].toUpperCase();
  if (/hora\s+clase\s+pr[aá]ctica/i.test(d)) {
    const rest = d.replace(/hora\s+clase\s+pr[aá]ctica/i, '').trim();
    if (!rest) return 'H. PRÁCTICA';
    const corto = rest.length > 20 ? `${rest.slice(0, 19)}…` : rest;
    return `H.PRÁCT. ${corto}`;
  }
  if (d.length <= max) return d;
  return `${d.slice(0, max - 1)}…`;
}

export function tituloSaldoItem(descripcion?: string | null, saldoFmt?: string): string {
  const d = String(descripcion || 'Servicio').trim();
  return saldoFmt ? `${d} · Saldo: ${saldoFmt}` : d;
}
