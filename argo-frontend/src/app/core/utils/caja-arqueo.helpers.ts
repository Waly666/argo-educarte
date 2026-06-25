import {
  ArqueoLinea,
  DENOMINACIONES_ARQUEO,
} from '../constants/caja-arqueo.constants';

export function crearLineasArqueoVacias(): ArqueoLinea[] {
  return DENOMINACIONES_ARQUEO.map((d) => ({
    denominacion: d.valor,
    cantidad: 0,
    tipo: d.tipo,
    etiqueta: d.etiqueta,
    subtotal: 0,
  }));
}

export function normalizarLineasArqueo(lineas: ArqueoLinea[] | null | undefined): ArqueoLinea[] {
  const base = crearLineasArqueoVacias();
  if (!lineas?.length) return base;
  const map = new Map(
    lineas.map((l) => [`${l.denominacion}-${l.tipo}`, l]),
  );
  return base.map((b) => {
    const found = map.get(`${b.denominacion}-${b.tipo}`);
    const cantidad = Math.max(0, Math.round(Number(found?.cantidad) || 0));
    return {
      ...b,
      cantidad,
      subtotal: b.denominacion * cantidad,
    };
  });
}

export function totalArqueo(lineas: ArqueoLinea[]): number {
  return normalizarLineasArqueo(lineas).reduce((s, l) => s + (l.subtotal ?? 0), 0);
}

export function lineasArqueoConSubtotal(lineas: ArqueoLinea[]): ArqueoLinea[] {
  return normalizarLineasArqueo(lineas);
}
