/** Denominaciones COP para arqueo de caja (billetes y monedas). */
export interface DenominacionArqueo {
  valor: number;
  tipo: 'billete' | 'moneda';
  etiqueta: string;
}

export const DENOMINACIONES_ARQUEO: DenominacionArqueo[] = [
  { valor: 100000, tipo: 'billete', etiqueta: '$ 100.000' },
  { valor: 50000, tipo: 'billete', etiqueta: '$ 50.000' },
  { valor: 20000, tipo: 'billete', etiqueta: '$ 20.000' },
  { valor: 10000, tipo: 'billete', etiqueta: '$ 10.000' },
  { valor: 5000, tipo: 'billete', etiqueta: '$ 5.000' },
  { valor: 2000, tipo: 'billete', etiqueta: '$ 2.000' },
  { valor: 1000, tipo: 'billete', etiqueta: '$ 1.000 (billete)' },
  { valor: 1000, tipo: 'moneda', etiqueta: '$ 1.000 (moneda)' },
  { valor: 500, tipo: 'moneda', etiqueta: '$ 500' },
  { valor: 200, tipo: 'moneda', etiqueta: '$ 200' },
  { valor: 100, tipo: 'moneda', etiqueta: '$ 100' },
  { valor: 50, tipo: 'moneda', etiqueta: '$ 50' },
];

export interface ArqueoLinea {
  denominacion: number;
  cantidad: number;
  tipo: 'billete' | 'moneda';
  etiqueta?: string;
  subtotal?: number;
}
