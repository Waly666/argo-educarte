import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/** Acceso exclusivo para administradores (módulo Sistema). */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuth()) {
    router.navigateByUrl('/login', { replaceUrl: true });
    return false;
  }
  if (auth.isAdmin()) return true;

  router.navigateByUrl('/app/sin-acceso', { replaceUrl: true });
  return false;
};
