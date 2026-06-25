const Cliente = require('../models/Cliente');

/** Mínimo de caracteres para coincidencia parcial (evita falsos positivos). */
const MIN_PARCIAL = 4;

function claveComparacion(texto) {
  return String(texto || '')
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase();
}

function camposNombreCliente(cli) {
  return [
    cli?.razonSocial,
    cli?.nombreComercial,
    cli?.nombres,
    cli?.identificacion,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
}

/** Igual exacta o parcial (una contiene a la otra), sin importar mayúsculas/tildes. */
function nombresCoinciden(textoObs, nombreCliente) {
  const a = claveComparacion(textoObs);
  const b = claveComparacion(nombreCliente);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= MIN_PARCIAL && b.includes(a)) return true;
  if (b.length >= MIN_PARCIAL && a.includes(b)) return true;
  return false;
}

/** Partes a probar: texto completo y segmentos separados por | ; , */
function segmentosObservaciones(texto) {
  const full = String(texto || '').trim();
  if (!full) return [];
  const partes = full
    .split(/\s*\|\s*|[;,]\s*|\s+-\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_PARCIAL);
  return [...new Set([full, ...partes])];
}

function clientesQueCoinciden(texto, clientes = []) {
  const segmento = String(texto || '').trim();
  if (!segmento) return [];
  return clientes.filter((cli) =>
    camposNombreCliente(cli).some((nombre) => nombresCoinciden(segmento, nombre)),
  );
}

/**
 * Prueba cada segmento de observaciones; devuelve el cliente si hay exactamente uno.
 * Si un segmento produce 0 o >1 coincidencias, prueba el siguiente.
 */
function buscarClienteUnicoDesdeObservaciones(observaciones, clientes = []) {
  for (const segmento of segmentosObservaciones(observaciones)) {
    const matches = clientesQueCoinciden(segmento, clientes);
    if (matches.length === 1) {
      return { cliente: matches[0], segmentoUsado: segmento };
    }
  }
  return null;
}

function buscarClienteUnicoPorNombreEnLista(texto, clientes = []) {
  const res = buscarClienteUnicoDesdeObservaciones(texto, clientes);
  return res?.cliente || null;
}

async function buscarClienteUnicoPorNombre(texto) {
  const clientes = await Cliente.find({ activo: { $ne: false } })
    .select('_id razonSocial nombreComercial nombres identificacion activo')
    .lean();
  return buscarClienteUnicoPorNombreEnLista(texto, clientes);
}

async function resolverEmpresaIdDesdeObservaciones(observaciones, clientesPrecargados = null) {
  const clientes = clientesPrecargados
    || await Cliente.find({ activo: { $ne: false } })
      .select('_id razonSocial nombreComercial nombres identificacion activo')
      .lean();
  const res = buscarClienteUnicoDesdeObservaciones(observaciones, clientes);
  return res?.cliente?._id || null;
}

module.exports = {
  MIN_PARCIAL,
  claveComparacion,
  camposNombreCliente,
  nombresCoinciden,
  segmentosObservaciones,
  clientesQueCoinciden,
  buscarClienteUnicoDesdeObservaciones,
  buscarClienteUnicoPorNombreEnLista,
  buscarClienteUnicoPorNombre,
  resolverEmpresaIdDesdeObservaciones,
};
