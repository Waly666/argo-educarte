import { tieneSoportePago } from './pago-soporte.helpers';
import { requiereReferenciaPago } from './referencia-pago.util';

export interface PagoIntangibleInput {
  /** Etiqueta del tipo de pago o forma de pago. */
  tipoPago?: string | null;
  /** Atajo cuando ya se sabe que no es efectivo. */
  esIntangible?: boolean;
  referencia?: string | null;
  archivo?: File | null;
  urlSoporteExistente?: string | null;
}

export function esPagoIntangible(input: Pick<PagoIntangibleInput, 'tipoPago' | 'esIntangible'>): boolean {
  if (input.esIntangible === true) return true;
  if (input.esIntangible === false) return false;
  return requiereReferenciaPago(input.tipoPago);
}

export function validarPagoIntangible(
  input: PagoIntangibleInput,
): { ok: true } | { ok: false; message: string } {
  if (!esPagoIntangible(input)) return { ok: true };

  const ref = String(input.referencia || '').trim();
  const tieneImagen = tieneSoportePago({
    archivo: input.archivo,
    urlSoporte: input.urlSoporteExistente,
  });

  if (!ref && !tieneImagen) {
    return {
      ok: false,
      message:
        'No se puede procesar el pago: indique el número de referencia y adjunte el pantallazo del movimiento.',
    };
  }
  if (!ref) {
    return {
      ok: false,
      message: 'No se puede procesar el pago: indique el número de comprobante o referencia.',
    };
  }
  if (!tieneImagen) {
    return {
      ok: false,
      message:
        'No se puede procesar el pago: adjunte el pantallazo o imagen del movimiento (voucher, transferencia, cheque, etc.).',
    };
  }
  return { ok: true };
}

export function pagoIntangibleCompleto(input: PagoIntangibleInput): boolean {
  return validarPagoIntangible(input).ok;
}
