import { Linking } from 'react-native';

import { iniciarPagoEnLinea } from '../api/aulaApi';
import type { CursoVirtual, EstadoInscripcionVirtual, PagoEnLineaRes } from '../api/types';

export type ModoPagoCurso = 'pagado' | 'bloqueado' | 'opcional' | 'sin_deuda';

/** ¿Hay saldo o certificado pendiente de pago? */
export function tienePagoPendiente(
  ins: EstadoInscripcionVirtual,
  curso: Pick<CursoVirtual, 'requierePagoParaCursar' | 'tarifaVirtual'>,
): boolean {
  if (ins.pago?.pagado) return false;
  if (ins.certificadoPendientePago) return true;
  if (ins.accesoBloqueadoPago) return true;
  if (ins.curso.requierePagoParaCursar || curso.requierePagoParaCursar) return true;
  if (ins.pago?.tieneLiquidacion && !ins.pago.pagado) return true;
  if ((curso.tarifaVirtual ?? ins.curso.tarifaVirtual ?? 0) > 0 && ins.matriculado) return true;
  return false;
}

/** Misma lógica que curso-detalle del portal web. */
export function modoPagoInscripcion(
  ins: EstadoInscripcionVirtual,
  curso: Pick<CursoVirtual, 'requierePagoParaCursar' | 'tarifaVirtual'>,
): ModoPagoCurso {
  if (ins.pago?.pagado) return 'pagado';
  const bloqueado = !!(
    ins.accesoBloqueadoPago ||
    ins.curso.requierePagoParaCursar ||
    curso.requierePagoParaCursar
  );
  if (bloqueado) return 'bloqueado';
  if (tienePagoPendiente(ins, curso)) return 'opcional';
  return 'sin_deuda';
}

export function puedeMostrarPagoEnLinea(
  ins: EstadoInscripcionVirtual,
  curso: Pick<CursoVirtual, 'requierePagoParaCursar' | 'tarifaVirtual'>,
): boolean {
  return tienePagoPendiente(ins, curso);
}

export async function abrirPagoEnLineaCurso(
  idPrograma: string | number,
  redirectUrl?: string,
): Promise<PagoEnLineaRes> {
  const res = await iniciarPagoEnLinea(idPrograma, redirectUrl);
  if (!res.checkoutUrl?.trim()) {
    throw new Error('No se pudo iniciar el pago en línea.');
  }
  const url = res.checkoutUrl.trim();
  await Linking.openURL(url);
  return res;
}
