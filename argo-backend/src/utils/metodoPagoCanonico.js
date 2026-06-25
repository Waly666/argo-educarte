/** Medios de pago canónicos (misma presentación que caja / dashboard). */
const METODOS_PAGO_ORDEN = [
  'Efectivo',
  'Transferencia',
  'Tarjeta de crédito',
  'Tarjeta débito',
  'Cheque',
  'Nequi / Daviplata',
];

function normalizar(txt) {
  return String(txt ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Agrupa cualquier etiqueta (catálogo, formaPago guardada, etc.) en un medio canónico. */
function canonicoMetodoPago(texto) {
  const t = normalizar(texto);
  if (!t) return 'Efectivo';
  if (/nequi|daviplata|\bdavi\b/.test(t)) return 'Nequi / Daviplata';
  if (/efect|\bef\b/.test(t)) return 'Efectivo';
  if (/cheq/.test(t)) return 'Cheque';
  if (/debit|tarjeta debito/.test(t)) return 'Tarjeta débito';
  if (/credit|tarjeta de credito|tarjeta credito/.test(t)) return 'Tarjeta de crédito';
  if (/transf|consign|pse|banco/.test(t)) return 'Transferencia';
  return 'Otro';
}

function crearMapaMetodos() {
  const map = new Map();
  for (const label of METODOS_PAGO_ORDEN) {
    map.set(label, { forma: label, total: 0, cantidad: 0 });
  }
  map.set('Otro', { forma: 'Otro', total: 0, cantidad: 0 });
  return map;
}

function etiquetaIngresoMetodoPago(ing, porTipoPago) {
  const tipo = porTipoPago.get(String(ing.idTipoPago ?? ''));
  if (tipo) {
    return String(tipo.descripcion || tipo.nombre || ing.idTipoPago || '').trim();
  }
  const guardada = ing.formaPago && String(ing.formaPago).trim();
  if (guardada) return guardada;
  if (ing.tipoPagoDescr) return String(ing.tipoPagoDescr).trim();
  return String(ing.idTipoPago || '').trim();
}

function agregarIngresoAMetodos(map, ing, valor, porTipoPago) {
  const etiqueta = etiquetaIngresoMetodoPago(ing, porTipoPago);
  const canon = canonicoMetodoPago(etiqueta);
  const key = canon === 'Otro' ? 'Otro' : canon;
  const prev = map.get(key) || { forma: key, total: 0, cantidad: 0 };
  prev.total += valor;
  prev.cantidad += 1;
  map.set(key, prev);
}

function ingresosPorMetodoPagoLista(map, totalBase, roundMoney, pct) {
  const rows = METODOS_PAGO_ORDEN.map((label) => {
    const r = map.get(label) || { forma: label, total: 0, cantidad: 0 };
    return {
      forma: label,
      total: roundMoney(r.total),
      cantidad: r.cantidad,
      pct: pct(r.total, totalBase),
    };
  });
  const otro = map.get('Otro');
  if (otro && (otro.total > 0 || otro.cantidad > 0)) {
    rows.push({
      forma: 'Otro',
      total: roundMoney(otro.total),
      cantidad: otro.cantidad,
      pct: pct(otro.total, totalBase),
    });
  }
  return rows;
}

module.exports = {
  METODOS_PAGO_ORDEN,
  canonicoMetodoPago,
  crearMapaMetodos,
  etiquetaIngresoMetodoPago,
  agregarIngresoAMetodos,
  ingresosPorMetodoPagoLista,
};
