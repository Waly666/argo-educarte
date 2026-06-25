import { getApiBaseUrl } from '../config/apiBase';
import { getSedeActivaSync } from '../storage/sedeStore';
import type { AuthUser, CajaActivaResponse, ComprobanteRecienteRow, LoginResponse, ReglaAlerta, StaffLoginResponse } from './types';

type TokenGetter = () => string | null;

let tokenGetter: TokenGetter = () => null;
/** Token recién emitido en login (antes de que React actualice tokenGetter). */
let sessionTokenHint: string | null = null;

export function setTokenGetter(fn: TokenGetter): void {
  tokenGetter = fn;
}

function authToken(): string | null {
  return tokenGetter() ?? sessionTokenHint;
}

export function bindSessionToken(token: string | null): void {
  sessionTokenHint = token?.trim() || null;
}

function mensajeRed(err: unknown, base: string): string {
  const m = err instanceof Error ? err.message : String(err);
  if (err instanceof Error && err.name === 'AbortError') {
    return `El servidor no respondió a tiempo (${base}). Revise IP, firewall de Windows y que el backend esté en marcha.`;
  }
  if (/Network request failed|Failed to fetch|ECONNREFUSED|ETIMEDOUT|aborted/i.test(m)) {
    return `Sin conexión con ${base}. Celular y PC en la misma red Wi‑Fi; en Windows permita el puerto 3000 en el firewall.`;
  }
  return m;
}

export async function apiFetch<T>(
  path: string,
  opts?: RequestInit & { auth?: boolean; timeoutMs?: number },
): Promise<T> {
  const base = getApiBaseUrl();
  const timeoutMs = opts?.timeoutMs ?? 20_000;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(opts?.headers as Record<string, string>),
  };
  if (opts?.auth !== false) {
    const t = authToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const idSede = getSedeActivaSync();
  if (idSede) headers['X-ARGO-Sede'] = idSede;
  if (!headers['X-ARGO-Cliente']) headers['X-ARGO-Cliente'] = 'cajero';

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
      ...opts,
      headers,
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new Error(mensajeRed(e, base));
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Respuesta no JSON (${res.status}) desde ${base}`);
    }
  }
  if (!res.ok) {
    const msg = (json as { message?: string })?.message ?? `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return json as T;
}

/** POST multipart (p. ej. ingreso con soporte). No fijar Content-Type: el cliente añade el boundary. */
export async function apiPostForm<T>(
  path: string,
  formData: FormData,
  opts?: { auth?: boolean; timeoutMs?: number },
): Promise<T> {
  const base = getApiBaseUrl();
  const timeoutMs = opts?.timeoutMs ?? 30_000;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts?.auth !== false) {
    const t = authToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const idSede = getSedeActivaSync();
  if (idSede) headers['X-ARGO-Sede'] = idSede;
  headers['X-ARGO-Cliente'] = 'cajero';

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
      method: 'POST',
      headers,
      body: formData,
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new Error(mensajeRed(e, base));
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Respuesta no JSON (${res.status}) desde ${base}`);
    }
  }
  if (!res.ok) {
    const msg = (json as { message?: string })?.message ?? `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return json as T;
}

/** PUT multipart (actualizar alumno con archivos). */
export async function apiPutForm<T>(
  path: string,
  formData: FormData,
  opts?: { auth?: boolean; timeoutMs?: number },
): Promise<T> {
  const base = getApiBaseUrl();
  const timeoutMs = opts?.timeoutMs ?? 30_000;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts?.auth !== false) {
    const t = authToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const idSede = getSedeActivaSync();
  if (idSede) headers['X-ARGO-Sede'] = idSede;
  headers['X-ARGO-Cliente'] = 'cajero';

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
      method: 'PUT',
      headers,
      body: formData,
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new Error(mensajeRed(e, base));
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Respuesta no JSON (${res.status}) desde ${base}`);
    }
  }
  if (!res.ok) {
    const msg = (json as { message?: string })?.message ?? `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return json as T;
}

