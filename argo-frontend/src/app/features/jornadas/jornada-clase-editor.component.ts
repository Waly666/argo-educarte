import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { AlumnoListItem } from '../../core/services/alumno.service';
import { AuthService } from '../../core/services/auth.service';
import { CertificadoJornadaAlertService } from '../../core/services/certificado-jornada-alert.service';
import { CertificadoJornadaBloqueoService } from '../../core/services/certificado-jornada-bloqueo.service';
import { JornadaLiveSyncService } from '../../core/services/jornada-live-sync.service';
import {
  ClaseJornadaDto,
  InstructorJornadaDto,
  JornadaCapService,
} from '../../core/services/jornada-cap.service';
import { PermisoService } from '../../core/services/permiso.service';
import { formatNumDoc } from '../../core/utils/num-doc.helpers';
import {
  CatalogoEnumBuscarComponent,
  EnumBuscarOption,
} from '../../shared/catalogo-enum-buscar/catalogo-enum-buscar.component';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { FormModalComponent } from '../../shared/form-modal/form-modal.component';
import { Hora12InputComponent } from '../../shared/hora-12-input/hora-12-input.component';
import { environment } from '../../../environments/environment';
import { AsistenteContextoService } from '../../core/services/asistente-contexto.service';
import { tipFormulario } from '../../core/utils/asistente-formulario.util';
import { esFechaHoy, fmtFechaCalendario } from './jornada-calendario.util';
import {
  JorMsgTipo,
  capAlumnoNombre,
  capDocAsis,
  capEstadoClase,
  capFechaJor,
  capInstructor,
  capPrograma,
  capUbicacionClase,
  claseJornadaSePuedeEliminar,
  estadoClaseLiveClass,
  iconoJorMsg,
  isoAHoraInput,
  tituloJorMsg,
  validarHoraInput,
} from './jornada-ui.util';

