import Constants from 'expo-constants';

export const SERVIDOR_API_STORAGE_KEY = 'argo_aula_servidor_api';

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

function isLanOrLocalhost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '10.0.2.2') return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}

function applyDefaultBackendPort(u: string): string {
  try {
    const url = new URL(u);
    if (url.protocol !== 'http:') return u;
    if (url.port !== '') return u;
    if (!isLanOrLocalhost(url.hostname)) return u;
    url.port = '3000';
    return trimSlash(`${url.protocol}//${url.host}${url.pathname === '/' ? '' : url.pathname}`);
  } catch {
    return u;
  }
}

let runtimeApiBase: string | null = null;
const apiBaseListeners = new Set<() => void>();

/** Notifica cuando cambia la URL del API (servidor guardado o configurado en login). */
export function subscribeApiBase(listener: () => void): () => void {
  apiBaseListeners.add(listener);
  return () => apiBaseListeners.delete(listener);
}

export function normalizeApiBaseUrl(input: string): string {
  let u = input.trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  u = trimSlash(u);
  u = applyDefaultBackendPort(u);
  u = trimSlash(u);
  if (!/\/api$/i.test(u)) u = `${u}/api`;
  u = u.replace(/(\/api)+$/i, '/api');
  return trimSlash(u);
}

export function setRuntimeApiBase(apiBase: string | null): void {
  const prev = runtimeApiBase;
  if (!apiBase?.trim()) {
    runtimeApiBase = null;
  } else {
    runtimeApiBase = normalizeApiBaseUrl(apiBase) || null;
  }
  if (prev !== runtimeApiBase) {
    apiBaseListeners.forEach((fn) => fn());
  }
}

export function getApiBaseUrl(): string {
  if (runtimeApiBase) return runtimeApiBase;
  const fromExtra = Constants.expoConfig?.extra?.apiBaseUrl;
  if (typeof fromExtra === 'string' && fromExtra.trim()) {
    return normalizeApiBaseUrl(fromExtra);
  }
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv?.trim()) return normalizeApiBaseUrl(fromEnv);
  return 'http://127.0.0.1:3000/api';
}

export function getUploadsBaseUrl(): string {
  return getApiBaseUrl().replace(/\/api\/?$/i, '/uploads');
}

export function getSocketBaseUrl(): string {
  return getApiBaseUrl().replace(/\/api\/?$/i, '');
}
