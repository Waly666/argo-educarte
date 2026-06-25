import { RrhhCatalogConfig } from './rrhh-catalog.types';

export interface RrhhCatalogTab {
  id: string;
  label: string;
  grupo: 'organizacion' | 'seguridad';
  config: RrhhCatalogConfig;
}

const estadoOpts = [  { value: 'activo', label: 'Activo' },
  { value: 'inactivo', label: 'Inactivo' },
];

export const CARGOS_CONFIG: RrhhCatalogConfig = {
  titulo: 'Cargos',
  hint: 'Catálogo de cargos — créelos dinámicamente y asígnelos a empleados.',
  apiPath: 'cargos',
  idKey: 'idCargo',
  labelKey: 'nombre',
  fields: [
    { key: 'nombre', label: 'Nombre', required: true, col: 6 },
    { key: 'nivel', label: 'Nivel', col: 3 },
    { key: 'salarioBase', label: 'Salario base', type: 'number', col: 3 },
    { key: 'descripcion', label: 'Descripción', type: 'textarea', col: 12 },
    { key: 'estado', label: 'Estado', type: 'select', options: estadoOpts, col: 3 },
  ],
  columns: [
    { key: 'idCargo', label: 'Id' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'nivel', label: 'Nivel' },
    { key: 'salarioBase', label: 'Salario base' },
    { key: 'estado', label: 'Estado' },
  ],
};

export const DEPARTAMENTOS_CONFIG: RrhhCatalogConfig = {
  titulo: 'Departamentos',
  apiPath: 'departamentos',
  idKey: 'idDepartamento',
  fields: [
    { key: 'nombre', label: 'Nombre', required: true, col: 6 },
    { key: 'descripcion', label: 'Descripción', type: 'textarea', col: 12 },
    { key: 'estado', label: 'Estado', type: 'select', options: estadoOpts, col: 3 },
  ],
  columns: [
    { key: 'idDepartamento', label: 'Id' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'estado', label: 'Estado' },
  ],
};

const entidadSalud: Omit<RrhhCatalogConfig, 'titulo' | 'apiPath' | 'idKey'> = {
  labelKey: 'nombre',
  fields: [
    { key: 'nombre', label: 'Nombre', required: true, col: 6 },
    { key: 'nit', label: 'NIT', col: 3 },
    { key: 'telefono', label: 'Teléfono', col: 3 },
    { key: 'estado', label: 'Estado', type: 'select', options: estadoOpts, col: 3 },
  ],
  columns: [
    { key: 'idEps', label: 'Id' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'nit', label: 'NIT' },
    { key: 'estado', label: 'Estado' },
  ],
};

export const EPS_CONFIG: RrhhCatalogConfig = {
  titulo: 'EPS',
  apiPath: 'eps',
  idKey: 'idEps',
  ...entidadSalud,
  columns: [
    { key: 'idEps', label: 'Id' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'nit', label: 'NIT' },
    { key: 'estado', label: 'Estado' },
  ],
};

export const AFP_CONFIG: RrhhCatalogConfig = {
  titulo: 'AFP',
  apiPath: 'afp',
  idKey: 'idAfp',
  ...entidadSalud,
  columns: [
    { key: 'idAfp', label: 'Id' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'nit', label: 'NIT' },
    { key: 'estado', label: 'Estado' },
  ],
};

export const ARL_CONFIG: RrhhCatalogConfig = {
  titulo: 'ARL',
  apiPath: 'arl',
  idKey: 'idArl',
  labelKey: 'nombre',
  fields: [
    { key: 'nombre', label: 'Nombre', required: true, col: 6 },
    { key: 'nit', label: 'NIT', col: 3 },
    { key: 'nivelRiesgo', label: 'Nivel riesgo', type: 'number', col: 3 },
    { key: 'telefono', label: 'Teléfono', col: 3 },
    { key: 'estado', label: 'Estado', type: 'select', options: estadoOpts, col: 3 },
  ],
  columns: [
    { key: 'idArl', label: 'Id' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'nivelRiesgo', label: 'Riesgo' },
    { key: 'estado', label: 'Estado' },
  ],
};

export const CAJAS_CONFIG: RrhhCatalogConfig = {
  titulo: 'Cajas de compensación',
  hint: 'CCF — requerida en ficha del empleado y en PILA.',
  apiPath: 'cajas-compensacion',
  idKey: 'idCajaCompensacion',
  ...entidadSalud,
  columns: [
    { key: 'idCajaCompensacion', label: 'Id' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'nit', label: 'NIT' },
    { key: 'estado', label: 'Estado' },
  ],
};

export const RRHH_CATALOG_TABS: RrhhCatalogTab[] = [
  { id: 'cargos', label: 'Cargos', grupo: 'organizacion', config: CARGOS_CONFIG },
  { id: 'departamentos', label: 'Departamentos', grupo: 'organizacion', config: DEPARTAMENTOS_CONFIG },
  { id: 'eps', label: 'EPS', grupo: 'seguridad', config: EPS_CONFIG },
  { id: 'afp', label: 'AFP', grupo: 'seguridad', config: AFP_CONFIG },
  { id: 'arl', label: 'ARL', grupo: 'seguridad', config: ARL_CONFIG },
  { id: 'cajas', label: 'Cajas CCF', grupo: 'seguridad', config: CAJAS_CONFIG },
];

export function catalogConfigByTab(tabId: string | null | undefined): RrhhCatalogConfig | null {
  const t = RRHH_CATALOG_TABS.find((x) => x.id === tabId);
  return t?.config ?? null;
}