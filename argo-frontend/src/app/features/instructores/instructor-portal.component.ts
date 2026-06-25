import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import {
  ActualizarPerfilInstructorBody,
  ClaseInstructorPortalDto,
  InstructorPortalService,
  labelOrigenClaseInstructor,
  labelTipoClaseInstructor,
} from '../../core/services/instructor-portal.service';
import { InstructorPortalAlertService } from '../../core/services/instructor-portal-alert.service';
import { PermisoService } from '../../core/services/permiso.service';
import type { Empleado } from '../../core/services/empleado.service';
import { VehiculoService } from '../../core/services/vehiculo.service';
import { inicialesNombre } from '../../core/utils/vista-lista.helpers';
import { environment } from '../../../environments/environment';
import { FormModalComponent } from '../../shared/form-modal/form-modal.component';
import { InstructorPortalMisClasesComponent } from './instructor-portal-mis-clases.component';

@Component({
  selector: 'argo-instructor-portal',
  standalone: true,
  imports: [CommonModule, FormsModule, FormModalComponent, InstructorPortalMisClasesComponent],
  templateUrl: './instructor-portal.component.html',
  styleUrls: ['./instructor-portal.component.scss'],
})
export class InstructorPortalComponent implements OnInit {
  private svc = inject(InstructorPortalService);
  private alertSvc = inject(InstructorPortalAlertService);
  private auth = inject(AuthService);
  private permisos = inject(PermisoService);
  private vehiculoSvc = inject(VehiculoService);
  private router = inject(Router);

  uploads = environment.uploadsUrl;

  loading = signal(true);
  error = signal<string | null>(null);
  msg = signal<string | null>(null);

  perfil = signal<Empleado | null>(null);

  modalEditar = signal(false);
  savingPerfil = signal(false);
  formPerfil: ActualizarPerfilInstructorBody = {};

  usuarioLogin = computed(() => this.perfil()?.usuarioLogin || this.auth.user()?.username || '—');

  labelOrigen = labelOrigenClaseInstructor;
  labelTipo = labelTipoClaseInstructor;

  alertas = this.alertSvc.data;
  bannerProxima = this.alertSvc.bannerProximaVisible;
  bannerAsignadas = this.alertSvc.bannerAsignadasVisible;
  bannerInspeccion = this.alertSvc.bannerInspeccionVisible;
  proximas = this.alertSvc.proximas;
  asignadasNuevas = this.alertSvc.asignadasNuevas;
  inspeccionInfo = this.alertSvc.inspeccion;

  puedeInspeccion = computed(() => this.permisos.tiene('instructores.inspeccion'));

  ngOnInit(): void {
    if (!this.auth.puedeUsarPortalInstructor()) {
      this.loading.set(false);
      this.error.set(
        'No puede usar el portal del instructor. Verifique permisos del rol y que su usuario esté vinculado a un empleado con cargo de instructor en RRHH.',
      );
      return;
    }
    this.cargarTodo();
    this.cargarAlertas();
  }

  cargarTodo() {
    this.loading.set(true);
    this.error.set(null);
    this.svc.miPerfil().subscribe({
      next: (p) => {
        this.perfil.set(p);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e?.error?.message || 'No se pudo cargar su perfil de instructor.');
      },
    });
  }

  cargarAlertas() {
    this.svc.misAlertas({ minutos: 20, diasAsignacion: 3 }).subscribe({
      next: (r) => this.alertSvc.actualizar(r),
      error: () => this.alertSvc.actualizar(null),
    });
  }

  iniciales(p: Empleado | null): string {
    if (!p) return '?';
    return inicialesNombre(p.primerNombre, p.primerApellido);
  }

  fotoUrl(f?: string): string | null {
    if (!f) return null;
    if (f.startsWith('http')) return f;
    return `${this.uploads}/${f}`;
  }

  contacto(p: Empleado): string {
    return p.celular || p.telefono || p.correoCorporativo || p.correoPersonal || '—';
  }

  abrirEditar() {
    const p = this.perfil();
    if (!p) return;
    this.formPerfil = {
      correoPersonal: p.correoPersonal || '',
      correoCorporativo: p.correoCorporativo || '',
      telefono: p.telefono || '',
      celular: p.celular || '',
      direccion: p.direccion || '',
      ciudad: p.ciudad || '',
      departamento: p.departamento || '',
    };
    this.modalEditar.set(true);
  }

  cerrarEditar() {
    this.modalEditar.set(false);
  }

  guardarPerfil() {
    this.savingPerfil.set(true);
    this.svc.actualizarMiPerfil(this.formPerfil).subscribe({
      next: (p) => {
        this.perfil.set(p);
        this.savingPerfil.set(false);
        this.modalEditar.set(false);
        this.msg.set('Datos actualizados.');
        setTimeout(() => this.msg.set(null), 3500);
      },
      error: (e) => {
        this.savingPerfil.set(false);
        this.msg.set(e?.error?.message || 'No se pudo guardar.');
      },
    });
  }

  irOperarClase(c: ClaseInstructorPortalDto) {
    if (c.origen === 'jornada') {
      void this.router.navigate(['/app/jornadas/instructor'], {
        queryParams: c.idJornada ? { jornada: c.idJornada, clase: c._id } : { clase: c._id },
      });
      return;
    }
    void this.router.navigate(['/app/programacion-cea/clases-hoy'], {
      queryParams: { clase: c._id },
    });
  }

  abrirInspeccion() {
    const v = this.inspeccionInfo()?.vehiculo;
    if (!v) return;
    this.alertSvc.ocultarInspeccionTemporal();

    if (v._id) {
      this.irFichaVehiculoInspeccion(String(v._id));
      return;
    }

    const placa = String(v.placa || '').trim();
    if (!placa) return;

    this.vehiculoSvc.verificarPlaca(placa).subscribe({
      next: (r) => {
        if (r.existe && r.vehiculo?._id) {
          this.irFichaVehiculoInspeccion(r.vehiculo._id);
        } else {
          this.msg.set(`No se encontró el vehículo ${placa} en el sistema.`);
        }
      },
      error: () => this.msg.set('No se pudo resolver el vehículo para la inspección.'),
    });
  }

  private irFichaVehiculoInspeccion(vehiculoId: string): void {
    void this.router.navigate(['/app/vehiculos', vehiculoId], {
      queryParams: { tab: 'inspeccion', inspeccionHoy: '1' },
    });
  }

  cerrarBannerProxima() {
    this.alertSvc.cerrarProxima();
  }

  cerrarBannerAsignadas() {
    this.alertSvc.cerrarAsignadas();
  }
}
