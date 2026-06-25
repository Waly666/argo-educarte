/** Rutas de inicio y comprobación de acceso (evita bucles al revocar permisos). */

export type AccesoRutaCtx = { puedeUsarPortalInstructor?: boolean };

function tieneUno(permisos: string[], clave: string): boolean {
  if (permisos.includes('*')) return true;
  return permisos.includes(clave);
}

function tieneAlguno(permisos: string[], claves: string[]): boolean {
  return claves.some((k) => tieneUno(permisos, k));
}

/** Permisos para directorio / detalle de instructores (no portal). */
export const PERMISOS_INSTRUCTORES_DIRECTORIO = [
  'instructores',
  'rrhh',
  'jornadas.gestionar',
] as const;

const RUTAS_INICIO: { path: string; permiso: string | string[] }[] = [
  { path: '/app/dashboard', permiso: 'dashboard' },
  { path: '/app/jornadas/instructor', permiso: ['jornadas.operar', 'jornadas.gestionar'] },
  { path: '/app/programacion-cea/clases-hoy', permiso: ['programacion_cea.ver', 'programacion_cea.operar', 'programacion_cea.gestionar', 'caja.turno', 'caja.admin'] },
  { path: '/app/instructores', permiso: ['instructores.mi_portal', ...PERMISOS_INSTRUCTORES_DIRECTORIO] },
  { path: '/app/jornadas/clases-hoy', permiso: ['jornadas.ver', 'jornadas.gestionar', 'jornadas.operar'] },
  { path: '/app/programacion-cea/clases-grupales', permiso: ['programacion_cea.ver', 'programacion_cea.gestionar', 'programacion_cea.operar'] },
  { path: '/app/jornadas', permiso: ['jornadas.ver', 'jornadas.gestionar', 'jornadas.operar'] },
  { path: '/app/programacion-cea', permiso: ['programacion_cea.ver', 'programacion_cea.gestionar', 'programacion_cea.operar'] },
  { path: '/app/alumnos', permiso: ['alumnos.ver', 'alumnos.gestionar'] },
  { path: '/app/certificados', permiso: 'alumnos.certificados' },
  { path: '/app/programas', permiso: ['programas.ver', 'programas.gestionar', 'programas.agregar'] },
  { path: '/app/caja', permiso: ['caja.turno', 'caja.cobros', 'caja.admin'] },
  { path: '/app/rrhh/inicio', permiso: 'rrhh' },
  { path: '/app/vehiculos', permiso: ['vehiculos', 'instructores.inspeccion'] },
];

