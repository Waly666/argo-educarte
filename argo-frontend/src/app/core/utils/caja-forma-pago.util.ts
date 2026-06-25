/** Forma de pago: prioriza etiqueta del catálogo (tipoPagoDescr / idTipoPago). */
export function resolverFormaPagoIngreso(i: {
  formaPago?: string;
  tipoPagoDescr?: string;
  idTipoPago?: string | null;
}): string {
  const descr = i.tipoPagoDescr && String(i.tipoPagoDescr).trim();
  if (descr && descr !== '—') return descr;
  const guardada = i.formaPago && String(i.formaPago).trim();
  if (guardada && guardada !== '—') return guardada;
  const id = String(i.idTipoPago ?? '').trim();
  const txt = `${descr || ''} ${id}`.toLowerCase();
  if (txt.includes('efect') || txt === 'ef' || id === '1') return 'Efectivo';
  if (txt.includes('cheq')) return 'Cheque';
  if (txt.includes('débit') || txt.includes('debit')) return 'Tarjeta debito';
  if (txt.includes('créd') || txt.includes('credi')) return 'Tarjeta de Credito';
  if (txt.includes('nequi') || txt.includes('davi')) return 'Nequi / Daviplata';
  if (txt.includes('transf') || txt.includes('consign') || txt.includes('pse')) return 'Transferencia';
  if (i.tipoPagoDescr && String(i.tipoPagoDescr).trim()) return String(i.tipoPagoDescr).trim();
  return id ? `Tipo pago ${id}` : 'Efectivo';
}
