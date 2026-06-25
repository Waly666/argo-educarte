import { fetchPortalConfig } from '../api/aulaApi';
import type { PortalConfig } from '../api/types';
import { SERVIDOR_API_STORAGE_KEY, setRuntimeApiBase } from '../config/apiBase';
import { loadCachedPortalConfig, saveCachedPortalConfig } from '../storage/portalConfigCache';
import { secureGet } from '../storage/safeStore';

/** Carga URL del API guardada antes de cualquier petición al portal. */
export async function initAppRuntime(): Promise<void> {
  const savedApi = await secureGet(SERVIDOR_API_STORAGE_KEY);
  if (savedApi?.trim()) {
    setRuntimeApiBase(savedApi);
  }
}

/** Precarga marca del portal (logo + nombre empresa) lo antes posible. */
export async function preloadPortalConfig(): Promise<PortalConfig | null> {
  await initAppRuntime();

  const cached = await loadCachedPortalConfig();
  try {
    const fresh = await fetchPortalConfig();
    await saveCachedPortalConfig(fresh);
    return fresh;
  } catch {
    return cached;
  }
}