/** Prefijos URL → permiso requerido (más específico primero). */
const REGLAS_RUTA: { prefix: string; permiso: string | string[] }[] = [
  { prefix: '/app/sin-acceso', permiso: [] },
  { prefix: '/app/dashboard', permiso: 'dashboard' },
  { prefix: '/app/alumnos/nuevo', permiso: 'alumnos.gestionar' },
  { prefix: '/app/alumnos', permiso: ['alumnos.ver', 'alumnos.gestionar'] },
  { prefix: '/app/certificados/vencidos', permiso: ['certificados.vencidos', 'alumnos.certificados'] },
  { prefix: '/app/certificados', permiso: 'alumnos.certificados' },
  {
    prefix: '/app/informes',
    permiso: [
      'informes.ver',
      'alumnos.ver',
      'alumnos.gestionar',
      'programas.ver',
      'programas.gestionar',
      'programas.agregar',
      'servicios.ver',
      'servicios.gestionar',
    ],
  },
  { prefix: '/app/programas', permiso: ['programas.ver', 'programas.gestionar', 'programas.agregar'] },
  { prefix: '/app/aula-virtual/sitio', permiso: ['aula_virtual.sitio', 'aula_virtual.gestionar', 'programas.gestionar'] },
  { prefix: '/app/aula-virtual/foro', permiso: ['aula_virtual.foro', 'aula_virtual.gestionar', 'programas.gestionar', 'instructores'] },
  { prefix: '/app/aula-virtual', permiso: ['aula_virtual.gestionar', 'programas.gestionar'] },
  { prefix: '/app/jornadas/alumnos/nuevo', permiso: ['alumnos.gestionar', 'jornadas.gestionar'] },
  { prefix: '/app/jornadas/alumnos', permiso: ['alumnos.ver', 'alumnos.gestionar', 'jornadas.ver'] },
  { prefix: '/app/jornadas/instructor', permiso: ['jornadas.operar', 'jornadas.gestionar'] },
  { prefix: '/app/jornadas/certificados', permiso: ['jornadas.ver', 'jornadas.gestionar'] },
  { prefix: '/app/jornadas/en-proceso', permiso: ['jornadas.ver', 'jornadas.gestionar'] },
  { prefix: '/app/jornadas/clases-hoy', permiso: ['jornadas.ver', 'jornadas.gestionar', 'jornadas.operar'] },
  { prefix: '/app/jornadas', permiso: ['jornadas.ver', 'jornadas.gestionar', 'jornadas.operar'] },
  { prefix: '/app/contratos', permiso: ['jornadas.ver', 'jornadas.gestionar'] },
  { prefix: '/app/servicios', permiso: ['servicios.ver', 'servicios.gestionar'] },
  { prefix: '/app/combos', permiso: ['combos.gestionar', 'alumnos.pagos', 'alumnos.gestionar'] },
  { prefix: '/app/facturacion', permiso: 'facturacion' },
  { prefix: '/app/instructores', permiso: ['instructores.mi_portal', ...PERMISOS_INSTRUCTORES_DIRECTORIO] },
  { prefix: '/app/programacion-cea/clases-grupales', permiso: ['programacion_cea.ver', 'programacion_cea.gestionar', 'programacion_cea.operar'] },
  { prefix: '/app/programacion-cea/clases-practica', permiso: ['programacion_cea.ver', 'programacion_cea.gestionar', 'programacion_cea.operar'] },
  { prefix: '/app/programacion-cea/clases-hoy', permiso: ['programacion_cea.ver', 'programacion_cea.gestionar', 'programacion_cea.operar', 'caja.turno', 'caja.admin'] },
  { prefix: '/app/programacion-cea', permiso: ['programacion_cea.ver', 'programacion_cea.gestionar', 'programacion_cea.operar'] },
  { prefix: '/app/cohortes', permiso: ['cohortes_academicas.ver', 'cohortes_academicas.gestionar', 'cohortes_academicas.operar'] },
  { prefix: '/app/cobros-pendientes', permiso: ['caja.cobros', 'caja.turno'] },
  { prefix: '/app/caja/ingresos-todos', permiso: 'caja.admin' },
  { prefix: '/app/caja/egresos-todos', permiso: 'caja.admin' },
  { prefix: '/app/caja/descuadres', permiso: 'caja.admin' },
  { prefix: '/app/cierres', permiso: 'caja.admin' },
  { prefix: '/app/cierre-general', permiso: 'caja.admin' },
  { prefix: '/app/caja', permiso: ['caja.turno', 'caja.cobros', 'caja.admin'] },
  { prefix: '/app/rrhh', permiso: 'rrhh' },
  { prefix: '/app/vehiculos', permiso: ['vehiculos', 'instructores.inspeccion'] },
  { prefix: '/app/configuracion/usuarios', permiso: 'config.usuarios' },
  { prefix: '/app/configuracion/sedes', permiso: ['sedes.gestionar', 'config.sedes'] },
  { prefix: '/app/configuracion/roles', permiso: 'config.roles' },
  { prefix: '/app/configuracion/recibos', permiso: 'config.recibos' },
  { prefix: '/app/configuracion/georef', permiso: 'config.georef' },
  { prefix: '/app/configuracion/pasarela', permiso: ['config.recibos', 'aula_virtual.gestionar'] },
  { prefix: '/app/informes/matriculas-virtuales', permiso: ['informes.ver', 'aula_virtual.gestionar', 'alumnos.ver'] },
  { prefix: '/app/configuracion/clientes', permiso: ['config.facturacion', 'facturacion'] },
  { prefix: '/app/configuracion/nomina', permiso: 'config.nomina' },
  { prefix: '/app/configuracion/certificados', permiso: 'config.certificados' },
  { prefix: '/app/configuracion/catalogos', permiso: 'config.catalogos' },
  { prefix: '/app/configuracion/requisitos-documentos-alumnos', permiso: 'config.requisitos' },
  { prefix: '/app/configuracion/requisitos-documentos-vehiculos', permiso: 'config.requisitos' },
  { prefix: '/app/configuracion/requisitos-documentos-empleados', permiso: 'config.requisitos' },
  { prefix: '/app/configuracion/formato-inspeccion-vehiculos', permiso: 'config.requisitos' },
  { prefix: '/app/configuracion/auditoria', permiso: 'config.auditoria' },
  { prefix: '/app/configuracion/monitor', permiso: 'config.auditoria' },
  {
    prefix: '/app/configuracion',
    permiso: [
      'config.usuarios',
      'config.roles',
      'config.catalogos',
      'config.recibos',
      'config.georef',
      'config.facturacion',
      'facturacion',
      'config.nomina',
      'config.certificados',
      'config.requisitos',
      'config.auditoria',
      'sedes.gestionar',
      'config.sedes',
    ],
  },
];

