const TIPOS_SERVICIO = ['OFICIAL', 'PUBLICO', 'PARTICULAR', 'DIPLOMATICO'];
const MODALIDADES = ['CARGA', 'PASAJEROS', 'MIXTO'];
const COMBUSTIBLES = [
  'GASOLINA',
  'A.C.P.M.',
  'GAS NATURAL VEHICULAR',
  'GAS - GASOLINA',
  'ELECTRICO',
];
const ESTADOS_VEHICULO = ['Libre', 'Ocupado'];

function normalizarPlaca(v) {
  return String(v || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '');
}

function parseCarrocerias(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  TIPOS_SERVICIO,
  MODALIDADES,
  COMBUSTIBLES,
  ESTADOS_VEHICULO,
  normalizarPlaca,
  parseCarrocerias,
};
