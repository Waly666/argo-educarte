import * as SecureStore from 'expo-secure-store';
import { withTimeout } from '../utils/timeout';

const mem = new Map<string, string>();

export async function storeGet(key: string): Promise<string | null> {
  try {
    const v = await withTimeout(SecureStore.getItemAsync(key), 2500, 'leer datos');
    if (v != null) mem.set(key, v);
    return v;
  } catch {
    return mem.get(key) ?? null;
  }
}

export async function storeSet(key: string, value: string): Promise<void> {
  mem.set(key, value);
  try {
    await withTimeout(SecureStore.setItemAsync(key, value), 2500, 'guardar datos');
  } catch {
    /* memoria local como respaldo */
  }
}

export async function storeDelete(key: string): Promise<void> {
  mem.delete(key);
  try {
    await withTimeout(SecureStore.deleteItemAsync(key), 2500, 'borrar datos');
  } catch {
    /* ignore */
  }
}
