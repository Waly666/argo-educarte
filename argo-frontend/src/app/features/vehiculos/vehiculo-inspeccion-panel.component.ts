import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  InspeccionChecklistGrupo,
  InspeccionVehiculoDto,
  InspeccionVehiculoResumen,
  InspeccionVehiculoService,
} from '../../core/services/inspeccion-vehiculo.service';
import { AuthService } from '../../core/services/auth.service';
import { VehiculoInspeccionAlertService } from '../../core/services/vehiculo-inspeccion-alert.service';
import { InstructorPortalAlertService } from '../../core/services/instructor-portal-alert.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';

type ModoPanel = 'listado' | 'formulario';

@Component({
  selector: 'argo-vehiculo-inspeccion-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vehiculo-inspeccion-panel.component.html',
  styleUrls: ['./vehiculo-inspeccion-panel.component.scss'],
})
export class VehiculoInspeccionPanelComponent implements OnChanges {
  private svc = inject(InspeccionVehiculoService);
  private auth = inject(AuthService);
  private confirm = inject(ConfirmDialogService);
  private inspeccionAlert = inject(VehiculoInspeccionAlertService);
  private instructorPortalAlert = inject(InstructorPortalAlertService);

  @Input({ required: true }) vehiculoId!: string;
  /** Abre directamente el formulario del día (sin pasar por el listado). */
  @Input() abrirFormularioHoy = false;
  /** Oculta navegación al listado (flujo embebido al iniciar clase). */
  @Input() modoInline = false;

  @Output() inspeccionGuardada = new EventEmitter<InspeccionVehiculoDto>();

  modo = signal<ModoPanel>('listado');
  loading = signal(false);
  loadingLista = signal(false);
  saving = signal(false);
  msg = signal<string | null>(null);
  err = signal<string | null>(null);
  inspeccion = signal<InspeccionVehiculoDto | null>(null);
  listado = signal<InspeccionVehiculoResumen[]>([]);
  totalListado = signal(0);
  fechaFormulario = signal<string | null>(null);
  private lineaBase = signal('');
  saveAlarmFlash = signal(false);

  formSinGuardar = computed(() => {
    const ins = this.inspeccion();
    if (!ins || this.loading()) return false;
    if (!ins.guardada) return true;
    const base = this.lineaBase();
    if (!base) return false;
    return this.firmaEstadoActual(ins) !== base;
  });

  saveAlarmVisible = computed(() => this.formSinGuardar() && !this.saving() && !this.loading());

  saveAlarmTexto = computed(() => {
    const ins = this.inspeccion();
    if (!ins?.guardada) return 'Guarde la inspección del día';
    return 'Cambios sin guardar';
  });

  ngOnChanges(): void {
    if (this.vehiculoId) {
      this.inspeccion.set(null);
      if (this.abrirFormularioHoy) {
        this.abrirFormulario();
      } else {
        this.modo.set('listado');
        this.cargarListado();
      }
    }
  }

  cargarListado(): void {
    this.loadingLista.set(true);
    this.err.set(null);
    this.svc.listar(this.vehiculoId, { limit: 100 }).subscribe({
      next: (res) => {
        this.listado.set(res.inspecciones || []);
        this.totalListado.set(res.total || 0);
        this.loadingLista.set(false);
      },
      error: (e) => {
        this.loadingLista.set(false);
        this.err.set(e?.error?.message || 'No se pudo cargar el listado de inspecciones');
      },
    });
  }

  nuevaInspeccion(): void {
    this.abrirFormulario();
  }

  abrirInspeccion(row: InspeccionVehiculoResumen): void {
    this.abrirFormulario(row.fecha);
  }

  volverListado(): void {
    this.modo.set('listado');
    this.inspeccion.set(null);
    this.fechaFormulario.set(null);
    this.msg.set(null);
    this.err.set(null);
    this.cargarListado();
  }

  abrirFormulario(fecha?: string): void {
    this.modo.set('formulario');
    this.msg.set(null);
    this.err.set(null);
    this.cargarFormulario(fecha);
  }

  cargarFormulario(fecha?: string): void {
    this.loading.set(true);
    this.inspeccion.set(null);
    this.svc.obtenerDelDia(this.vehiculoId, fecha).subscribe({
      next: (dto) => {
        this.inspeccion.set({ ...dto });
        this.fechaFormulario.set(dto.fecha);
        this.lineaBase.set(this.firmaEstadoActual(dto));
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.err.set(e?.error?.message || 'No se pudo cargar la inspección');
      },
    });
  }

  patchCampo<K extends keyof InspeccionVehiculoDto>(key: K, value: InspeccionVehiculoDto[K]): void {
    this.inspeccion.update((i) => (i ? { ...i, [key]: value } : i));
  }

  setSi(grupoIndex: number, lineaIndex: number, si: boolean): void {
    this.inspeccion.update((ins) => {
      if (!ins) return ins;
      const grupos = this.cloneGrupos(ins.grupos);
      const linea = grupos[grupoIndex]?.lineas[lineaIndex];
      if (!linea) return ins;
      grupos[grupoIndex].lineas[lineaIndex] = { ...linea, si };
      return { ...ins, grupos };
    });
  }

