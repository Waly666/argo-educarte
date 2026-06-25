/** Nombres de campo que representan dinero (pesos COP). */
const MONEY_KEY =
  /^(valor|saldo|abonado|tarifa\d*|valorMat|valorMatricula|valorEgreso|valorUnitario|salario|salarioBase|netoPagar|ibc|tarifaHoraPractica)$/i;

const MONEY_TOTAL_KEY = /^total(Devengos|Deducciones|Neto|Patronal|Provisiones|CostoEmpresa)$/i;

/** Códigos alfanuméricos que no deben ser input type=number. */
const STRING_ID_KEYS = new Set(['idSede']);

/** Enteros: horas, cantidades, IDs, porcentaje IVA, etc. */
const INT_KEY =
  /^(cantidad|semestres|horas|horasTeoria|horasPractica|horasTaller|diasVencimiento|nivelRiesgo|horasSemanales|diasNovedad|numSemestre|iva|consecutivo|idServ|idProg|idPrograma|id[A-Z])/i;

export function isMoneyField(name: string): boolean {
  const k = String(name || '');
  return MONEY_KEY.test(k) || MONEY_TOTAL_KEY.test(k);
}

export function isIntegerField(name: string): boolean {
  const k = String(name || '');
  if (isMoneyField(k) || STRING_ID_KEYS.has(k)) return false;
  return INT_KEY.test(k);
}

export function isNumericField(name: string): boolean {
  return isMoneyField(name) || isIntegerField(name);
}

export function inputTypeForField(name: string): 'number' | 'text' {
  return isNumericField(name) ? 'number' : 'text';
}

export function coerceNumberInput(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function formatMoneyCell(v: unknown): string {
  const n = coerceNumberInput(v);
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}

export function formatNumericCell(campo: string, v: unknown): string {
  if (v == null || v === '') return '—';
  if (isMoneyField(campo)) return formatMoneyCell(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
