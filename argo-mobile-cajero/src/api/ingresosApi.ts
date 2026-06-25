import { apiFetch, apiPostForm } from './client';
import type { IngresoCrearDto, IngresoRow } from './domain';
import type { SoportePago } from '../utils/pago';
import { formatNumDoc } from '../utils/format';

function payloadIngreso(dto: IngresoCrearDto): IngresoCrearDto {
  return { ...dto, numDoc: formatNumDoc(dto.numDoc) };
}

function toFormData(dto: IngresoCrearDto, soporte: SoportePago): FormData {
  const fd = new FormData();
  const payload = payloadIngreso(dto);
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined || v === null || v === '') continue;
    if (k === 'items' && Array.isArray(v)) {
      fd.append(k, JSON.stringify(v));
      continue;
    }
    fd.append(k, String(v));
  }
  fd.append('soporte', {
    uri: soporte.uri,
    name: soporte.name,
    type: soporte.type,
  } as unknown as Blob);
  return fd;
}

export async function crearIngreso(
  dto: IngresoCrearDto,
  soporte?: SoportePago | null,
): Promise<IngresoRow> {
  const payload = payloadIngreso(dto);
  if (soporte) {
    return apiPostForm<IngresoRow>('/ingresos', toFormData(payload, soporte));
  }
  return apiFetch<IngresoRow>('/ingresos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function listarIngresosAlumno(numDoc: string | number): Promise<IngresoRow[]> {
  return apiFetch<IngresoRow[]>(
    `/ingresos/alumno/${encodeURIComponent(formatNumDoc(numDoc))}`,
  );
}

export function reciboIngresoHtmlPath(idIngreso: string): string {
  return `/ingresos/${encodeURIComponent(idIngreso)}/recibo/html?v=${Date.now()}`;
}
