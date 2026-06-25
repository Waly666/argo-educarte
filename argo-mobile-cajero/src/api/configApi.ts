import { apiFetch } from './client';

export type PreviewServicioAdicionalItem = {
  reglaId?: string;
  idServ: string | number;
  descripcion: string;
  valor: number;
};

export async function previewMatriculaExtras(
  idPrograma: string,
  tarifa: number,
): Promise<{ items: PreviewServicioAdicionalItem[]; totalExtras: number }> {
  const q = new URLSearchParams({ idPrograma, tarifa: String(tarifa) });
  return apiFetch(`/config/servicios-adicionales/preview-matricula?${q}`);
}

export type OpcionesMatriculaConfig = {
  permitirAjusteValorMatricula?: boolean;
  permitirAjusteCuotasSemestre?: boolean;
};

export async function fetchOpcionesMatricula(): Promise<OpcionesMatriculaConfig> {
  return apiFetch<OpcionesMatriculaConfig>('/config/recibo/opciones-matricula');
}

export async function previewPagoExtras(
  idTipoPago: string,
  idLiquidaciones: string[],
): Promise<{ items: PreviewServicioAdicionalItem[]; totalExtras: number }> {
  return apiFetch('/config/servicios-adicionales/preview-pago', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idTipoPago, idLiquidaciones }),
  });
}
