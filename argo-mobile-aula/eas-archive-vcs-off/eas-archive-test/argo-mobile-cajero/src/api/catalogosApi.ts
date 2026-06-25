import { apiFetch } from './client';
import type { CatalogoItem } from './domain';
import {
  DISCAPACIDADES_DEF,
  ESTADOS_CIVIL_DEF,
  ESTRATOS_DEF,
  GENEROS_DEF,
  JORNADAS_DEF,
  MULTICULTURALIDAD_DEF,
  NIVEL_FORMACION_DEF,
  OCUPACIONES_DEF,
  REGIMEN_SALUD_DEF,
  TIPOS_DOC_DEF,
  TIPO_SANGRE_DEF,
  catalogoConFallback,
} from '../utils/alumnoCatalogo';

export type MunicipioItem = {
  codMunicipio: string;
  nombreMunicipio: string;
  codDepto?: string;
  nombreDepto?: string;
  label: string;
};

export async function listarCatalogo(name: string): Promise<CatalogoItem[]> {
  return apiFetch<CatalogoItem[]>(`/catalogos/${encodeURIComponent(name)}`);
}

async function catalogo(name: string, fallback: CatalogoItem[]): Promise<CatalogoItem[]> {
  try {
    const rows = await listarCatalogo(name);
    return catalogoConFallback(rows, fallback);
  } catch {
    return fallback;
  }
}

export async function fetchTiposDoc(): Promise<CatalogoItem[]> {
  return catalogo('catTipoDoc', TIPOS_DOC_DEF);
}

export async function fetchRegimenesSalud(): Promise<CatalogoItem[]> {
  return catalogo('catRegimenSalud', REGIMEN_SALUD_DEF);
}

export async function fetchCatalogosAlumno(): Promise<{
  tiposDoc: CatalogoItem[];
  generos: CatalogoItem[];
  tiposSangre: CatalogoItem[];
  jornadas: CatalogoItem[];
  estadosCivil: CatalogoItem[];
  estratos: CatalogoItem[];
  regimenesSalud: CatalogoItem[];
  nivelesFormacion: CatalogoItem[];
  ocupaciones: CatalogoItem[];
  discapacidades: CatalogoItem[];
  multiCulturalidades: CatalogoItem[];
}> {
  const [tiposDoc, regimenesSalud] = await Promise.all([
    fetchTiposDoc(),
    fetchRegimenesSalud(),
  ]);
  return {
    tiposDoc,
    generos: GENEROS_DEF,
    tiposSangre: TIPO_SANGRE_DEF,
    jornadas: JORNADAS_DEF,
    estadosCivil: ESTADOS_CIVIL_DEF,
    estratos: ESTRATOS_DEF,
    regimenesSalud,
    nivelesFormacion: NIVEL_FORMACION_DEF,
    ocupaciones: OCUPACIONES_DEF,
    discapacidades: DISCAPACIDADES_DEF,
    multiCulturalidades: MULTICULTURALIDAD_DEF,
  };
}

export async function buscarMunicipios(q: string, limit = 20): Promise<MunicipioItem[]> {
  const term = q.trim();
  if (!term) return [];
  return apiFetch<MunicipioItem[]>(
    `/catalogos/divipola/buscar?q=${encodeURIComponent(term)}&limit=${limit}`,
  );
}

export async function municipioPorCodigo(cod: string): Promise<MunicipioItem | null> {
  if (!cod.trim()) return null;
  try {
    return await apiFetch<MunicipioItem>(
      `/catalogos/divipola/municipio/${encodeURIComponent(cod.trim())}`,
    );
  } catch {
    return null;
  }
}

export const TIPOS_PAGO_DEF: CatalogoItem[] = [
  { idTipoPago: '1', codigo: 'EF', descripcion: 'Efectivo' },
  { idTipoPago: '2', codigo: 'TR', descripcion: 'Transferencia' },
  { idTipoPago: '3', codigo: 'TC', descripcion: 'Tarjeta crédito' },
  { idTipoPago: '4', codigo: 'TD', descripcion: 'Tarjeta débito' },
  { idTipoPago: '5', codigo: 'CH', descripcion: 'Cheque' },
  { idTipoPago: '6', codigo: 'NE', descripcion: 'Nequi / Daviplata' },
];

export async function fetchTiposPago(): Promise<CatalogoItem[]> {
  try {
    const rows = await listarCatalogo('catTipoPago');
    return rows.length ? rows : TIPOS_PAGO_DEF;
  } catch {
    return TIPOS_PAGO_DEF;
  }
}

export async function fetchTiposCapacitacion(): Promise<CatalogoItem[]> {
  try {
    return await listarCatalogo('catTipoCapacitacion');
  } catch {
    return [];
  }
}

export async function fetchTiposServicio(): Promise<CatalogoItem[]> {
  try {
    return await listarCatalogo('catTipServicio');
  } catch {
    return [];
  }
}

export async function fetchCuentasBancarias(): Promise<CatalogoItem[]> {
  try {
    return await listarCatalogo('cuentasBancarias');
  } catch {
    return [];
  }
}