/** HTML o texto plano (recibos, certificados, facturas). */
export async function apiFetchText(
  path: string,
  opts?: RequestInit & { auth?: boolean; timeoutMs?: number },
): Promise<string> {
  const base = getApiBaseUrl();
  const timeoutMs = opts?.timeoutMs ?? 30_000;
  const headers: Record<string, string> = {
    Accept: 'text/html, text/plain, */*',
    ...(opts?.headers as Record<string, string>),
  };
  if (opts?.auth !== false) {
    const t = authToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const idSede = getSedeActivaSync();
  if (idSede) headers['X-ARGO-Sede'] = idSede;
  headers['X-ARGO-Cliente'] = 'cajero';

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
      ...opts,
      headers,
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new Error(mensajeRed(e, base));
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = JSON.parse(text) as { message?: string };
      if (j.message) msg = j.message;
    } catch {
      if (text.trim()) msg = text.slice(0, 200);
    }
    throw new Error(msg);
  }
  return text;
}

export async function pingHealth(): Promise<{ ok: boolean; service?: string }> {
  return apiFetch('/health', { auth: false, timeoutMs: 8000 });
}

function parseStaffLogin(raw: StaffLoginResponse): LoginResponse {
  if (raw.step === 'mfa_verify') {
    throw new Error(
      'Este usuario tiene autenticación MFA. Actualice la app o configure MFA solo para web en el servidor.',
    );
  }
  if (raw.step === 'mfa_setup') {
    throw new Error('Complete la configuración MFA en el ERP web antes de usar la app móvil.');
  }
  const token = String(raw.token || '').trim();
  const user = raw.user;
  if (raw.step !== 'complete' || !token || !user?._id) {
    throw new Error('No se pudo completar el inicio de sesión. Verifique usuario y contraseña.');
  }
  return { token, user };
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const raw = await apiFetch<StaffLoginResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    timeoutMs: 12_000,
    headers: {
      'Content-Type': 'application/json',
      'X-ARGO-Cliente': 'cajero',
    },
    body: JSON.stringify({ username, password }),
  });
  return parseStaffLogin(raw);
}

export async function fetchMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/me', { timeoutMs: 10_000 });
}

export async function fetchConfigAlertas(): Promise<{ reglas: ReglaAlerta[] }> {
  return apiFetch<{ reglas: ReglaAlerta[] }>('/config/alertas', { timeoutMs: 10_000 });
}

export async function fetchCajaActiva(): Promise<CajaActivaResponse> {
  return apiFetch<CajaActivaResponse>('/caja/sesiones/activa');
}

export async function fetchComprobantesRecientes(desde: string): Promise<ComprobanteRecienteRow[]> {
  const q = encodeURIComponent(desde);
  return apiFetch<ComprobanteRecienteRow[]>(`/alumnos/alertas-comprobantes-recientes?desde=${q}`);
}

export async function fetchCertificadosRecientes(desde: string): Promise<Array<Record<string, unknown>>> {
  const q = encodeURIComponent(desde);
  return apiFetch<Array<Record<string, unknown>>>(`/certificados/recientes?desde=${q}`);
}

export async function fetchCertificadosPorVencer(dias?: number): Promise<{ total?: number; items?: unknown[] } | null> {
  const q = dias != null ? `?dias=${dias}` : '';
  return apiFetch(`/certificados/alertas-por-vencer${q}`);
}

export async function fetchCertificadosVencidos(dias?: number): Promise<{ total?: number; items?: unknown[] } | null> {
  const q = dias != null ? `?diasGracia=${dias}` : '';
  return apiFetch(`/certificados/alertas-vencidos${q}`);
}

export async function fetchDescuadresCaja(): Promise<unknown[]> {
  return apiFetch<unknown[]>('/caja/descuadres?estado=pendiente&limit=15');
}
