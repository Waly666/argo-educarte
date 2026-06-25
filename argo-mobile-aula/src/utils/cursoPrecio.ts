/** Etiquetas de precio alineadas al portal web: cursar gratis, pago para certificado. */

import type { CursoVirtual, EstadoInscripcionVirtual } from '../api/types';

export function fmtPrecioColombia(n: number): string {
  return `$${Math.max(0, n).toLocaleString('es-CO')}`;
}

export function etiquetaPrecioCatalogo(curso: Pick<CursoVirtual, 'tarifaVirtual' | 'requierePagoParaCursar'>) {
  const tarifa = curso.tarifaVirtual ?? 0;
  if (curso.requierePagoParaCursar && tarifa > 0) {
    return {
      badge: fmtPrecioColombia(tarifa),
      badgeTone: 'price' as const,
      hint: 'Pago para acceder al contenido',
    };
  }
  if (tarifa > 0) {
    return {
      badge: 'Curso gratis',
      badgeTone: 'free' as const,
      hint: `Certificado ${fmtPrecioColombia(tarifa)}`,
    };
  }
  return {
    badge: 'Gratis',
    badgeTone: 'free' as const,
    hint: 'Acceso sin costo',
  };
}

export function hintMatricula(curso: Pick<CursoVirtual, 'requierePagoParaCursar' | 'tarifaVirtual'>) {
  if (curso.requierePagoParaCursar) {
    return 'Tras matricularse deberá pagar en el CEA para acceder al contenido.';
  }
  if ((curso.tarifaVirtual ?? 0) > 0) {
    return 'Inscripción sin pago inicial. Puede estudiar ahora; el certificado requiere liquidar el valor del curso.';
  }
  return 'Matricúlese y comience el curso sin costo.';
}

export function hintMatriculado(ins: EstadoInscripcionVirtual, pasarelaActiva = false) {
  if (ins.pago?.pagado) {
    return 'Pago registrado. Certificado según reglas del curso.';
  }
  if (ins.accesoBloqueadoPago || ins.curso.requierePagoParaCursar) {
    if (pasarelaActiva) {
      return 'Matriculado. Complete el pago para acceder al contenido del curso.';
    }
    return 'Matriculado. Complete el pago en el CEA para acceder al contenido del curso.';
  }
  return 'Matriculado. Puede cursar sin pagar; el certificado se habilita al completar el pago.';
}

export function hintPagoEnLinea(modo: 'bloqueado' | 'opcional'): string {
  if (modo === 'bloqueado') {
    return 'Pago total del valor del curso. También puede pagar en el CEA.';
  }
  return 'Puede pagar ahora para habilitar el certificado cuando complete el curso.';
}
