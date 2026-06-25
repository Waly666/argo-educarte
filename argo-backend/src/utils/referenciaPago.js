function normalizar(txt) {
  return String(txt ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function esFormaPagoEfectivo(formaPago) {
  const t = normalizar(formaPago);
  if (!t) return true;
  return t === 'efectivo' || /\befect\b/.test(t);
}

/** Transferencia, cheque, tarjeta, Nequi, etc. requieren número de comprobante o referencia. */
function requiereReferenciaPago(formaPago) {
  return !esFormaPagoEfectivo(formaPago);
}

function referenciaPagoTexto(numTransferencia, numComprobante) {
  const v = String(numTransferencia || numComprobante || '').trim();
  return v || null;
}

function validarReferenciaPagoIngreso(pago) {
  if (!pago || pago.esEfectivo) return { ok: true };
  const ref = referenciaPagoTexto(pago.numTransferencia, pago.numComprobante);
  if (!ref) {
    return {
      ok: false,
      status: 400,
      message:
        'Indique el número de comprobante o referencia del pago (transferencia, cheque, tarjeta, Nequi, etc.)',
    };
  }
  return { ok: true };
}

function validarReferenciaPagoEgreso(dto) {
  if (!dto?.formaPago || esFormaPagoEfectivo(dto.formaPago)) return { ok: true };
  const ref = referenciaPagoTexto(dto.numTransferencia, dto.numComprobante);
  if (!ref) {
    return {
      ok: false,
      status: 400,
      message:
        'Indique el número de comprobante o referencia del pago (transferencia, cheque, tarjeta, etc.)',
    };
  }
  return { ok: true };
}

function esPagoIntangible(formaPagoOrPago) {
  if (formaPagoOrPago && typeof formaPagoOrPago === 'object' && 'esEfectivo' in formaPagoOrPago) {
    return !formaPagoOrPago.esEfectivo;
  }
  return requiereReferenciaPago(formaPagoOrPago);
}

function validarSoportePagoIntangible(formaPagoOrPago, urlSoporte) {
  if (!esPagoIntangible(formaPagoOrPago)) return { ok: true };
  if (String(urlSoporte || '').trim()) return { ok: true };
  return {
    ok: false,
    status: 400,
    message:
      'No se puede procesar el pago: adjunte el pantallazo o imagen del movimiento (voucher, transferencia, cheque, etc.).',
  };
}

/** Referencia + soporte obligatorios para pagos no efectivo. */
function validarPagoIntangibleIngreso(pago, urlSoporte) {
  if (!pago || pago.esEfectivo) return { ok: true };
  const ref = referenciaPagoTexto(pago.numTransferencia, pago.numComprobante);
  const sop = String(urlSoporte || '').trim();
  const faltan = [];
  if (!ref) faltan.push('número de referencia');
  if (!sop) faltan.push('pantallazo o imagen del movimiento');
  if (!faltan.length) return { ok: true };
  return {
    ok: false,
    status: 400,
    message: `No se puede procesar el pago: falta ${faltan.join(' y ')}.`,
  };
}

function validarPagoIntangibleEgreso(dto, urlSoporte) {
  if (!dto?.formaPago || esFormaPagoEfectivo(dto.formaPago)) return { ok: true };
  const ref = referenciaPagoTexto(dto.numTransferencia, dto.numComprobante);
  const sop = String(urlSoporte || '').trim();
  const faltan = [];
  if (!ref) faltan.push('número de referencia');
  if (!sop) faltan.push('pantallazo o imagen del movimiento');
  if (!faltan.length) return { ok: true };
  return {
    ok: false,
    status: 400,
    message: `No se puede procesar el pago: falta ${faltan.join(' y ')}.`,
  };
}

module.exports = {
  esFormaPagoEfectivo,
  requiereReferenciaPago,
  referenciaPagoTexto,
  validarReferenciaPagoIngreso,
  validarReferenciaPagoEgreso,
  esPagoIntangible,
  validarSoportePagoIntangible,
  validarPagoIntangibleIngreso,
  validarPagoIntangibleEgreso,
};
