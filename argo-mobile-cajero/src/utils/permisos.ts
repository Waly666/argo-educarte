export function esAdminRol(rol?: string | null): boolean {
  const r = String(rol || '').trim().toLowerCase();
  return r === 'admin' || r === 'administrador';
}

export function tienePermiso(permisos: string[] | undefined, clave: string | string[], rol?: string | null): boolean {
  if (esAdminRol(rol)) return true;
  const keys = Array.isArray(clave) ? clave : [clave];
  const p = permisos || [];
  if (!p.length) return false;
  if (p.includes('*')) return true;
  return keys.some((k) => p.includes(k));
}

export function tieneAlarma(alarmas: string[] | undefined, clave: string, rol?: string | null): boolean {
  if (esAdminRol(rol)) return true;
  const a = alarmas || [];
  if (!a.length) return false;
  if (a.includes('*')) return true;
  if (a.includes(clave)) return true;
  const base = clave.split('.')[0];
  return a.includes(base);
}

/** Alertas excluidas de la app móvil cajero (CEA, vehículos, portal instructor). */
export const ALARMAS_EXCLUIDAS_MOVIL: string[] = [
  'alarmas.programacion_cea.pendiente',
  'alarmas.programacion_cea.clase_proxima',
  'alarmas.vehiculos.docs_vencidos',
  'alarmas.vehiculos.docs_faltantes',
  'alarmas.vehiculos.inspeccion_pendiente',
  'alarmas.alumnos.clases_cea_creado',
  'alarmas.instructores.clase_asignada',
  'alarmas.instructores.clase_proxima',
  'alarmas.instructores.inspeccion_requerida',
  'alarmas.jornadas.live_toast',
];

export function alarmaPermitidaEnMovil(key: string): boolean {
  return !ALARMAS_EXCLUIDAS_MOVIL.includes(key);
}
