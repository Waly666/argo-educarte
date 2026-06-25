import { Component, inject, OnInit } from '@angular/core';

import { AuthService } from '../../core/services/auth.service';
import { PermisoService } from '../../core/services/permiso.service';
import { rutaInicioApp } from '../../core/utils/auth-routes.util';
import { Router } from '@angular/router';

/** Redirige /app → primera ruta permitida según permisos del usuario. */
@Component({
  selector: 'argo-app-inicio',
  standalone: true,
  template: '<p class="hint app-inicio-loading">Cargando…</p>',
  styles: [
    `
      .app-inicio-loading {
        padding: 1.25rem;
        margin: 0;
      }
    `,
  ],
})
export class AppInicioComponent implements OnInit {
  private router = inject(Router);
  private permisos = inject(PermisoService);
  private auth = inject(AuthService);

  ngOnInit(): void {
    const ctx = { puedeUsarPortalInstructor: this.auth.puedeUsarPortalInstructor() };
    void this.router.navigateByUrl(rutaInicioApp(this.permisos.permisos(), ctx), { replaceUrl: true });
  }
}
