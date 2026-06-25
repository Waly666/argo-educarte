import type { PortalConfig } from '../api/types';
import { secureDelete, secureGet, secureSet } from './safeStore';

const CACHE_KEY = 'argo_aula_portal_config';

/** Solo datos ligeros (SecureStore limita ~2048 bytes). */
function slimPortalConfig(config: PortalConfig): PortalConfig {
  return {
    nombreCea: config.nombreCea,
    nit: config.nit,
    direccion: config.direccion,
    ciudad: config.ciudad,
    telefono: config.telefono,
    telefonoWhatsapp: config.telefonoWhatsapp,
    email: config.email,
    urlLogo: config.urlLogo,
    urlLogoAbsoluta: config.urlLogoAbsoluta,
    heroTitulo: config.heroTitulo,
    heroSubtitulo: config.heroSubtitulo,
    registroAbierto: config.registroAbierto,
    emailVerificacionRegistro: config.emailVerificacionRegistro,
    turnstileSiteKey: config.turnstileSiteKey,
    formularioContactoActivo: config.formularioContactoActivo,
    formularioPqrActivo: config.formularioPqrActivo,
    site: config.site?.tema ? { tema: config.site.tema } : undefined,
  };
}

export async function loadCachedPortalConfig(): Promise<PortalConfig | null> {
  try {
    const raw = await secureGet(CACHE_KEY);
    if (!raw?.trim()) return null;
    const parsed = JSON.parse(raw) as PortalConfig;
    if (!parsed?.nombreCea?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveCachedPortalConfig(config: PortalConfig): Promise<void> {
  try {
    await secureSet(CACHE_KEY, JSON.stringify(slimPortalConfig(config)));
  } catch {
    /* ignore */
  }
}

export async function clearCachedPortalConfig(): Promise<void> {
  await secureDelete(CACHE_KEY);
}