  setObs(grupoIndex: number, lineaIndex: number, observacion: string): void {
    this.inspeccion.update((ins) => {
      if (!ins) return ins;
      const grupos = this.cloneGrupos(ins.grupos);
      const linea = grupos[grupoIndex]?.lineas[lineaIndex];
      if (!linea) return ins;
      grupos[grupoIndex].lineas[lineaIndex] = { ...linea, observacion };
      return { ...ins, grupos };
    });
  }

  private cloneGrupos(grupos: InspeccionChecklistGrupo[] | undefined): InspeccionChecklistGrupo[] {
    return (grupos || []).map((g) => ({
      ...g,
      lineas: (g.lineas || []).map((l) => ({ ...l })),
    }));
  }

  totalLineasChecklist(ins: InspeccionVehiculoDto): number {
    return (ins.grupos || []).reduce((n, g) => n + (g.lineas?.length || 0), 0);
  }

  guardar(): void {
    const dto = this.inspeccion();
    if (!dto) return;
    if (dto.guardada && !this.formSinGuardar()) {
      this.dispararAlertaGuardar('No hay cambios pendientes por guardar.');
      return;
    }
    if (!this.auth.user()?.idEmpleado) {
      this.dispararAlertaGuardar('Su usuario debe estar vinculado a un empleado en RRHH para guardar inspecciones.');
      return;
    }
    if (dto.aptoLaborar == null) {
      this.dispararAlertaGuardar('Indique si el vehículo está apto para laborar (Sí o No).');
      return;
    }
    void this.confirmarGuardado(dto);
  }

  private dispararAlertaGuardar(texto: string): void {
    this.msg.set(null);
    this.err.set(texto);
    this.saveAlarmFlash.set(true);
    setTimeout(() => this.saveAlarmFlash.set(false), 3200);
  }

  private firmaEstadoActual(dto: InspeccionVehiculoDto): string {
    const grupos = (dto.grupos || []).map((g) => ({
      idItem: g.idItem,
      lineas: (g.lineas || []).map((l) => ({
        id: l.id,
        si: l.si ?? null,
        observacion: String(l.observacion || '').trim(),
      })),
    }));
    return JSON.stringify({
      hora: String(dto.hora || '').trim(),
      combustible: String(dto.combustible || '').trim(),
      inspector: String(dto.inspector || '').trim(),
      documentoInspector: String(dto.documentoInspector || '').trim(),
      aptoLaborar: dto.aptoLaborar ?? null,
      observacionesGenerales: String(dto.observacionesGenerales || '').trim(),
      urlfotoLatDer: String(dto.urlfotoLatDer || '').trim(),
      urlfotoLatIzq: String(dto.urlfotoLatIzq || '').trim(),
      urlfotoFrontal: String(dto.urlfotoFrontal || '').trim(),
      urlfotoPost: String(dto.urlfotoPost || '').trim(),
      grupos,
    });
  }

  private async confirmarGuardado(dto: InspeccionVehiculoDto): Promise<void> {
    const docsFallan = [...(dto.documentosVehiculo || []), ...(dto.documentosInstructor || [])].filter(
      (d) => d.si === false,
    );
    if (docsFallan.length) {
      const ok = await this.confirm.open({
        title: 'Documentos no al día',
        message: `Hay ${docsFallan.length} documento(s) sin cumplir. ¿Desea guardar la inspección de todas formas?`,
        variant: 'warn',
        confirmLabel: 'Guardar igual',
      });
      if (!ok) return;
    }
    this.saving.set(true);
    this.err.set(null);
    this.msg.set(null);
    this.svc.guardar(this.vehiculoId, dto).subscribe({
      next: (saved) => {
        this.inspeccion.set({ ...saved });
        this.lineaBase.set(this.firmaEstadoActual(saved));
        this.saving.set(false);
        if (saved.avisoRolInstructor) {
          this.msg.set(`Inspección guardada. Aviso: ${saved.avisoRolInstructor}`);
        } else {
          this.msg.set('Inspección guardada.');
        }
        this.inspeccionGuardada.emit(saved);
        this.inspeccionAlert.solicitarActualizacion();
        this.instructorPortalAlert.solicitarActualizacion();
        if (!this.modoInline) {
          this.cargarListado();
        }
      },
      error: (e) => {
        this.saving.set(false);
        this.err.set(e?.error?.message || 'Error al guardar la inspección');
      },
    });
  }

  imprimir(fecha?: string): void {
    this.svc.imprimirHtml(this.vehiculoId, fecha || this.inspeccion()?.fecha, (m) => this.err.set(m));
  }

  etiquetaApto(val?: boolean | null): string {
    if (val === true) return 'Sí';
    if (val === false) return 'No';
    return '—';
  }

  claseApto(val?: boolean | null): string {
    if (val === true) return 'ok';
    if (val === false) return 'err';
    return 'slate';
  }
}
