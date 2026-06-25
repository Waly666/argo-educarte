export type VistaLista = 'lista' | 'cards';

export function readVistaLista(storageKey: string): VistaLista {
  try {
    return localStorage.getItem(storageKey) === 'cards' ? 'cards' : 'lista';
  } catch {
    return 'lista';
  }
}

export function saveVistaLista(storageKey: string, v: VistaLista): void {
  try {
    localStorage.setItem(storageKey, v);
  } catch {
    /* ignore */
  }
}

export function inicialesNombre(...partes: (string | undefined | null)[]): string {
  const a = (partes[0] || '?').charAt(0);
  const b = (partes[1] || '').charAt(0);
  return `${a}${b}`.toUpperCase();
}
