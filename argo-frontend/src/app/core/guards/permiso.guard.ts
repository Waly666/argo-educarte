import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { PermisoService } from '../services/permiso.service';
import {
  PERMISOS_INSTRUCTORES_DIRECTORIO,
  destinoTrasRevocar,
  tienePermisoRuta,
} from '../utils/auth-routes.util';

export const permisoGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const permisos = inject(PermisoService);
  const router = inject(Router);

  if (!auth.isAuth()) {
    router.navigateByUrl('/login', { replaceUrl: true });
    return false;
  }

  const list = permisos.permisos();
  const path = route.routeConfig?.path ?? '';
  const ctx = { puedeUsarPortalInstructor: auth.puedeUsarPortalInstructor() };

  if (path === 'instructores') {
    if (ctx.puedeUsarPortalInstructor) return true;
    if (tienePermisoRuta(list, [...PERMISOS_INSTRUCTORES_DIRECTORIO])) return true;
  } else {
    const clave = route.data['permiso'] as string | string[] | undefined;
    if (!clave || tienePermisoRuta(list, clave)) return true;
  }

  const actual = router.url.split('?')[0];
  const destino = destinoTrasRevocar(actual, list, ctx) ?? '/app/sin-acceso';

  if (actual !== destino) {
    router.navigateByUrl(destino, { replaceUrl: true });
  } else {
    router.navigateByUrl('/app/sin-acceso', { replaceUrl: true });
  }
  return false;
};

/** Compatibilidad con rutas que usaban programasGuard */
export const programasGuard = permisoGuard;
