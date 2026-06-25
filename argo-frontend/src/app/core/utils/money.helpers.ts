/** Lee monto desde number, string o BSON Decimal128 (`$numberDecimal`). */
export function parseMoneyValue(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'object') {
    const o = value as { $numberDecimal?: string; _bsontype?: string; toString?: () => string };
    if (o.$numberDecimal != null) {
      const n = Number(o.$numberDecimal);
      return Number.isFinite(n) ? n : null;
    }
    if (o._bsontype === 'Decimal128' && typeof o.toString === 'function') {
      const n = Number(o.toString());
      return Number.isFinite(n) ? n : null;
    }
  }
  const n = Number(String(value).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function formatMoneyValue(value: unknown): string {
  const n = parseMoneyValue(value);
  return n == null ? '—' : String(n);
}
