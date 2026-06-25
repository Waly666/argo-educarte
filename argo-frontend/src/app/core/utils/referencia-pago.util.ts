function normalizar(txt: string): string {
  return String(txt ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function esFormaPagoEfectivo(texto?: string | null): boolean {
  const t = normalizar(String(texto ?? ''));
  if (!t) return true;
  return t === 'efectivo' || /\befect\b/.test(t) || t === 'ef';
}

/** Transferencia, cheque, tarjeta, Nequi, etc. */
export function requiereReferenciaPago(texto?: string | null): boolean {
  return !esFormaPagoEfectivo(texto);
}

export function referenciaPagoTexto(
  numTransferencia?: string | null,
  numComprobante?: string | null,
): string {
  return String(numTransferencia || numComprobante || '').trim();
}

/** Mismo criterio que referencia: todo pago no efectivo es intangible. */
export function requiereSoportePago(texto?: string | null): boolean {
  return requiereReferenciaPago(texto);
}
