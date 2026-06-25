const { buscarProgramaCea } = require('./programacionCeaRastreo');
const {
  cargarIndiceClases,
  resolverIdClaseVehiculo,
} = require('./configRequisitosDocumentosVehiculos');
const { CATEGORIAS_LICENCIA_VEHICULO } = require('../constants/categoriasLicenciaVehiculo');

function extraerCategoriaLicencia(...textos) {
  for (const raw of textos) {
    const t = String(raw || '');
    const exact = t.match(/\b(A1|A2|B1|B2|B3|C1|C2|C3)\b/i);
    if (exact) return exact[1].toUpperCase();
    const loose = t.match(/\b([ABC])\s*(\d)\b/i);
    if (loose) return `${loose[1].toUpperCase()}${loose[2]}`;
  }
  return null;
}

async function categoriaLicenciaDesdePrograma(idProg) {
  const q = String(idProg ?? '').trim();
  if (!q) return null;
  const prog = await buscarProgramaCea(q);
  if (!prog) return null;
  return extraerCategoriaLicencia(prog.codigoProg, prog.nomCert, prog.nombreProg, prog.descripcion);
}

function normBool(v) {
  return v === true || v === 1 || v === '1' || v === 'true' || v === 'si' || v === 'Sí';
}

function clasePermiteCategoria(claseRow, categoria) {
  if (!claseRow || !categoria) return true;
  const cat = String(categoria).toUpperCase();
  if (!CATEGORIAS_LICENCIA_VEHICULO.includes(cat)) return true;
  return normBool(claseRow[cat]);
}

function resolverClaseVehiculoRow(vehiculo, indice) {
  const idCanon = resolverIdClaseVehiculo(vehiculo, indice);
  if (!idCanon || !indice?.byId) return null;
  return indice.byId.get(idCanon) || indice.byId.get(String(Number(idCanon))) || null;
}

async function filtrarVehiculosPorCategoriaLicencia(vehiculos, categoriaLicencia) {
  const cat = String(categoriaLicencia || '').trim().toUpperCase();
  if (!cat || !CATEGORIAS_LICENCIA_VEHICULO.includes(cat)) {
    return { vehiculos: vehiculos || [], categoriaLicencia: null };
  }
  const indice = await cargarIndiceClases();
  const filtrados = (vehiculos || []).filter((v) => {
    const claseRow = resolverClaseVehiculoRow(v, indice);
    if (!claseRow) return false;
    return clasePermiteCategoria(claseRow, cat);
  });
  return { vehiculos: filtrados, categoriaLicencia: cat };
}

module.exports = {
  CATEGORIAS_LICENCIA_VEHICULO,
  extraerCategoriaLicencia,
  categoriaLicenciaDesdePrograma,
  clasePermiteCategoria,
  filtrarVehiculosPorCategoriaLicencia,
};
