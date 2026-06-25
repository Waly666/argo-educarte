import { getApiBaseUrl } from '../config/apiBase';

type TokenGetter = () => string | null;
let tokenGetter: TokenGetter = () => null;

export function setTokenGetter(fn: TokenGetter): void {
  tokenGetter = fn;
}

function mensajeRed(err: unknown, base: string): string {
  const m = err instanceof Error ? err.message : String(err);
  if (err instanceof Error && err.name === 'AbortError') {
    return `El servidor no respondió a tiempo (${base}).`;
  }
  if (/Network request failed|Failed to fetch|ECONNREFUSED|ETIMEDOUT|aborted/i.test(m)) {
    return `Sin conexión con ${base}. Revise la red y que el servidor esté activo.`;
  }
  return m;
}

export async function apiFetch<T>(
  path: string,
  opts?: RequestInit & { auth?: boolean; timeoutMs?: number },
): Promise<T> {
  const base = getApiBaseUrl();
  const timeoutMs = opts?.timeoutMs ?? 25_000;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-ARGO-Cliente': 'mobile',
    ...(opts?.headers as Record<string, string>),
  };
  if (opts?.auth !== false) {
    const t = tokenGetter();
    if (t) headers.Authorization = `Bearer ${t}`;
  }

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
      throw new Error(`Respuesta no JSON (${res.status})`);
    }
  }
  if (!res.ok) {
    const msg = (json as { message?: string })?.message ?? `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return json as T;
}

export async function apiFetchText(
  path: string,
  opts?: RequestInit & { auth?: boolean; timeoutMs?: number },
): Promise<string> {
  const base = getApiBaseUrl();
  const timeoutMs = opts?.timeoutMs ?? 30_000;
  const headers: Record<string, string> = {
    Accept: 'text/html, text/plain, */*',
    'X-ARGO-Cliente': 'mobile',
    ...(opts?.headers as Record<string, string>),
  };
  if (opts?.auth !== false) {
    const t = tokenGetter();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
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
    try {
      const j = JSON.parse(text) as { message?: string };
      throw new Error(j.message ?? `${res.status}`);
    } catch {
      throw new Error(text || `${res.status}`);
    }
  }
  return text;
}

const AULA = '/aula-virtual';

export async function pingHealth(): Promise<boolean> {
  try {
    await apiFetch('/health', { auth: false, timeoutMs: 8000 });
    return true;
  } catch {
    return false;
  }
}

export async function portalLogin(email: string, password: string): Promise<import('./types').PortalAuthRes> {
  return apiFetch(`${AULA}/auth/login`, {
    method: 'POST',
    auth: false,
    headers: {
      'Content-Type': 'application/json',
      'X-ARGO-Cliente': 'mobile',
    },
    body: JSON.stringify({ email, password }),
  });
}
