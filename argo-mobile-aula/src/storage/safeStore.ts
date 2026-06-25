import * as SecureStore from 'expo-secure-store';

const memory = new Map<string, string>();
const TIMEOUT_MS = 2500;

async function withTimeout<T>(p: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), TIMEOUT_MS)),
  ]);
}

export async function secureGet(key: string): Promise<string | null> {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    const v = await withTimeout(SecureStore.getItemAsync(key), null);
    if (v != null) memory.set(key, v);
    return v;
  } catch {
    return memory.get(key) ?? null;
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  memory.set(key, value);
  try {
    await withTimeout(SecureStore.setItemAsync(key, value), undefined);
  } catch {
    /* memoria */
  }
}

export async function secureDelete(key: string): Promise<void> {
  memory.delete(key);
  try {
    await withTimeout(SecureStore.deleteItemAsync(key), undefined);
  } catch {
    /* ignore */
  }
}
