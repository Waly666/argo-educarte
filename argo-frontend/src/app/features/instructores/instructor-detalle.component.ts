import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Empleado, EmpleadoService } from '../../core/services/empleado.service';
import { PermisoService } from '../../core/services/permiso.service';
import { inicialesNombre } from '../../core/utils/vista-lista.helpers';
import { environment } from '../../../environments/environment';
import { EmpleadoDocumentosPanelComponent } from '../rrhh/empleado-documentos-panel.component';

type TabDetalle = 'datos' | 'documentos';

@Component({
  selector: 'argo-instructor-detalle',
  standalone: true,
  imports: [CommonModule, RouterLink, EmpleadoDocumentosPanelComponent],
  templateUrl: './instructor-detalle.component.html',
  styleUrls: ['./instructor-detalle.component.scss'],
})
export class InstructorDetalleComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private svc = inject(EmpleadoService);
  private permisos = inject(PermisoService);

  uploads = environment.uploadsUrl;

  loading = signal(true);
  error = signal<string | null>(null);
  instructor = signal<Empleado | null>(null);
  tab = signal<TabDetalle>('datos');

  puedeEditarRrhh = computed(() => this.permisos.tiene('rrhh'));
  puedeDocumentos = computed(() => this.puedeEditarRrhh() && !!this.instructor()?.idEmpleado);

  idEmpleado = computed(() => {
    const p = this.route.snapshot.paramMap.get('idEmpleado');
    return p || '';
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    const id = this.idEmpleado();
    if (!id) {
      this.error.set('Identificador de instructor inválido.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.svc.obtenerInstructor(id).subscribe({
      next: (r) => {
        this.instructor.set(r);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e?.error?.message || 'No se pudo cargar el instructor.');
      },
    });
  }

  setTab(t: TabDetalle): void {
    if (t === 'documentos' && !this.puedeDocumentos()) return;
    this.tab.set(t);
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

  fmtFecha(v?: string | null): string {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString('es-CO');
  }

  fmtMoneda(v?: number | null): string {
    if (v == null || Number.isNaN(Number(v))) return '—';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
      Number(v),
    );
  }

  linkEditarRrhh(): string[] {
    return ['/app/rrhh/empleados'];
  }

  queryEditarRrhh(): Record<string, string> {
    const id = this.instructor()?.idEmpleado;
    return id != null ? { empleado: String(id) } : {};
  }
}
