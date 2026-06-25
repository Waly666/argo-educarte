/** Cuándo se aplica un servicio adicional configurado. */
const MOMENTO_MATRICULA = 'matricula';
const MOMENTO_PAGO = 'pago';

const MOMENTOS = [MOMENTO_MATRICULA, MOMENTO_PAGO];

const ETIQUETAS_MOMENTO = {
  [MOMENTO_MATRICULA]: 'Al matricular',
  [MOMENTO_PAGO]: 'Al cobrar (recibo)',
};

module.exports = {
  MOMENTO_MATRICULA,
  MOMENTO_PAGO,
  MOMENTOS,
  ETIQUETAS_MOMENTO,
};
