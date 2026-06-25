import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { SedeService } from '../services/sede.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const sedeSvc = inject(SedeService);
  const router = inject(Router);

  const token = auth.token();
  const idSede = sedeSvc.idSede();
  const pantalla = router.url.split('?')[0].slice(0, 500);
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (idSede) headers['X-ARGO-Sede'] = idSede;
  if (pantalla.startsWith('/app')) headers['X-ARGO-Pantalla'] = pantalla;

  const authReq = Object.keys(headers).length
    ? req.clone({ setHeaders: headers })
    : req;

  return next(authReq).pipe(
    catchError((err) => {
      // 401 por contraseña/MFA incorrectos en reset/restore: no cerrar sesión.
      const code = err?.error?.code;
      const esReauthFallida = code === 'REAUTH_FAILED' || err?.status === 403;
      if (err?.status === 401 && auth.isAuth() && !esReauthFallida) {
        auth.logout();
      }
      return throwError(() => err);
    }),
  );
};
