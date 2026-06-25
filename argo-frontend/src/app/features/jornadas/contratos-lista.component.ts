import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ContratacionDto, JornadaCapService } from '../../core/services/jornada-cap.service';
import { PermisoService } from '../../core/services/permiso.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import {
  capCliente,
  capCodContrato,
  capMetaNum,
  capMunicipioJor,
  capSesCert,
  capGenerado,
  etiquetaGenerado,
  estadoContratoLiveClass,
  labelEstadoContrato,
  rowContratoClass,
  esContratoEnEjecucion,
} from './jornada-ui.util';

const ESTADOS: ReadonlyArray<'En Ejecución' | 'Ejecutado'> = ['En Ejecución', 'Ejecutado'];

@Component({
  selector: 'argo-contratos-lista',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './contratos-lista.component.html',
  styleUrls: ['./contratos-lista.component.scss'],
})
export class ContratosListaComponent implements OnInit {
  private jornadaSvc = inject(JornadaCapService);
  private permisoSvc = inject(PermisoService);
  private confirmSvc = inject(ConfirmDialogService);
  private router = inject(Router);

  ESTADOS_CONTRATO = ESTADOS;

  loading = signal(false);
  contratos = signal<ContratacionDto[]>([]);
  query = signal('');
  estadoFiltro = signal<'' | 'En Ejecución' | 'Ejecutado'>('');
  msg = signal<string | null>(null);
  msgEsError = signal(false);

  puedeGestionar = computed(() => this.permisoSvc.tiene('jornadas.gestionar'));

  contratosFiltrados = computed(() => {
    const q = this.query().trim().toLowerCase();
    const est = this.estadoFiltro();
    return this.contratos().filter((c) => {
      if (est && (c.estado || 'En Ejecución') !== est) return false;
      if (!q) return true;
      const campos = [
        c.codContrato,
        c.nombreComercial,
        c.razoSocial,
        c.numeroIdentificacion,
        c.ciudad,
        c.departamento,
        c.supervisor,
        c.objetoContrato,
      ];
      return campos.some((v) => String(v || '').toLowerCase().includes(q));
    });
  });

  total = computed(() => this.contratos().length);
  totalFiltrado = computed(() => this.contratosFiltrados().length);
  enEjecucionCount = computed(
    () => this.contratos().filter((c) => esContratoEnEjecucion(c.estado)).length,
  );

  capCliente = capCliente;
  capCodContrato = capCodContrato;
  capMunicipioJor = capMunicipioJor;
  capMetaNum = capMetaNum;
  capSesCert = capSesCert;
  capGenerado = capGenerado;
  etiquetaGenerado = etiquetaGenerado;
  estadoContratoLiveClass = estadoContratoLiveClass;
  labelEstadoContrato = labelEstadoContrato;
  rowContratoClass = rowContratoClass;

  ngOnInit(): void {
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.jornadaSvc.listarContratos().subscribe({
      next: (rows) => {
        this.contratos.set(rows || []);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.mostrarMsg(e?.error?.message || 'No se pudieron cargar los contratos.', true);
      },
    });
  }

  esEnEjecucion(c: ContratacionDto): boolean {
    return esContratoEnEjecucion(c.estado);
  }

  labelCliente(c: ContratacionDto): string {
    const nom = (c.clienteNombre || c.nombreComercial || c.razoSocial || '').trim();
    const id = (c.clienteIdentificacion || c.numeroIdentificacion || '').trim();
    if (nom && id) return `${nom} (${id})`;
    return nom || id || '—';
  }

  labelCiudad(c: ContratacionDto): string {
    if (c.ciudad && c.departamento) return `${c.ciudad} — ${c.departamento}`;
    return c.ciudad || c.departamento || '—';
  }

  nuevoContrato() {
    void this.router.navigate(['/app/jornadas'], { queryParams: { nuevo: '1' } });
  }

  editarContrato(c: ContratacionDto) {
    if (!c._id) return;
    void this.router.navigate(['/app/jornadas'], { queryParams: { contrato: c._id } });
  }

  async eliminar(c: ContratacionDto) {
    if (!c._id) return;
    if (!this.puedeGestionar()) {
      this.mostrarMsg('No tiene permiso para eliminar contratos.', true);
      return;
    }
    const ok = await this.confirmSvc.open({
      title: 'Eliminar contrato',
      message: `¿Eliminar el contrato ${c.codContrato || this.labelCliente(c)}? Solo se permite si no tiene jornadas con clases o asistencias.`,
      variant: 'danger',
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    this.jornadaSvc.eliminarContrato(c._id).subscribe({
      next: (r) => {
        this.mostrarMsg(r.message || 'Contrato eliminado.');
        this.cargar();
      },
      error: (e) =>
        this.mostrarMsg(e?.error?.message || 'No se pudo eliminar el contrato.', true),
    });
  }

  mostrarMsg(texto: string, error = false) {
    this.msg.set(texto);
    this.msgEsError.set(error);
    setTimeout(() => {
      if (this.msg() === texto) this.msg.set(null);
    }, 6000);
  }

  cerrarMsg() {
    this.msg.set(null);
  }
}
