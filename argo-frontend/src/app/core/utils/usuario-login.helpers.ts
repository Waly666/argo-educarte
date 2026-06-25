import { Usuario } from '../services/usuario.service';

/** true si el login guardado es solo dígitos (documento usado como username). */
export function esLoginNumerico(login?: string | null): boolean {
  const s = String(login ?? '').trim();
  return !!s && /^\d+$/.test(s);
}

/** Texto a mostrar en columna Usuario (login principal). */
export function loginMostrable(u: Pick<Usuario, 'username'>): string {
  const user = String(u.username ?? '').trim();
  if (user && !esLoginNumerico(user)) return user;
  return '—';
}

/** Documento de identidad para columna aparte. */
export function documentoUsuario(
  u: Pick<Usuario, 'username' | 'numero' | 'numeroDocumento'>,
): string {
  const doc = String(u.numeroDocumento ?? '').trim();
  if (doc) return doc;
  if (u.numero != null && Number.isFinite(Number(u.numero))) return String(u.numero);
  if (esLoginNumerico(u.username)) return String(u.username);
  return '';
}
