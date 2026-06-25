const FRECUENCIAS_ALERTA_PAGO = ['quincenal', 'mensual'];

function normalizarFrecuenciaAlertaPago(value) {
  const f = String(value || '').trim().toLowerCase();
  return FRECUENCIAS_ALERTA_PAGO.includes(f) ? f : null;
}

module.exports = {
  FRECUENCIAS_ALERTA_PAGO,
  normalizarFrecuenciaAlertaPago,
};