function reglaParaPath(path: string) {
  return REGLAS_RUTA.filter((r) => path === r.prefix || path.startsWith(`${r.prefix}/`)).sort(
    (a, b) => b.prefix.length - a.prefix.length,
  )[0];
}

export function permisoRequeridoRuta(url: string): string | string[] | null {
  const path = (url || '').split('?')[0];
  if (!path.startsWith('/app')) return null;
  const regla = reglaParaPath(path);
  return regla?.permiso ?? null;
}

function accesoInstructoresHub(permisos: string[], ctx?: AccesoRutaCtx): boolean {
  if (ctx?.puedeUsarPortalInstructor) return true;
  return tienePermisoRuta(permisos, [...PERMISOS_INSTRUCTORES_DIRECTORIO]);
}

export function rutaInicioApp(permisos: string[] | undefined | null, ctx?: AccesoRutaCtx): string {
  const p = permisos?.length ? permisos : [];
  if (!p.length) return '/app/sin-acceso';
  for (const r of RUTAS_INICIO) {
    if (r.path === '/app/instructores') {
      if (accesoInstructoresHub(p, ctx)) return r.path;
      continue;
    }
    const keys = Array.isArray(r.permiso) ? r.permiso : [r.permiso];
    if (tieneAlguno(p, keys)) return r.path;
  }
  return '/app/sin-acceso';
}

export function tienePermisoRuta(permisos: string[] | undefined | null, clave?: string | string[] | null): boolean {
  if (!clave) return true;
  const keys = Array.isArray(clave) ? clave : [clave];
  if (keys.length === 0) return true;
  const p = permisos?.length ? permisos : [];
  if (!p.length) return false;
  return tieneAlguno(p, keys);
}

export function rutaAccesible(url: string, permisos: string[] | undefined | null, ctx?: AccesoRutaCtx): boolean {
  const path = (url || '').split('?')[0];
  if (!path.startsWith('/app')) return true;
  if (path === '/app' || path === '/app/') return true;

  // Rutas legacy /sistema y backup/reset/restore/migración: adminGuard (solo rol admin).
  if (path.startsWith('/app/sistema')) return true;
  if (
    path.startsWith('/app/configuracion/backup') ||
    path.startsWith('/app/configuracion/restore') ||
    path.startsWith('/app/configuracion/reset') ||
    path.startsWith('/app/configuracion/migracion')
  ) {
    return true;
  }

  if (path === '/app/instructores' || path.startsWith('/app/instructores/')) {
    if (path !== '/app/instructores') {
      return tienePermisoRuta(permisos, ['instructores', 'rrhh', 'jornadas.ver', 'jornadas.gestionar']);
    }
    return accesoInstructoresHub(permisos?.length ? permisos : [], ctx);
  }

  const regla = reglaParaPath(path);
  if (!regla) return false;
  return tienePermisoRuta(permisos, regla.permiso);
}

export function destinoTrasRevocar(
  url: string,
  permisos: string[] | undefined | null,
  ctx?: AccesoRutaCtx,
): string | null {
  if (rutaAccesible(url, permisos, ctx)) return null;
  return rutaInicioApp(permisos, ctx);
}
