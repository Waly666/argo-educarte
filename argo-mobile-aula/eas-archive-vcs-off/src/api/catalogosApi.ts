import { apiFetch } from './client';

const B = '/aula-virtual/catalogos';

export interface DeptoDivipola {
  codDepto: string;
  nombreDepto: string;
}

export interface MunicipioDivipola {
  codMunicipio: string;
  nombreMunicipio: string;
  codDepto: string;
  nombreDepto: string;
  label: string;
}

export function fetchTiposDoc(): Promise<Record<string, unknown>[]> {
  return apiFetch(`${B}/tipos-doc`, { auth: false });
}

export function fetchGeneros(): Promise<Record<string, unknown>[]> {
  return apiFetch(`${B}/generos`, { auth: false });
}

export function fetchDepartamentos(): Promise<DeptoDivipola[]> {
  return apiFetch(`${B}/departamentos`, { auth: false });
}

export function fetchMunicipios(codDepto: string): Promise<MunicipioDivipola[]> {
  return apiFetch(`${B}/municipios/${encodeURIComponent(codDepto)}`, { auth: false });
}

export function buscarMunicipios(q: string, limit = 10): Promise<MunicipioDivipola[]> {
  return apiFetch(`${B}/municipios-buscar?q=${encodeURIComponent(q)}&limit=${limit}`, { auth: false });
}

export function fetchMunicipioPorCodigo(codMunicipio: string): Promise<MunicipioDivipola> {
  return apiFetch(`${B}/municipio/${encodeURIComponent(codMunicipio)}`, { auth: false });
}
