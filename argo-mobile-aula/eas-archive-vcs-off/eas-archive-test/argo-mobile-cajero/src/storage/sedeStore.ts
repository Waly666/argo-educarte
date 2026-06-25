import { storeDelete, storeGet, storeSet } from './safeStore';

export const SEDE_ACTIVA_KEY = 'argo_m_sede_activa';

let memSede: string | null = null;

export function getSedeActivaSync(): string | null {
  return memSede;
}

export async function loadSedeActiva(): Promise<string | null> {
  const v = await storeGet(SEDE_ACTIVA_KEY);
  memSede = v?.trim() || null;
  return memSede;
}

export async function setSedeActiva(idSede: string | null): Promise<void> {
  memSede = idSede?.trim() || null;
  if (memSede) await storeSet(SEDE_ACTIVA_KEY, memSede);
  else await storeDelete(SEDE_ACTIVA_KEY);
}