@Component({
  selector: 'argo-jornada-clase-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FormModalComponent,
    CatalogoEnumBuscarComponent,
    Hora12InputComponent,
  ],
  templateUrl: './jornada-clase-editor.component.html',
  styleUrls: ['./jornada-clase-editor.component.scss'],
})
export class JornadaClaseEditorComponent implements OnInit, OnDestroy {
  private jornadaSvc = inject(JornadaCapService);
  private auth = inject(AuthService);
  private permisoSvc = inject(PermisoService);
  private certAlertSvc = inject(CertificadoJornadaAlertService);
  private liveSync = inject(JornadaLiveSyncService);
  private certBloqueoSvc = inject(CertificadoJornadaBloqueoService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private confirmSvc = inject(ConfirmDialogService);
  private asistente = inject(AsistenteContextoService);

  constructor() {
    effect(() => {
      if (this.modalOpen()) {
        const sub = this.subtituloModalClase();
        if (sub) {
          this.asistente.setTipsPrepend([tipFormulario('Esta clase', sub, 'jor-ed-clase-ctx')]);
        }
      } else {
        this.asistente.clearTipsPrepend();
      }
    });
  }

  @Input() editorHost = false;
  @Output() claseGuardada = new EventEmitter<ClaseJornadaDto>();

  modalOpen = signal(false);
  claseSel = signal('');
  claseActiva = signal<ClaseJornadaDto | null>(null);
  programasJornada = signal<any[]>([]);
  instructores = signal<InstructorJornadaDto[]>([]);

  nuevaClaseProg = signal('');
  nuevaClaseUbic = signal('Carpa');
  modalHoraInicio = signal('');
  modalHoraFin = signal('');
  modalClaseInstructorId = signal<number | ''>('');
  modalFechaClase = signal('');
  modalCrearJornadaId = signal('');

  subiendoFotoEvidencia = signal(false);
  guardandoClase = signal(false);
  alumnoBusqueda = signal('');
  alumnoBusquedaOpen = signal(false);
  alumnoBusquedaLoading = signal(false);
  alumnoBusquedaResults = signal<AlumnoListItem[]>([]);
  guardandoAsistencia = signal<number | null>(null);
  guardandoInscripcion = signal(false);
  cronometroDisplay = signal('00:00:00');

  modalMsg = signal<string | null>(null);
  modalMsgTipo = signal<JorMsgTipo>('info');
  modalMsgTitulo = signal('');

  inscritos = signal<
    Array<{
      numDoc: number;
      nombreCompleto: string;
      tieneAsistencia: boolean;
      asistenciaAt?: string | null;
      yaCertificadoContrato?: boolean;
      certificadoCodigo?: string | null;
      certificadoId?: string | null;
    }>
  >([]);

  private cronometroTimer: ReturnType<typeof setInterval> | null = null;
  private alumnoBusqueda$ = new Subject<string>();

  readonly ubicaciones = ['Carpa', 'Domo', 'Empresa', 'Colegio', 'Auditorio', 'Coliseo', 'Estadio', 'Otro'];

  iconoJorMsg = iconoJorMsg;
  capEstadoClase = capEstadoClase;
  capUbicacionClase = capUbicacionClase;
  capFechaJor = capFechaJor;
  capDocAsis = capDocAsis;
  capAlumnoNombre = capAlumnoNombre;
  capPrograma = capPrograma;
  capInstructor = capInstructor;
  estadoClaseLiveClass = estadoClaseLiveClass;
  claseJornadaSePuedeEliminar = claseJornadaSePuedeEliminar;

  puedeOperarJornada = computed(() =>
    this.permisoSvc.tiene(['jornadas.operar', 'jornadas.gestionar']),
  );
  puedeAsignarInstructor = computed(() => this.permisoSvc.tiene('jornadas.gestionar'));
  puedeEliminarClase = computed(() => this.permisoSvc.tiene('jornadas.gestionar'));
  puedeEliminarClaseActiva = computed(
    () => this.puedeEliminarClase() && claseJornadaSePuedeEliminar(this.claseActiva()?.estado),
  );

  instructorSesionNombre = computed(
    () => this.auth.user()?.empleado?.nombreCompleto || this.auth.user()?.username || '—',
  );

  inscritosConAsistencia = computed(() => this.inscritos().filter((i) => i.tieneAsistencia).length);
  inscritosPendientesAsistencia = computed(() =>
    this.inscritos().filter((i) => !i.tieneAsistencia && !i.yaCertificadoContrato),
  );
  inscritosSinAsistencia = computed(() => this.inscritosPendientesAsistencia().length);
  inscritosCertificadosContrato = computed(() =>
    this.inscritos().filter((i) => i.yaCertificadoContrato).length,
  );
  totalAlumnosMatriculadosModal = computed(() => this.inscritos().length);

  opcionesUbicacionClase = computed<EnumBuscarOption[]>(() =>
    this.ubicaciones.map((u) => ({ value: u, label: u })),
  );
  textoUbicacionClase = computed(() => this.nuevaClaseUbic() || 'Carpa');

  opcionesInstructoresModal = computed<EnumBuscarOption[]>(() => [
    { value: '', label: '— Automático (usuario actual) —' },
    ...this.instructores().map((i) => ({
      value: i.idEmpleado,
      label: i.nombreCompleto,
    })),
  ]);

  textoInstructorModal = computed(() => {
    const id = this.modalClaseInstructorId();
    if (!id) return '— Automático (usuario actual) —';
    const i = this.instructores().find((x) => Number(x.idEmpleado) === Number(id));
    return i?.nombreCompleto || '';
  });

  opcionesProgramasModal = computed<EnumBuscarOption[]>(() => {
    const base = this.programasJornada().map((p) => ({
      value: this.programaOptionValue(p),
      label: String(p.nombreProg || p.codigoProg || ''),
    }));
    const v = this.nuevaClaseProg();
    if (v && !this.buscarProgramaEnLista(v)) {
      return [{ value: v, label: this.etiquetaProgramaModal() }, ...base];
    }
    return base;
  });

  textoProgramaModalCombo = computed(() => {
    const v = this.nuevaClaseProg();
    if (!v) return '';
    return this.etiquetaProgramaModal();
  });

  textoJornadaModal = computed(() => {
    const cl = this.claseActiva();
    if (!cl) return '';
    const base = cl.contratoLabel || cl.codContrato || 'Jornada';
    const estado = cl.jornadaEstado || '';
    return estado ? `${base} — ${estado}` : base;
  });

  opcionesJornadaModal = computed<EnumBuscarOption[]>(() => {
    const id = this.modalCrearJornadaId();
    if (!id) return [];
    return [{ value: id, label: this.textoJornadaModal() || id }];
  });

  subtituloModalClase = computed(() => {
    const cl = this.claseActiva();
    if (!cl) return '';
    return this.labelJornadaClase(cl);
  });

  ngOnInit(): void {
    this.cargarProgramasJornada();
    this.cargarInstructores();
    this.alumnoBusqueda$
      .pipe(
        debounceTime(220),
        distinctUntilChanged(),
        switchMap((q) => {
          this.alumnoBusquedaLoading.set(true);
          return this.jornadaSvc.buscarAlumnos(q, 12);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (rows) => {
          this.alumnoBusquedaLoading.set(false);
          this.alumnoBusquedaResults.set(rows || []);
        },
        error: () => {
          this.alumnoBusquedaLoading.set(false);
          this.alumnoBusquedaResults.set([]);
        },
      });
  }

  ngOnDestroy(): void {
    this.detenerCronometro();
  }

  abrirClaseDesdeHost(claseOrId: ClaseJornadaDto | string, idJornadaHint?: string): void {
    const abrir = (c: ClaseJornadaDto) => {
      if (!this.puedeOperarJornada()) {
        this.mostrarMsg('No tiene permiso para operar clases de jornada.', 'error', 'Sin permiso');
        return;
      }
      this.abrirModalEditarClase(c);
    };

    if (typeof claseOrId !== 'string') {
      abrir(claseOrId);
      return;
    }

    this.jornadaSvc.obtenerClase(claseOrId).subscribe({
      next: abrir,
      error: () => {
        const opts = idJornadaHint ? { idJornada: idJornadaHint } : {};
        this.jornadaSvc.listarClases(opts).subscribe({
          next: (rows) => {
            const hit = (rows || []).find((x) => x._id === claseOrId);
            if (hit) abrir(hit);
            else this.mostrarMsg('No se encontró la clase.', 'error', 'Error');
          },
          error: (e) =>
            this.mostrarMsg(e?.error?.message || 'No se pudo cargar la clase.', 'error', 'Error'),
        });
      },
    });
  }

  private abrirModalEditarClase(c: ClaseJornadaDto): void {
    this.claseSel.set(c._id);
    this.claseActiva.set(c);
    this.modalCrearJornadaId.set(String(c.idJornada || ''));
    this.modalFechaClase.set(
      c.fechaClase ? String(c.fechaClase) : c.fechaJornada ? String(c.fechaJornada) : '',
    );
    this.nuevaClaseProg.set(String(c.idPrograma || ''));
    this.nuevaClaseUbic.set(c.ubicacion || 'Carpa');
    this.modalClaseInstructorId.set(c.idEmpleadoInstructor ?? '');
    this.modalHoraInicio.set(isoAHoraInput(c.horaInicio));
    this.modalHoraFin.set(isoAHoraInput(c.horaFin));
    this.alumnoBusqueda.set('');
    this.alumnoBusquedaResults.set([]);
    this.alumnoBusquedaOpen.set(false);
    this.inscritos.set([]);
    this.limpiarMsgModal();
    this.sincronizarProgramaModal(String(c.idPrograma || ''));
    this.cargarProgramasJornada();
    this.cargarInscritos(c._id);
    this.modalOpen.set(true);
    this.iniciarCronometroSiAplica();
  }

  cerrarModal(): void {
    if (this.guardandoClase()) return;
    this.detenerCronometro();
    this.modalOpen.set(false);
    this.alumnoBusquedaOpen.set(false);
    this.limpiarMsgModal();
    this.emitClaseGuardada();
  }

  private emitClaseGuardada(): void {
    const cl = this.claseActiva();
    if (cl) this.claseGuardada.emit(cl);
  }

  cargarProgramasJornada(): void {
    this.jornadaSvc.programasJornadaCap().subscribe({
      next: (p) => {
        this.programasJornada.set(p || []);
        const idRaw = this.nuevaClaseProg() || this.claseActiva()?.idPrograma;
        if (idRaw) this.sincronizarProgramaModal(String(idRaw));
      },
      error: () => this.programasJornada.set([]),
    });
  }

  cargarInstructores(): void {
    this.jornadaSvc.listarInstructores().subscribe({
      next: (r) => this.instructores.set(r || []),
      error: () => this.instructores.set([]),
    });
  }

  cargarInscritos(idClase: string): void {
    this.jornadaSvc.inscritosClase(idClase).subscribe({
      next: (rows) => this.inscritos.set(rows || []),
      error: () => this.inscritos.set([]),
    });
  }

  programaOptionValue(p: { idPrograma?: unknown; _id?: unknown; idProg?: unknown }): string {
    if (p?.idPrograma != null && String(p.idPrograma).trim() !== '') return String(p.idPrograma);
    if (p?._id != null) return String(p._id);
    if (p?.idProg != null && String(p.idProg).trim() !== '') return String(p.idProg);
    return '';
  }

  buscarProgramaEnLista(idProg?: string | null) {
    const id = String(idProg ?? '').trim();
    if (!id) return undefined;
    return this.programasJornada().find((p) => {
      const claves = [p.idPrograma, p._id, p.idProg, p.codigoProg]
        .filter((v) => v != null && String(v).trim() !== '')
        .map((v) => String(v));
      return claves.includes(id);
    });
  }

  sincronizarProgramaModal(idProgRaw?: string | null): void {
    const id = String(idProgRaw ?? '').trim();
    if (!id) {
      this.nuevaClaseProg.set('');
      return;
    }
    const hit = this.buscarProgramaEnLista(id);
    this.nuevaClaseProg.set(hit ? this.programaOptionValue(hit) : id);
  }

  etiquetaProgramaModal(): string {
    const v = this.nuevaClaseProg();
    if (!v) return '';
    const p = this.buscarProgramaEnLista(v);
    if (p) return String(p.nombreProg || p.codigoProg || v);
    const cl = this.claseActiva();
    return String(cl?.programaNombre || v);
  }

  labelJornadaClase(cl: ClaseJornadaDto): string {
    const f = this.fmtFecha(cl.fechaClase || cl.fechaJornada);
    const idx = cl.indiceEnDia && cl.indiceEnDia > 1 ? ` #${cl.indiceEnDia}` : '';
    const m = cl.municipioJornada ? ` · ${cl.municipioJornada}` : '';
    return `${f}${idx}${m}`;
  }

  claseEsHoy(cl?: ClaseJornadaDto | null): boolean {
    if (!cl) return false;
    return esFechaHoy(cl.fechaClase || cl.fechaJornada);
  }

  jornadaClaseModalOperable(): boolean {
    const cl = this.claseActiva();
    if (!cl) return false;
    if (!this.claseEsHoy(cl)) return false;
    return cl.jornadaEstado === 'EN PROCESO';
  }

  claseModalIniciable(): boolean {
    const cl = this.claseActiva();
    if (!cl || cl.estado === 'FINALIZADO') return false;
    if (cl.estado === 'EN PROCESO' && cl.horaInicio) return false;
    return this.jornadaClaseModalOperable();
  }

  tituloBotonIniciarClase(): string {
    const cl = this.claseActiva();
    if (cl && !this.claseEsHoy(cl)) {
      return 'Solo puede iniciar la clase el día programado (hoy).';
    }
    if (!this.jornadaClaseModalOperable()) {
      return 'Solo puede iniciar la clase el día de la jornada (EN PROCESO).';
    }
    if (!this.claseModalIniciable()) {
      return 'La clase ya está iniciada o finalizada.';
    }
    return 'Iniciar clase y registrar hora de inicio';
  }

  claseModalFinalizable(): boolean {
    const cl = this.claseActiva();
    return !!cl && cl.estado === 'EN PROCESO';
  }

  claseModalEnProceso(): boolean {
    return this.claseActiva()?.estado === 'EN PROCESO';
  }

  puedeMarcarAsistenciaInscrito(): boolean {
    if (this.claseModalEnProceso()) return true;
    return this.puedeEliminarClase() && this.claseActiva()?.estado === 'FINALIZADO';
  }

  puedeMarcarAsistenciaAlumno(a: { yaCertificadoContrato?: boolean; tieneAsistencia?: boolean }): boolean {
    if (a.yaCertificadoContrato && !a.tieneAsistencia) return false;
    return this.puedeMarcarAsistenciaInscrito();
  }

  puedeBorrarAsistenciaDeClase(): boolean {
    if (this.puedeEliminarClase()) return true;
    return this.claseModalEnProceso();
  }

  puedeQuitarInscritoDeClase(): boolean {
    if (this.puedeEliminarClase()) return true;
    return this.claseActiva()?.estado !== 'FINALIZADO';
  }

  idContratoParaClaseModal(): string {
    return this.claseActiva()?.idContrato || '';
  }

  formatDuracion(totalSegundos: number): string {
    const secs = Math.max(0, Math.floor(totalSegundos));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
  }

  lapsoClaseEtiqueta(): string {
    const cl = this.claseActiva();
    if (!cl) return '';
    if (cl.duracionSegundos != null) return this.formatDuracion(cl.duracionSegundos);
    if (this.claseModalEnProceso() && cl.horaInicio) return this.cronometroDisplay();
    return '';
  }

  fmtFecha(f?: string | Date): string {
    return fmtFechaCalendario(f);
  }

  fmtHora(f?: string): string {
    if (!f) return '—';
    return new Date(f).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  urlFotoEvidencia(path?: string | null): string {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    return `${environment.uploadsUrl}/${path.replace(/^\/+/, '')}`;
  }

  limpiarMsgModal(): void {
    this.modalMsg.set(null);
    this.modalMsgTitulo.set('');
  }

  mostrarMsg(texto: string, tipo: JorMsgTipo = 'info', titulo?: string): void {
    this.modalMsg.set(texto);
    this.modalMsgTipo.set(tipo);
    this.modalMsgTitulo.set(titulo ?? tituloJorMsg(tipo));
  }

  mostrarMsgModal(texto: string, tipo: JorMsgTipo = 'info', titulo?: string): void {
    this.mostrarMsg(texto, tipo, titulo);
  }

  guardarCambiosClaseModal(): void {
    const id = this.claseSel();
    if (!id) return;
    const dto: {
      idPrograma?: string;
      ubicacion?: string;
      idEmpleadoInstructor?: number;
      horaInicio?: string | null;
      horaFin?: string | null;
    } = {
      idPrograma: this.nuevaClaseProg(),
      ubicacion: this.nuevaClaseUbic(),
    };
    if (this.puedeAsignarInstructor() && this.modalClaseInstructorId()) {
      dto.idEmpleadoInstructor = Number(this.modalClaseInstructorId());
    }
    if (this.puedeAsignarInstructor()) {
      const hi = this.modalHoraInicio().trim();
      const hf = this.modalHoraFin().trim();
      if (!validarHoraInput(hi) || !validarHoraInput(hf)) {
        this.mostrarMsg('Use formato HH:mm (ej. 08:30).', 'error', 'Horario inválido');
        return;
      }
      dto.horaInicio = hi || null;
      dto.horaFin = hf || null;
    }
    this.jornadaSvc.actualizarClase(id, dto).subscribe({
      next: (c) => {
        this.claseActiva.set(c);
        this.modalHoraInicio.set(isoAHoraInput(c.horaInicio));
        this.modalHoraFin.set(isoAHoraInput(c.horaFin));
        this.iniciarCronometroSiAplica();
        this.cargarInscritos(id);
        this.mostrarMsg('Cambios guardados.', 'ok', 'Clase actualizada');
        this.emitClaseGuardada();
      },
      error: (e) => this.mostrarMsg(e?.error?.message || 'No se pudo guardar la clase.', 'error', 'Error'),
    });
  }

  iniciarClaseModal(): void {
    const id = this.claseSel();
    if (!id || !this.claseModalIniciable()) return;
    this.jornadaSvc.iniciarClase(id).subscribe({
      next: (c) => {
        this.claseActiva.set(c);
        this.iniciarCronometroSiAplica();
        this.cargarInscritos(id);
        this.liveSync.notificarClaseIniciada(c as unknown as Record<string, unknown>);
        this.mostrarMsg('Clase iniciada. El cronómetro está activo.', 'ok', 'Clase iniciada');
        this.emitClaseGuardada();
      },
      error: (e) => this.mostrarMsg(e?.error?.message || 'No se pudo iniciar la clase.', 'error', 'Error'),
    });
  }

  finalizarClaseModal(): void {
    const id = this.claseSel();
    if (!id) return;
    this.jornadaSvc.finalizarClase(id).subscribe({
      next: (r: any) => {
        const c = r?.clase || { ...this.claseActiva(), estado: 'FINALIZADO' };
        this.claseActiva.set(c);
        this.detenerCronometro();
        this.actualizarCronometroDisplay();
        this.cargarInscritos(id);
        const lapso =
          c.duracionSegundos != null ? this.formatDuracion(c.duracionSegundos) : this.cronometroDisplay();
        let msg = `Clase finalizada. Duración: ${lapso}.`;
        if (r?.asistenciasRegistradas > 0) {
          msg += ` Asistencia registrada a ${r.asistenciasRegistradas} alumno(s).`;
        }
        if (r?.certificadosGenerados > 0) {
          msg += ` Certificados emitidos: ${r.certificadosGenerados}.`;
          this.certAlertSvc.notificarVariosDesdeRespuesta(r?.certificadosEmitidos);
        }
        this.liveSync.notificarClaseFinalizada(c as unknown as Record<string, unknown>);
        this.mostrarMsgModal(msg, r?.certificadosGenerados > 0 ? 'ok' : 'info', 'Clase finalizada');
        this.mostrarMsg(msg, r?.certificadosGenerados > 0 ? 'ok' : 'info', 'Clase finalizada');
        this.emitClaseGuardada();
      },
      error: (e) => this.mostrarMsg(e?.error?.message || 'No se pudo finalizar la clase.', 'error', 'Error'),
    });
  }

  sincronizarAsistenciasClaseModal(): void {
    const id = this.claseSel();
    if (!id) return;
    if (this.inscritosSinAsistencia() === 0) {
      this.mostrarMsgModal(
        'Todos los inscritos ya tienen asistencia o certificado vigente en el contrato.',
        'info',
        'Asistencia al día',
      );
      return;
    }
    this.jornadaSvc.sincronizarAsistenciasInscritos(id).subscribe({
      next: (r) => {
        this.cargarInscritos(id);
        if (r.certificadosNuevos > 0) {
          this.certAlertSvc.notificarVariosDesdeRespuesta(r.certificadosEmitidos);
        }
        const msg = r.message || 'Asistencias sincronizadas.';
        const tipo = r.certificadosNuevos > 0 ? 'ok' : 'info';
        this.mostrarMsgModal(msg, tipo, 'Asistencia');
        this.emitClaseGuardada();
      },
      error: (e) => {
        const err = e?.error?.message || 'No se pudo registrar la asistencia.';
        this.mostrarMsgModal(err, 'error', 'Error');
      },
    });
  }

  onFotoEvidenciaSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    const id = this.claseSel();
    if (!file || !id) return;
    this.subiendoFotoEvidencia.set(true);
    this.jornadaSvc.subirFotoEvidenciaClase(id, file).subscribe({
      next: (c) => {
        this.claseActiva.set(c);
        this.subiendoFotoEvidencia.set(false);
        this.mostrarMsg('Foto de evidencia guardada.', 'ok', 'Evidencia');
        this.emitClaseGuardada();
      },
      error: (e) => {
        this.subiendoFotoEvidencia.set(false);
        this.mostrarMsg(e?.error?.message || 'No se pudo subir la foto.', 'error', 'Error');
      },
    });
    input.value = '';
  }

  onAlumnoBusquedaInput(value: string): void {
    this.alumnoBusqueda.set(value);
    this.alumnoBusquedaOpen.set(true);
    this.alumnoBusqueda$.next((value ?? '').trim());
  }

  focusAlumnoBusqueda(): void {
    this.alumnoBusquedaOpen.set(true);
    if (!this.alumnoBusqueda().trim()) this.alumnoBusqueda$.next('');
  }

  nombreAlumnoItem(a: AlumnoListItem): string {
    if (a.nombreCompleto?.trim()) return a.nombreCompleto.trim();
    const n = [a.nombre1, a.nombre2, a.nombres].filter(Boolean).join(' ').trim();
    const ap = [a.apellido1, a.apellido2, a.apellidos].filter(Boolean).join(' ').trim();
    return `${n} ${ap}`.trim() || '—';
  }

  alumnoYaEnLista(a: AlumnoListItem): boolean {
    const doc = formatNumDoc(a.numDoc);
    return this.inscritos().some((x) => formatNumDoc(x.numDoc) === doc);
  }

  agregarAlumnoMatricula(a: AlumnoListItem): void {
    const idContrato = this.idContratoParaClaseModal();
    if (idContrato) {
      this.jornadaSvc.progresoCertificacion(a.numDoc, idContrato).subscribe({
        next: (p) => {
          if (p.certificado) {
            void this.certBloqueoSvc.mostrarAlumnoCertificado({
              nombreAlumno: this.nombreAlumnoItem(a),
              certificado: p.certificado,
            });
            return;
          }
          this.ejecutarAgregarAlumnoMatricula(a);
        },
        error: () => this.ejecutarAgregarAlumnoMatricula(a),
      });
      return;
    }
    this.ejecutarAgregarAlumnoMatricula(a);
  }

  private ejecutarAgregarAlumnoMatricula(a: AlumnoListItem): void {
    const idC = this.claseSel();
    if (!idC) return;
    const yaInscrito = this.inscritos().some((x) => Number(x.numDoc) === Number(a.numDoc));
    if (yaInscrito) {
      this.mostrarMsg('El alumno ya está matriculado en esta clase.', 'info', 'Duplicado');
      return;
    }
    const idP = this.nuevaClaseProg();
    if (!idP) {
      this.mostrarMsg('La clase no tiene programa.', 'error', 'Error');
      return;
    }
    this.guardandoInscripcion.set(true);
    this.jornadaSvc.matricularAlumno({ numDoc: a.numDoc, idPrograma: idP, idClase: idC }).subscribe({
      next: (r: any) => {
        this.guardandoInscripcion.set(false);
        this.cargarInscritos(idC);
        const nombre = this.nombreAlumnoItem(a);
        const msg = this.mensajeInscripcionOk(r, nombre);
        const tipo = r?.inscripcionDuplicada ? 'info' : 'ok';
        this.mostrarMsgModal(msg, tipo, 'Alumno inscrito');
        this.emitClaseGuardada();
      },
      error: (e) => {
        this.guardandoInscripcion.set(false);
        if (e?.status === 409 && e?.error?.codigo === 'ya_certificado_contrato') {
          void this.certBloqueoSvc.mostrarDesdeError(e.error, this.nombreAlumnoItem(a));
          return;
        }
        const err = e?.error?.message || 'No se pudo inscribir al alumno.';
        this.mostrarMsgModal(err, 'error', 'Error');
      },
    });
    this.alumnoBusqueda.set('');
    this.alumnoBusquedaResults.set([]);
    this.alumnoBusquedaOpen.set(false);
  }

  private mensajeInscripcionOk(
    r: { inscripcionDuplicada?: boolean; yaExistia?: boolean; matricula?: { yaExistia?: boolean } },
    nombre: string,
  ): string {
    if (r?.inscripcionDuplicada) return `${nombre} ya estaba inscrito en esta clase.`;
    const yaMatriculado = r?.yaExistia || r?.matricula?.yaExistia;
    if (yaMatriculado) return `${nombre} inscrito en la clase (ya estaba matriculado al programa).`;
    return `${nombre} matriculado e inscrito en la clase.`;
  }

  marcarAsistenciaInscrito(numDoc: number): void {
    const id = this.claseSel();
    if (!id) return;
    this.guardandoAsistencia.set(numDoc);
    this.jornadaSvc.registrarAsistencia(id, numDoc).subscribe({
      next: (r: any) => {
        this.guardandoAsistencia.set(null);
        this.cargarInscritos(id);
        this.mostrarResultadoAsistencia(r);
        this.emitClaseGuardada();
      },
      error: (e) => {
        this.guardandoAsistencia.set(null);
        const body = e?.error;
        if (e?.status === 409 && body?.codigo === 'ya_certificado_contrato') {
          const ins = this.inscritos().find((x) => Number(x.numDoc) === Number(numDoc));
          void this.certBloqueoSvc.mostrarDesdeError(body, ins?.nombreCompleto || String(numDoc));
          return;
        }
        if (e?.status === 409 && body?.sesiones != null) {
          this.cargarInscritos(id);
          this.mostrarResultadoAsistencia(body);
          this.emitClaseGuardada();
          return;
        }
        this.mostrarMsg(body?.message || 'No se pudo registrar la asistencia.', 'error', 'Error');
      },
    });
  }

  async borrarAsistenciaInscrito(numDoc: number, nombre?: string): Promise<void> {
    const id = this.claseSel();
    if (!id) return;
    const ok = await this.confirmSvc.open({
      title: 'Borrar asistencia',
      message: `¿Eliminar la asistencia de ${nombre || 'el alumno'} (doc ${numDoc}) en esta clase?`,
      confirmLabel: 'Borrar',
      variant: 'danger',
    });
    if (!ok) return;
    this.guardandoAsistencia.set(numDoc);
    this.jornadaSvc.eliminarAsistencia(id, numDoc).subscribe({
      next: () => {
        this.guardandoAsistencia.set(null);
        this.cargarInscritos(id);
        this.mostrarMsg('Asistencia eliminada.', 'ok', 'Asistencia borrada');
        this.emitClaseGuardada();
      },
      error: (e) => {
        this.guardandoAsistencia.set(null);
        this.mostrarMsg(e?.error?.message || 'No se pudo borrar la asistencia.', 'error', 'Error');
      },
    });
  }

  async quitarInscritoDeClase(
    numDoc: number,
    nombre?: string,
    opts?: { tieneAsistencia?: boolean },
  ): Promise<void> {
    const id = this.claseSel();
    if (!id) return;
    const extraAsist = opts?.tieneAsistencia ? ' También se eliminará su asistencia en esta clase.' : '';
    const ok = await this.confirmSvc.open({
      title: 'Quitar de la clase',
      message:
        `¿Quitar a ${nombre || 'el alumno'} (doc ${numDoc}) de esta clase?` +
        ` La matrícula al programa se conserva.${extraAsist}`,
      confirmLabel: 'Quitar',
      variant: 'danger',
    });
    if (!ok) return;
    this.guardandoAsistencia.set(numDoc);
    this.jornadaSvc.quitarInscripcionClase(id, numDoc).subscribe({
      next: () => {
        this.guardandoAsistencia.set(null);
        this.cargarInscritos(id);
        this.mostrarMsg('Alumno retirado de la clase.', 'ok', 'Inscripción eliminada');
        this.emitClaseGuardada();
      },
      error: (e) => {
        this.guardandoAsistencia.set(null);
        this.mostrarMsg(e?.error?.message || 'No se pudo quitar al alumno.', 'error', 'Error');
      },
    });
  }

  imprimirCertificadoInscrito(a: {
    numDoc: number;
    nombreCompleto?: string;
    certificadoId?: string | null;
    certificadoCodigo?: string | null;
  }): void {
    const id = String(a.certificadoId || '').trim();
    if (id) {
      this.certBloqueoSvc.imprimirCertificadoDirecto(id);
      return;
    }
    void this.certBloqueoSvc.mostrarAlumnoCertificado({
      nombreAlumno: a.nombreCompleto || String(a.numDoc),
      certificado: { codigoCert: a.certificadoCodigo || undefined },
    });
  }

  nuevoAlumnoJornada(): void {
    void this.router.navigate(['/app/jornadas/alumnos/nuevo']);
  }

  onModalClaseInstructorChange(id: string): void {
    this.modalClaseInstructorId.set(id ? Number(id) : '');
  }

  onUbicacionClasePick(opt: EnumBuscarOption): void {
    this.nuevaClaseUbic.set(String(opt.value));
  }

  onUbicacionClaseLimpiar(): void {
    this.nuevaClaseUbic.set('Carpa');
  }

  onInstructorModalPick(opt: EnumBuscarOption): void {
    this.onModalClaseInstructorChange(String(opt.value));
  }

  onInstructorModalLimpiar(): void {
    this.onModalClaseInstructorChange('');
  }

  onProgramaModalPick(opt: EnumBuscarOption): void {
    this.nuevaClaseProg.set(String(opt.value));
  }

  onProgramaModalLimpiar(): void {
    this.nuevaClaseProg.set('');
  }

  @HostListener('document:click', ['$event'])
  cerrarBusquedaAlumnoFuera(ev: MouseEvent): void {
    const t = ev.target as HTMLElement;
    if (!t.closest('.clase-alumno-buscar')) this.alumnoBusquedaOpen.set(false);
  }

  private mostrarResultadoAsistencia(r: any): void {
    const ses = r.sesiones ?? 0;
    const req = r.numSesCert ?? '?';
    if (r.certificadoGenerado && r.certificado) {
      this.certAlertSvc.notificarDesdeRespuesta(r.certificado, r.nombreAlumno);
      this.mostrarMsg(
        `Certificado automático emitido (${ses}/${req} sesiones). Código: ${r.certificado.codigoCert || '—'}`,
        'ok',
        'Certificado emitido',
      );
      return;
    }
    if (r.cumplioSesiones && r.motivoCertificado && r.motivoCertificado !== 'ya_certificado') {
      this.mostrarMsg(
        `${r.nombreAlumno || ''}: completó sesiones pero no se emitió certificado. ${r.message || r.motivoCertificado}`,
        'warn',
        'Certificado pendiente',
      );
      return;
    }
    if (r.cumplioSesiones && r.certificado) {
      void this.certBloqueoSvc.mostrarAlumnoCertificado({
        nombreAlumno: r.nombreAlumno || '',
        certificado: r.certificado,
      });
      return;
    }
    const faltan = r.faltan ?? Math.max(0, Number(req) - ses);
    this.mostrarMsg(
      `${r.message || 'Asistencia registrada'} — ${r.nombreAlumno || ''}: ${ses}/${req} sesiones (faltan ${faltan} para certificado).`,
      'ok',
      'Asistencia registrada',
    );
  }

  private actualizarCronometroDisplay(): void {
    const cl = this.claseActiva();
    if (!cl?.horaInicio) {
      this.cronometroDisplay.set('00:00:00');
      return;
    }
    const inicio = new Date(cl.horaInicio).getTime();
    const fin = cl.horaFin ? new Date(cl.horaFin).getTime() : Date.now();
    const secs = Math.max(0, Math.floor((fin - inicio) / 1000));
    this.cronometroDisplay.set(this.formatDuracion(secs));
  }

  private detenerCronometro(): void {
    if (this.cronometroTimer) {
      clearInterval(this.cronometroTimer);
      this.cronometroTimer = null;
    }
  }

  private iniciarCronometroSiAplica(): void {
    this.detenerCronometro();
    this.actualizarCronometroDisplay();
    const cl = this.claseActiva();
    if (cl?.estado === 'EN PROCESO' && cl.horaInicio && !cl.horaFin) {
      this.cronometroTimer = setInterval(() => this.actualizarCronometroDisplay(), 1000);
    }
  }
}
