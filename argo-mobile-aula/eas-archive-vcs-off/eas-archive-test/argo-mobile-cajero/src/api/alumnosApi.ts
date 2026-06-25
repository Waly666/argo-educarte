import { apiFetch, apiPostForm, apiPutForm } from './client';
import type { AlumnoCrearDto, AlumnoDetalleItem, AlumnoDocVerificacion, AlumnoListItem, AlumnosListResponse } from './domain';
import { formatNumDoc } from '../utils/format';
import { normalizarTipoAlumno } from '../utils/alumnoCatalogo';
import type { SoportePago } from '../utils/pago';

export type AlumnoArchivos = {
  foto?: SoportePago | null;
  cedula?: SoportePago | null;
  licencia?: SoportePago | null;
};

export type CedulaOcrResponse = {
  sugerido: Partial<AlumnoCrearDto & { genero?: string; tipoSangre?: string }>;
  meta?: { advertencias?: string[] };
};

function appendFormField(fd: FormData, k: string, v: unknown) {
  if (v === undefined || v === null) return;
  if (k === 'alertaPago' || k === 'alertaPagoFrecuencia') {
    fd.append(k, String(v ?? ''));
    return;
  }
  if (String(v) === '') return;
  fd.append(k, String(v));
}

function toFormData(dto: AlumnoCrearDto, files?: AlumnoArchivos): FormData {
  const fd = new FormData();
  const numDoc = formatNumDoc(dto.numDoc);
  const payload: Record<string, unknown> = {
    ...dto,
    numDoc,
    tipoAlumno: normalizarTipoAlumno(dto.tipoAlumno),
    tipoDoc: dto.tipoDoc || '1',
    munOrigen: dto.munOrigen || dto.codMunicipio || '',
    codMunicipio: dto.codMunicipio || dto.munOrigen || '',
    discapacidad: dto.discapacidad || '9',
    multiCulturalidad: dto.multiCulturalidad || 'NO_APLICA',
    alertaPagoFrecuencia: dto.alertaPagoFrecuencia || '',
    alertaPago: dto.alertaPago || '',
    empresaId: dto.empresaId ?? '',
  };
  if (payload.tipoAlumno === 'Jornadas de Capacitación') {
    payload.esJornadaCap = 'true';
  }
  for (const [k, v] of Object.entries(payload)) {
    if (k === 'esJornadaCap' && !v) continue;
    appendFormField(fd, k, v);
  }
  if (files?.foto) {
    fd.append('foto', {
      uri: files.foto.uri,
      name: files.foto.name,
      type: files.foto.type,
    } as unknown as Blob);
  }
  if (files?.cedula) {
    fd.append('cedula', {
      uri: files.cedula.uri,
      name: files.cedula.name,
      type: files.cedula.type,
    } as unknown as Blob);
  }
  if (files?.licencia) {
    fd.append('licencia', {
      uri: files.licencia.uri,
      name: files.licencia.name,
      type: files.licencia.type,
    } as unknown as Blob);
  }
  return fd;
}

export async function buscarAlumnos(opts?: {
  q?: string;
  skip?: number;
  limit?: number;
}): Promise<AlumnosListResponse> {
  const q = new URLSearchParams();
  if (opts?.q?.trim()) q.set('q', opts.q.trim());
  q.set('skip', String(opts?.skip ?? 0));
  q.set('limit', String(opts?.limit ?? 40));
  return apiFetch<AlumnosListResponse>(`/alumnos?${q}`);
}

export async function listarAlumnosRecientes(limit = 25): Promise<AlumnosListResponse> {
  return buscarAlumnos({ limit, skip: 0 });
}

export async function fetchAlumnoPorDoc(numDoc: string | number): Promise<AlumnoListItem> {
  return apiFetch<AlumnoListItem>(`/alumnos/doc/${encodeURIComponent(formatNumDoc(numDoc))}`);
}

export async function fetchAlumnoPorId(id: string): Promise<AlumnoDetalleItem> {
  return apiFetch<AlumnoDetalleItem>(`/alumnos/${encodeURIComponent(id)}`);
}

export async function verificarDocumentoAlumno(numDoc: string | number): Promise<AlumnoDocVerificacion> {
  return apiFetch<AlumnoDocVerificacion>(
    `/alumnos/verificar-doc/${encodeURIComponent(formatNumDoc(numDoc))}`,
  );
}

export async function escanearCedulaAlumno(imagen: SoportePago): Promise<CedulaOcrResponse> {
  const fd = new FormData();
  fd.append('imagen', {
    uri: imagen.uri,
    name: imagen.name,
    type: imagen.type,
  } as unknown as Blob);
  return apiPostForm<CedulaOcrResponse>('/alumnos/escanear-cedula', fd, { timeoutMs: 120_000 });
}

export async function crearAlumno(dto: AlumnoCrearDto, files?: AlumnoArchivos): Promise<AlumnoListItem> {
  return apiPostForm<AlumnoListItem>('/alumnos', toFormData(dto, files));
}

export async function actualizarAlumno(
  id: string,
  dto: AlumnoCrearDto,
  files?: AlumnoArchivos,
): Promise<AlumnoDetalleItem> {
  return apiPutForm<AlumnoDetalleItem>(`/alumnos/${encodeURIComponent(id)}`, toFormData(dto, files));
}
