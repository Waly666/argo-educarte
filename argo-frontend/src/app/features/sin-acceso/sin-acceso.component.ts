import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';

import { AuthService } from '../../core/services/auth.service';
import { PermisoService } from '../../core/services/permiso.service';

@Component({
  selector: 'argo-sin-acceso',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="card sin-acceso-page">
      <h1>Sin acceso configurado</h1>
      <p class="hint">
        Su usuario inició sesión, pero el rol no tiene permisos para ningún módulo.
        Un administrador debe asignar al menos «Panel principal (dashboard)» u otro módulo en
        <strong>Configuración → Roles y permisos</strong>.
      </p>
      <p class="hint mono">Rol: {{ auth.user()?.rolNombre || auth.user()?.rol || '—' }}</p>
      <p class="hint mono" *ngIf="permisos().length">
        Permisos activos: {{ permisos().join(', ') }}
      </p>
      <button type="button" class="ghost" (click)="auth.logout()">Cerrar sesión</button>
    </section>
  `,
  styles: [
    `
      .sin-acceso-page {
        padding: 1.5rem;
        max-width: 36rem;
      }
      h1 {
        margin: 0 0 0.5rem;
      }
    `,
  ],
})
export class SinAccesoComponent {
  auth = inject(AuthService);
  private permisoSvc = inject(PermisoService);
  permisos = () => this.permisoSvc.permisos();
}
