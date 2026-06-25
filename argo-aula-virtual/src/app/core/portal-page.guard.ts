import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map, take } from 'rxjs/operators';

import { AulaApiService } from './aula-api.service';
import { clavePaginaPorRuta, paginaActiva } from './portal-site';

export const portalPageGuard: CanActivateFn = (_route, state) => {
  const api = inject(AulaApiService);
  const router = inject(Router);
  const key = clavePaginaPorRuta(state.url);
  if (!key || key === 'home' || key === 'aula') return true;

  return api.config().pipe(
    take(1),
    map((cfg) => (paginaActiva(cfg, key) ? true : router.createUrlTree(['/']))),
    catchError(() => of(true)),
  );
};
