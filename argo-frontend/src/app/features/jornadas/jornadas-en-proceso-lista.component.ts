import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { JornadaCapDto, JornadaCapService } from '../../core/services/jornada-cap.service';
import { PermisoService } from '../../core/services/permiso.service';
import { JornadaEnProcesoAlertService } from '../../core/services/jornada-en-proceso-alert.service';
import { fmtFechaCalendario } from './jornada-calendario.util';
import {
  capCodContrato,
  capMetaNum,
  capMunicipioJor,
  capFechaJor,
  estadoJornadaLiveClass,
} from './jornada-ui.util';

@Component({
  selector: 'argo-jornadas-en-proceso-lista',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './jornadas-en-proceso-lista.component.html',
  styleUrls: ['./jornadas-en-proceso-lista.component.scss'],
})
export class JornadasEnProcesoListaComponent implements OnInit, OnDestroy {
  private jornadaSvc = inject(JornadaCapService);
  private permisoSvc = inject(PermisoService);
  private procesoAlert = inject(JornadaEnProcesoAlertService);
  private router = inject(Router);

  loading = signal(false);
  jornadas = signal<JornadaCapDto[]>([]);
  query = signal('');
  msg = signal<string | null>(null);

  puedeGestionar = computed(() => this.permisoSvc.tiene('jornadas.gestionar'));
  puedeOperar = computed(() => this.permisoSvc.tiene('jornadas.operar') || this.puedeGestionar());

  filtradas = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.jornadas();
    return this.jornadas().filter((j) => {
      const campos = [
        j.codContrato,
        j.contratoLabel,
        j.clienteNombre,
        j.municipio,
        j.depto,
        j.direccion,
        j.supervisor,
        fmtFechaCalendario(j.fechaProgramacion),
      ];
      return campos.some((v) => String(v || '').toLowerCase().includes(q));
    });
  });

  total = computed(() => this.jornadas().length);

  capCodContrato = capCodContrato;
  capMunicipioJor = capMunicipioJor;
  capMetaNum = capMetaNum;
  capFechaJor = capFechaJor;
  estadoJornadaLiveClass = estadoJornadaLiveClass;
  fmtFecha = fmtFechaCalendario;

  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.cargar();
    this.refreshTimer = setInterval(() => this.cargar(true), 15_000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  cargar(silencioso = false) {
    if (!silencioso) this.loading.set(true);
    this.jornadaSvc.listarJornadasEnProceso().subscribe({
      next: (rows) => {
        const list = rows || [];
        this.jornadas.set(list);
        this.procesoAlert.actualizarDesdeListado(list as unknown as Array<Record<string, unknown>>);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.msg.set(e?.error?.message || 'No se pudieron cargar las jornadas en proceso.');
      },
    });
  }

  cerrarMsg() {
    this.msg.set(null);
  }

  gestionarJornada(j: JornadaCapDto) {
    void this.router.navigate(['/app/jornadas'], {
      queryParams: {
        contrato: j.idContrato,
        tab: 'jornadas',
        jornada: j._id,
      },
    });
  }

  irClases(j: JornadaCapDto) {
    void this.router.navigate(['/app/jornadas'], {
      queryParams: {
        contrato: j.idContrato,
        tab: 'clases',
        jornada: j._id,
      },
    });
  }
}
