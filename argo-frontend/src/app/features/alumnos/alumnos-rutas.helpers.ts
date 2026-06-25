/** Rutas del flujo general vs alumnos solo de Jornadas de Capacitación. */
export type ModoAlumnos = 'general' | 'jornadas';

export const RUTAS_ALUMNOS_GENERAL = {
  lista: '/app/alumnos',
  nuevo: '/app/alumnos/nuevo',
  ficha: (id: string) => `/app/alumnos/${id}`,
  hubJornadas: '/app/jornadas',
} as const;

export const RUTAS_ALUMNOS_JORNADA = {
  lista: '/app/jornadas/alumnos',
  nuevo: '/app/jornadas/alumnos/nuevo',
  ficha: (id: string) => `/app/jornadas/alumnos/${id}`,
  hubJornadas: '/app/jornadas',
} as const;

export function rutasAlumnos(modo: ModoAlumnos) {
  return modo === 'jornadas' ? RUTAS_ALUMNOS_JORNADA : RUTAS_ALUMNOS_GENERAL;
}

export function modoAlumnosDesdeRoute(url: string): ModoAlumnos {
  return url.includes('/jornadas/alumnos') ? 'jornadas' : 'general';
}
