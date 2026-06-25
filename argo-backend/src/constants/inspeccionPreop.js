/** Tipos de vehículo para ítems de inspección (alineado con catálogo claseVehiculo.descripcion). */
const CLASES_VEHICULO_INSPECCION = [
  'AUTOMOVIL',
  'BUS',
  'BUSETA',
  'CAMION',
  'CAMIONETA',
  'CAMPERO',
  'MICROBUS',
  'TRACTOCAMION',
  'MOTOCICLETA',
  'MAQ.AGRICOLA',
  'MAQ.INDUSTRIAL',
  'BICICLETA',
  'MOTOCARRO',
  'TRACCION ANIMAL',
  'MOTOTRICICLO',
  'CUATRIMOTO',
  'REMOLQUE',
  'SEMIREMOLQUE',
];

/** Claves internas de característica → sección del formulario / API. */
const CARACTERISTICA_SECCIONES = {
  estadoGeneral: 'estadoGeneral',
  'estado general': 'estadoGeneral',
  aspecto1: 'aspecto1',
  'aspecto 1': 'aspecto1',
  aspecto2: 'aspecto2',
  'aspecto 2': 'aspecto2',
  adaptaciones: 'adaptaciones',
  adaptacion: 'adaptaciones',
};

const SECCION_ETIQUETAS = {
  estadoGeneral: 'Estado general del vehículo',
  aspecto1: 'Emergencias, primeros auxilios y otros',
  aspecto2: 'Seguridad activa y pasiva',
  adaptaciones: 'Adaptaciones y estado técnico',
};

const SECCIONES_ORDEN = ['estadoGeneral', 'adaptaciones', 'aspecto1', 'aspecto2'];

const PRIMERA_REVISION = 'Primera revisión';

function normClaseVehiculoInspeccion(raw) {
  const t = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  if (!t) return '';
  if (CLASES_VEHICULO_INSPECCION.includes(t)) return t;
  const alias = {
    AUTOMÓVIL: 'AUTOMOVIL',
    'MAQ. AGRICOLA': 'MAQ.AGRICOLA',
    'MAQ. INDUSTRIAL': 'MAQ.INDUSTRIAL',
    'TRACCIÓN ANIMAL': 'TRACCION ANIMAL',
  };
  return alias[t] || t;
}

function seccionDesdeCaracteristica(caracteristica) {
  const k = String(caracteristica ?? '')
    .trim()
    .toLowerCase();
  return CARACTERISTICA_SECCIONES[k] || null;
}

function seccionesVacias() {
  return {
    estadoGeneral: [],
    aspecto1: [],
    aspecto2: [],
    adaptaciones: [],
  };
}

module.exports = {
  CLASES_VEHICULO_INSPECCION,
  CARACTERISTICA_SECCIONES,
  SECCION_ETIQUETAS,
  SECCIONES_ORDEN,
  PRIMERA_REVISION,
  normClaseVehiculoInspeccion,
  seccionDesdeCaracteristica,
  seccionesVacias,
};
