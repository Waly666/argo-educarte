import { apiFetch } from './client';
import { formatNumDoc } from '../utils/format';
import type { TarifaMatricula } from '../utils/matricula';

export type MatriculaCrearBody = {
  numDoc: string | number;
  idPrograma: string;
  tarifa?: TarifaMatricula;
  tarifaManual?: boolean;
  ajustarValor?: boolean;
  valorAcordado?: number;
  motivoAjuste?: string;
  ajustarCuotasSemestre?: boolean;
  valoresCuotasSemestre?: number[];
  motivoAjusteCuotas?: string;
  crearUsuarioPortal?: boolean;
  email?: string;
  password?: string;
};

export type CuotaSemestreItem = {
  idLiquidacion: string;
  semestre: number;
  idServ?: string | null;
  descripcion: string;
  valorCatalogo: number;
  valor: number;
  abonado: number;
  saldo: number;
  estado?: string;
};

export type CuotasSemestreInfo = {
  permitido: boolean;
  configHabilitada?: boolean;
  motivo?: string;
  idMatricula?: string;
  idPrograma?: string;
  programaNombre?: string;
  tarifa?: number;
  numDoc?: number | string;
  valorMatricula?: number;
  cuotas?: CuotaSemestreItem[];
  extras?: { idLiquidacion: string; descripcion: string; valor: number; abonado: number; saldo: number }[];
  totales?: { cuotas: number; extras: number; matricula: number };
};

export type MatriculaAlumnoRow = {
  _id: string;
  tarifa?: number;
  valorMat?: number;
  pagada?: string;
  idProg?: string;
  idPrograma?: string;
};

export async function crearMatricula(body: MatriculaCrearBody): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>('/matriculas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...body,
      numDoc: formatNumDoc(body.numDoc),
    }),
  });
}

export async function listarMatriculasAlumno(numDoc: string | number): Promise<MatriculaAlumnoRow[]> {
  return apiFetch<MatriculaAlumnoRow[]>(
    `/matriculas/alumno/${encodeURIComponent(formatNumDoc(numDoc))}`,
  );
}

export async function obtenerCuotasSemestre(idMatricula: string): Promise<CuotasSemestreInfo> {
  return apiFetch<CuotasSemestreInfo>(`/matriculas/${encodeURIComponent(idMatricula)}/cuotas-semestre`);
}

export async function actualizarCuotasSemestre(
  idMatricula: string,
  body: {
    cuotas?: { idLiquidacion: string; valor: number }[];
    valoresCuotasSemestre?: number[];
    motivoAjuste?: string;
  },
): Promise<CuotasSemestreInfo> {
  return apiFetch<CuotasSemestreInfo>(`/matriculas/${encodeURIComponent(idMatricula)}/cuotas-semestre`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
