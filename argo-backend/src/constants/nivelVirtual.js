const NIVELES_VIRTUAL = ['PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO'];

function normalizarNivelVirtual(raw) {
  const v = String(raw || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return NIVELES_VIRTUAL.includes(v) ? v : null;
}

module.exports = { NIVELES_VIRTUAL, normalizarNivelVirtual };
