import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { AuthService } from '../../core/services/auth.service';
import { PermisoService } from '../../core/services/permiso.service';
import { InstructoresListaComponent } from './instructores-lista.component';
import { InstructorPortalComponent } from './instructor-portal.component';

@Component({
  selector: 'argo-instructores-hub',
  standalone: true,
  imports: [CommonModule, InstructoresListaComponent, InstructorPortalComponent],
  template: `
    @if (mostrarPortal()) {
      <argo-instructor-portal />
    } @else if (mostrarDirectorio()) {
      <argo-instructores-lista />
    } @else {
      <section class="card inst-hub-denied">
        <h2>Acceso no disponible</h2>
        <p class="hint">
          Su rol no tiene permiso para el portal de instructores ni para el directorio administrativo.
          Pida a un administrador que active «Portal del instructor» o vincule su usuario a un empleado instructor.
        </p>
      </section>
    }
  `,
  styles: [
    `
      .inst-hub-denied {
        padding: 1.25rem;
      }
    `,
  ],
})
export class InstructoresHubComponent {
  private permisos = inject(PermisoService);
  private auth = inject(AuthService);

  mostrarDirectorio = computed(() =>
    this.permisos.tiene(['instructores', 'rrhh', 'jornadas.gestionar']),
  );

  mostrarPortal = computed(() => this.auth.puedeUsarPortalInstructor());
}
