import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Empleado, EmpleadoService } from '../../core/services/empleado.service';
import { PermisoService } from '../../core/services/permiso.service';
import { inicialesNombre, readVistaLista, saveVistaLista, VistaLista } from '../../core/utils/vista-lista.helpers';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'argo-instructores-lista',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './instructores-lista.component.html',
  styleUrls: ['./instructores-lista.component.scss'],
})
export class InstructoresListaComponent implements OnInit {
  private svc = inject(EmpleadoService);
  private permisoSvc = inject(PermisoService);
  private router = inject(Router);

  uploads = environment.uploadsUrl;

  instructores = signal<Empleado[]>([]);
  loading = signal(false);
  msg = signal<string | null>(null);
  busqueda = signal('');
  soloActivos = signal(true);
  vista = signal<VistaLista>(readVistaLista('argo-instructores-vista'));

  puedeGestionarRrhh = computed(() => this.permisoSvc.tiene('rrhh'));

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.msg.set(null);
    const q = this.busqueda().trim();
    this.svc
      .listarInstructores({
        q: q.length >= 2 ? q : undefined,
        activos: this.soloActivos(),
      })
      .subscribe({
        next: (r) => {
          this.instructores.set(r || []);
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          this.msg.set(e?.error?.message || 'Error cargando instructores');
        },
      });
  }

  setVista(v: VistaLista): void {
    this.vista.set(v);
    saveVistaLista('argo-instructores-vista', v);
  }

  iniciales(e: Empleado): string {
    return inicialesNombre(e.primerNombre, e.primerApellido);
  }

  fotoUrl(f?: string): string | null {
    if (!f) return null;
    if (f.startsWith('http')) return f;
    return `${this.uploads}/${f}`;
  }

  contacto(e: Empleado): string {
    return e.celular || e.telefono || e.correoCorporativo || e.correoPersonal || '—';
  }

  tieneUsuario(e: Empleado): boolean {
    return !!String(e.usuarioLogin || e.idUsuario || '').trim();
  }

  labelAcceso(e: Empleado): string {
    if (!this.tieneUsuario(e)) return 'Sin acceso';
    return e.usuarioLogin || 'Vinculado';
  }

  irDetalle(e: Empleado, ev?: Event): void {
    ev?.stopPropagation();
    void this.router.navigate(['/app/instructores', e.idEmpleado]);
  }
}
