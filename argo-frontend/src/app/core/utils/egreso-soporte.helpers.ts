export function tieneSoporteEgreso(e?: { urlSoporte?: string | null } | null): boolean {
  return !!String(e?.urlSoporte || '').trim();
}

export function tituloSoporteEgreso(e: {
  numRecibo?: string | null;
  concepto?: string;
  pagueA?: string | null;
}): string {
  const ref = e.numRecibo || e.concepto || e.pagueA || 'egreso';
  return `Sin soporte adjunto — ${ref}. Suba imagen de factura, voucher o comprobante.`;
}
