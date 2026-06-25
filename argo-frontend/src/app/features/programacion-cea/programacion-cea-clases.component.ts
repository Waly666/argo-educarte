import { CommonModule } from '@angular/common';
import { ArgoDateInputComponent } from '../../shared/argo-date-input/argo-date-input.component';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import { PermisoService } from '../../core/services/permiso.service';
import { ProgramacionCeaClaseProximaAlertService } from '../../core/services/programacion-cea-clase-proxima-alert.service';
import { AlumnoListItem, AlumnoService } from '../../core/services/alumno.service';
import {
  AlumnoElegibleCea,
  BloqueHorarioCea,
  ClaseProgramadaCeaDto,
  ConfigProgramacionCea,
  CrearClaseCeaBody,
  FilaRastreoCea,
  InscripcionClaseCeaDto,
  OrigenHorasCea,
  ProgramaCeaDto,
  ProgramacionCeaService,
  ProgramarClaseCeaCtx,
  InscribirClaseCeaCtx,
  RecursosProgramacionCea,
  TemaProgramaCeaDto,
  TipoClaseCea,
  fmtDuracionSegundos,
  labelOrigenHorasCea,
  labelTipoClaseCea,
} from '../../core/services/programacion-cea.service';
import {
  agruparPorFecha,
  ahoraLineaTopPct,
  celdasMes,
  diasSemana,
  esFinDeSemana,
  finSemana,
  fmtDiaSemanaCorto,
  fmtMesAnio,
  fmtRangoSemana,
  horasSlots,
  inicioSemana,
  layoutHorarioHHmm,
  layoutsCalendarioDiaHHmm,
  rangoVisibleMes,
  esFechaHoy,
  esFechaNoFutura,
  ymdCalendario,
  ymdLocal,
  DIAS_SEMANA_CORTO,
  type CeldaMes,
  type DiaSemana,
} from '../jornadas/jornada-calendario.util';
import { estadoClaseCalBlockClass, estadoClaseCalAccentClass, formatoHoraLegibleCo, tipoClaseCalBlockClass } from '../jornadas/jornada-ui.util';
import { FormModalComponent } from '../../shared/form-modal/form-modal.component';
import { Hora12InputComponent } from '../../shared/hora-12-input/hora-12-input.component';
import {
  chipClaseCal as chipClaseCalTexto,
  chipClaseCalCorto as chipClaseCalCortoTexto,
  horasClaseCalLabel,
} from '../../core/utils/cea-cal-clase.util';
import { calcularHoraHastaHHmm, horasSesionClase } from '../../core/utils/cea-horario.util';
import { horaInicioEfectiva } from '../../core/utils/hora-12.util';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { VehiculoInspeccionPanelComponent } from '../vehiculos/vehiculo-inspeccion-panel.component';
import { VehiculoService } from '../../core/services/vehiculo.service';
import { InspeccionVehiculoDto } from '../../core/services/inspeccion-vehiculo.service';
import { AsistenteContextoService } from '../../core/services/asistente-contexto.service';
import { tipFormulario } from '../../core/utils/asistente-formulario.util';
import type { AsistenteTip } from '../../core/constants/asistente.types';

type VistaAgenda = 'lista' | 'calendario';
type VistaPage = 'calendario' | 'lista';
export type ModoClasesCea = 'grupal' | 'practica' | 'mixto';

const CAL_MAX_EVENTOS_DIA = 15;

@Component({
  selector: 'argo-programacion-cea-clases',
  standalone: true,
  imports: [CommonModule, FormsModule, FormModalComponent, Hora12InputComponent, VehiculoInspeccionPanelComponent,
    ArgoDateInputComponent,
  ],
  templateUrl: './programacion-cea-clases.component.html',
  styleUrls: ['./programacion-cea-clases.component.scss'],
})
export class ProgramacionCeaClasesComponent implements OnInit, OnDestroy, OnChanges {
  private svc = inject(ProgramacionCeaService);
  private permisos = inject(PermisoService);
  private proximaAlert = inject(ProgramacionCeaClaseProximaAlertService);
  private confirm = inject(ConfirmDialogService);
  private vehiculoSvc = inject(VehiculoService);
  private alumnoSvc = inject(AlumnoService);
  private router = inject(Router);
  private asistente = inject(AsistenteContextoService);
  private alumnoBusqueda$ = new Subject<string>();
  private buscarSub: Subscription | null = null;

  @Input() programas: ProgramaCeaDto[] = [];
  @Input() claseSelId: string | null = null;
  @Input() fechaInicial: string | null = null;
  @Input() programarCtx: ProgramarClaseCeaCtx | null = null;
  @Input() inscribirCtx: InscribirClaseCeaCtx | null = null;
  /** embedded = pestaña hub; page = pantalla menú con lista + formulario lateral */
  @Input() variant: 'embedded' | 'page' = 'embedded';
  /** grupal = teoría/taller; practica = solo práctica; mixto = todos los tipos */
  @Input() modoClases: ModoClasesCea = 'grupal';
  /** Solo modal de edición/alta (host embebido en otras pantallas). */
  @Input() editorHost = false;
  @Output() claseGuardada = new EventEmitter<ClaseProgramadaCeaDto>();

  fecha = signal(ymdLocal(new Date()));
  mesFiltro = signal(new Date().toISOString().slice(0, 7));
  vistaPage = signal<VistaPage>('calendario');
  calDiaExpandido = signal<string | null>(null);
  readonly calMaxEventosDia = CAL_MAX_EVENTOS_DIA;
  vistaAgenda = signal<VistaAgenda>('lista');
  semanaInicio = signal(inicioSemana(new Date()));
  clases = signal<ClaseProgramadaCeaDto[]>([]);
  clasesSemana = signal<ClaseProgramadaCeaDto[]>([]);
  loadingSemana = signal(false);
  recursos = signal<RecursosProgramacionCea | null>(null);
  temasProg = signal<TemaProgramaCeaDto[]>([]);
  claseSel = signal<ClaseProgramadaCeaDto | null>(null);
  inscripciones = signal<InscripcionClaseCeaDto[]>([]);
  elegibles = signal<AlumnoElegibleCea[]>([]);
  rastreoInscritos = signal<Map<number, FilaRastreoCea>>(new Map());
  loadingLista = signal(false);

  saving = signal(false);
  formModalOpen = signal(false);
  detalleOperarOpen = signal(false);
  inspeccionBloqueoOpen = signal(false);
  vehiculoInspeccionId = signal<string | null>(null);
  inspeccionBloqueoMsg = signal<string | null>(null);
  inspeccionBloqueoPlaca = signal<string | null>(null);
  pendienteIniciarTrasInspeccion = signal(false);
  formError = signal<string | null>(null);
  msg = signal<string | null>(null);
  msgTipo = signal<'ok' | 'error' | 'warn'>('ok');
  conflictos = signal<{ tipo: string; mensaje: string }[]>([]);
  configCea = signal<ConfigProgramacionCea | null>(null);
  tick = signal(0);

  numDocInscribir = signal('');
  buscarAlumno = signal('');
  buscarAlumnoModal = signal('');
  filtroTipo = signal<TipoClaseCea | ''>('');
  filtroProg = signal('');
  buscarLista = signal('');

  horasDescuentoAuto = computed(() => {
    const f = this.form();
    return this.calcularHorasDescuentoForm(f);
  });
  horarioPermitidoHint = computed(() => {
    const hr = this.horarioConfigParaForm(this.form());
    if (!hr || !hr.horaDesde || !hr.horaHasta) return '';
    const d = formatoHoraLegibleCo(hr.horaDesde);
    const h = formatoHoraLegibleCo(hr.horaHasta);
    return `Horario permitido para esta fecha: ${d} – ${h}`;
  });
  slotsHorarioRapido = computed(() => this.generarSlotsHorario(this.form(), 30));
  alumnoPracticaSel = signal<AlumnoElegibleCea | null>(null);
  elegiblesPrograma = signal<AlumnoElegibleCea[]>([]);
  editandoClaseId = signal<string | null>(null);

  alumnoBusqueda = signal('');
  alumnoBusquedaOpen = signal(false);
  alumnoBusquedaLoading = signal(false);
  alumnoBusquedaResults = signal<AlumnoListItem[]>([]);
  guardandoInscripcion = signal(false);

  private ctxAplicado = false;
  private ctxInscribirAplicado = false;
  inscribirBannerOculto = signal(false);

  form = signal<CrearClaseCeaBody>({
    idProg: '',
    tipoClase: 'teoria',
    fechaClase: ymdLocal(new Date()),
    horaDesde: '08:00',
    horaHasta: '10:00',
    duracionHoras: 2,
    idTema: '',
    idAula: '',
    idTaller: '',
    idVehiculo: '',
    idEmpleadoInstructor: undefined,
    cupoMaximo: 25,
  });

  puedeGestionar = computed(() => this.permisos.tiene('programacion_cea.gestionar'));
  puedeOperar = computed(() => this.permisos.tiene(['programacion_cea.operar', 'programacion_cea.gestionar']));
  puedeCerrarRetroactivo = computed(() =>
    this.permisos.tiene(['caja.turno', 'caja.admin', 'programacion_cea.gestionar', 'programacion_cea.operar']),
  );
  puedeInspeccion = computed(() => this.permisos.tiene('instructores.inspeccion'));
  edicionSoloOperar = computed(() => this.esModoEdicion() && this.puedeOperar() && !this.puedeGestionar());
  isPage = computed(() => this.variant === 'page' && !this.editorHost);
  esModoPractica = computed(() => this.modoClases === 'practica');
  esModoGrupal = computed(() => this.modoClases === 'grupal');
  esModoMixto = computed(() => this.modoClases === 'mixto');
  esModoEdicion = computed(() => !!this.editandoClaseId());

  tituloFormModal = computed(() => {
    if (this.esModoEdicion()) return 'Editar clase';
    if (this.esModoPractica()) return 'Programar clase práctica';
    return 'Programar clase grupal';
  });

  subtituloFormModal = computed(() => {
    if (this.esModoEdicion()) {
      return this.esModoPractica()
        ? 'Ajuste fecha, horario, vehículo o instructor. El alumno inscrito no se cambia aquí.'
        : 'Ajuste fecha, horario, cupo, tema o instructor de la clase PROGRAMADA.';
    }
    if (this.esModoPractica()) return 'Clase individual: 1 instructor y 1 alumno en vehículo.';
    return 'Teoría o taller: programe cupos al mes sin alumnos; inscríbalos después desde la ficha del alumno.';
  });

  private tipsMiaFormClase(): AsistenteTip[] {
    const tips: AsistenteTip[] = [
      tipFormulario('Este formulario', this.subtituloFormModal(), 'cea-form-ctx'),
    ];
    if (!this.edicionSoloOperar()) {
      tips.push(
        tipFormulario('Programa y tipo', 'Defina el programa y la modalidad de la clase.', 'cea-form-s1'),
      );
      if (this.form().tipoClase === 'teoria' || this.form().tipoClase === 'taller') {
        tips.push(
          tipFormulario(
            'Clases grupales',
            'Programe la clase con cupo. Inscriba alumnos después (estado PROGRAMADA, sin iniciar).',
            'cea-form-grupo',
          ),
        );
      }
    }
    tips.push(
      tipFormulario('Fecha y horario', 'Elija la fecha y la hora de inicio de la clase.', 'cea-form-s2'),
      tipFormulario(
        'Descuento de horas',
        'Las horas se reservan al iniciar la clase y se confirman al finalizar según el horario programado.',
        'cea-form-horas',
      ),
      tipFormulario('Recursos e instructor', 'Ubicación, vehículo y persona a cargo.', 'cea-form-s3'),
    );
    if (this.form().tipoClase === 'practica' && !this.esModoEdicion()) {
      tips.push(tipFormulario('Alumno', 'Clase individual — seleccione el alumno.', 'cea-form-s4'));
    }
    if (this.esModoEdicion()) {
      tips.push(tipFormulario('Inscripciones', 'Agregue o quite alumnos de esta clase.', 'cea-form-s5'));
    }
    return tips;
  }

  tituloPeriodoLista = computed(() => {
    if (!this.isPage()) return this.fecha();
    const [y, m] = this.mesFiltro().split('-').map(Number);
    const d = new Date(y, (m || 1) - 1, 1);
    return d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  });

  calAnio = computed(() => {
    const [y] = this.mesFiltro().split('-').map(Number);
    return y || new Date().getFullYear();
  });

  calMes = computed(() => {
    const [, m] = this.mesFiltro().split('-').map(Number);
    return (m || 1) - 1;
  });

  tituloMesCal = computed(() => fmtMesAnio(this.calAnio(), this.calMes()));
  calCeldas = computed((): CeldaMes[] => celdasMes(this.calAnio(), this.calMes()));
  diasSemanaLabels = DIAS_SEMANA_CORTO;

  clasesPorDiaMes = computed(() =>
    agruparPorFecha(this.clasesFiltradas(), (c) => ymdCalendario(c.fechaClase)),
  );

  clasesMesResumen = computed(() => {
    const items = this.clasesFiltradas();
    let programada = 0;
    let proceso = 0;
    let finalizado = 0;
    for (const c of items) {
      if (c.estado === 'EN PROCESO') proceso++;
      else if (c.estado === 'FINALIZADO') finalizado++;
      else if (c.estado !== 'CANCELADA') programada++;
    }
    return { total: items.length, programada, proceso, finalizado };
  });

  temasFiltrados = computed(() => {
    const tipo = this.form().tipoClase;
    const tipoTema = tipo === 'teoria' ? 'teoria' : tipo === 'taller' ? 'taller' : null;
    if (!tipoTema) return [];
    return this.temasProg().filter((t) => t.tipo === tipoTema && t.activo !== false);
  });

  progFormInfo = computed(() => this.programas.find((p) => p.idProg === this.form().idProg) ?? null);

  clasesFiltradas = computed(() => {
    const t = this.filtroTipo();
    const ctx = this.inscribirCtx;
    const q = this.buscarLista().trim().toLowerCase();
    let rows = this.clases();
    if (this.isPage() && !ctx) {
      const prog = this.filtroProg();
      if (prog) rows = rows.filter((c) => c.idProg === prog);
      if (this.esModoPractica()) rows = rows.filter((c) => c.tipoClase === 'practica');
      else if (this.esModoGrupal()) {
        rows = rows.filter((c) => c.tipoClase === 'teoria' || c.tipoClase === 'taller');
        if (t) rows = rows.filter((c) => c.tipoClase === t);
      } else if (this.esModoMixto() && t) {
        rows = rows.filter((c) => c.tipoClase === t);
      } else if (t) rows = rows.filter((c) => c.tipoClase === t);
    } else if (ctx) {
      if (ctx.idProg) rows = rows.filter((c) => c.idProg === ctx.idProg);
      if (ctx.tipoClase) rows = rows.filter((c) => c.tipoClase === ctx.tipoClase);
      rows = rows.filter(
        (c) =>
          (c.estado === 'PROGRAMADA' || c.estado === 'CREADO') &&
          c.tipoClase !== 'practica' &&
          (c.inscritos ?? 0) < (c.cupoMaximo ?? 999),
      );
    } else if (t) {
      rows = rows.filter((c) => c.tipoClase === t);
    }
    if (q) {
      rows = rows.filter((c) => {
        const blob = [
          c.programaLabel,
          c.temaNombre,
          c.instructorNombre,
          c.estado,
          c.tipoClase,
          c.horaDesde,
          c.horaHasta,
          ymdCalendario(c.fechaClase),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      });
    }
    return rows;
  });

  modoInscribir = computed(() => !!this.inscribirCtx && !this.inscribirBannerOculto());

  hoyKey = computed(() => ymdLocal(new Date()));
  tituloSemanaCal = computed(() => fmtRangoSemana(this.semanaInicio()));
  diasSemanaCal = computed((): DiaSemana[] => diasSemana(this.semanaInicio()));
  horasCal = horasSlots();
  semanaIncluyeHoy = computed(() => this.diasSemanaCal().some((d) => d.key === this.hoyKey()));
  ahoraCalTopPct = computed(() => {
    this.diasSemanaCal();
    return ahoraLineaTopPct(new Date());
  });

  clasesSemanaFiltradas = computed(() => {
    const t = this.filtroTipo();
    const keys = new Set(this.diasSemanaCal().map((d) => d.key));
    return this.clasesSemana().filter((c) => {
      const key = ymdCalendario(c.fechaClase);
      if (!keys.has(key)) return false;
      return !t || c.tipoClase === t;
    });
  });

  clasesPorDiaSemana = computed(() =>
    agruparPorFecha(this.clasesSemanaFiltradas(), (c) => ymdCalendario(c.fechaClase)),
  );

  clasesSinHorarioSemana = computed(() => {
    const keys = new Set(this.diasSemanaCal().map((d) => d.key));
    return this.clasesSemanaFiltradas().filter((c) => {
      if (!keys.has(ymdCalendario(c.fechaClase))) return false;
      return layoutHorarioHHmm(c.horaDesde, c.horaHasta).sinHorario;
    });
  });

  clasesSemanaResumen = computed(() => {
    const items = this.clasesSemanaFiltradas();
    let programada = 0;
    let proceso = 0;
    let finalizado = 0;
    for (const c of items) {
      const e = String(c.estado || '').toUpperCase();
      if (e === 'EN PROCESO') proceso++;
      else if (e === 'FINALIZADO') finalizado++;
      else if (e !== 'CANCELADA') programada++;
    }
    return { total: items.length, programada, proceso, finalizado };
  });

  cronometroSeg = computed(() => {
    this.tick();
    const c = this.claseSel();
    if (!c || c.estado !== 'EN PROCESO' || !c.horaInicio) return null;
    const ini = new Date(c.horaInicio).getTime();
    return Math.max(0, Math.floor((Date.now() - ini) / 1000));
  });

  duracionMostrar = computed(() => {
    const c = this.claseSel();
    if (!c) return '—';
    if (c.estado === 'EN PROCESO' && this.cronometroSeg() != null) {
      return fmtDuracionSegundos(this.cronometroSeg());
    }
    if (c.duracionSegundos) return fmtDuracionSegundos(c.duracionSegundos);
    return '—';
  });

  labelTipoClase = labelTipoClaseCea;
  labelOrigen = labelOrigenHorasCea;

  trackElegible(a: AlumnoElegibleCea): string {
    return `${a.numDoc}-${a.origenHoras}-${(a.servicioLabel || '').trim()}`;
  }

  /** Unifica filas duplicadas (p. ej. varias matrículas del mismo programa). */
  private consolidarElegibles(rows: AlumnoElegibleCea[]): AlumnoElegibleCea[] {
    const porClave = new Map<string, AlumnoElegibleCea>();
    for (const r of rows || []) {
      const servicioLabel = (r.servicioLabel || '').trim();
      const key = `${r.numDoc}|${r.origenHoras}|${servicioLabel}`;
      const prev = porClave.get(key);
      if (!prev) {
        porClave.set(key, { ...r, servicioLabel });
      } else {
        porClave.set(key, {
          ...prev,
          pendientes: prev.pendientes + r.pendientes,
        });
      }
    }
    return [...porClave.values()].sort((a, b) =>
      a.alumnoNombre.localeCompare(b.alumnoNombre, 'es'),
    );
  }

  onBuscarAlumnoModal(q: string) {
    this.buscarAlumnoModal.set(q);
    this.cargarElegiblesPrograma();
  }

  onBuscarAlumnoDetalle(q: string) {
    this.buscarAlumno.set(q);
    const c = this.claseSel();
    if (c) this.cargarElegibles(c._id);
  }
  estadoClaseCalBlockClass = estadoClaseCalBlockClass;
  tipoClaseCalBlockClass = tipoClaseCalBlockClass;
  estadoClaseCalAccentClass = estadoClaseCalAccentClass;
  esFinDeSemana = esFinDeSemana;
  ymdCalendario = ymdCalendario;
  formatoHoraLegible = formatoHoraLegibleCo;

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const id = this.claseSelId;
      if (id && this.clases().length) {
        const c = this.clases().find((x) => x._id === id);
        if (c) this.seleccionarClase(c);
      }
    });
    effect(() => {
      if (this.formModalOpen()) {
        this.asistente.setTipsPrepend(this.tipsMiaFormClase());
        return;
      }
      if (this.detalleOperarOpen() && this.claseSel()) {
        const c = this.claseSel()!;
        this.asistente.setTipsPrepend([
          tipFormulario(
            'Clase seleccionada',
            `${c.fechaClase} · ${c.horaDesde}–${c.horaHasta}`,
            'cea-det-ctx',
          ),
        ]);
        return;
      }
      if (this.inspeccionBloqueoOpen()) {
        this.asistente.setTipsPrepend([
          tipFormulario(
            'Inspección requerida',
            this.inspeccionBloqueoMsg() ||
              'Debe completar la revisión de hoy antes de iniciar la clase práctica.',
            'cea-insp-ctx',
          ),
        ]);
        return;
      }
      this.asistente.clearTipsPrepend();
    });
  }

  ngOnInit(): void {
    if (this.fechaInicial) {
      this.fecha.set(this.fechaInicial);
      this.patchForm({ fechaClase: this.fechaInicial });
      this.semanaInicio.set(inicioSemana(new Date(this.fechaInicial + 'T12:00:00')));
    }
    if (this.programas.length && !this.form().idProg) {
      this.patchForm({
        idProg: this.programas[0].idProg,
        fechaClase: this.fecha(),
        tipoClase: this.esModoPractica() ? 'practica' : 'teoria',
      });
    }
    this.aplicarDefaultsModo();
    this.buscarSub = this.alumnoBusqueda$
      .pipe(
        debounceTime(220),
        distinctUntilChanged(),
        switchMap((q) => {
          this.alumnoBusquedaLoading.set(true);
          if (!q || q.length < 2) {
            return of([] as AlumnoListItem[]);
          }
          return this.alumnoSvc.buscar(q, 12);
        }),
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
    this.cargarRecursos();
    this.cargarConfigCea();
    this.timer = setInterval(() => {
      if (this.claseSel()?.estado === 'EN PROCESO') this.tick.update((n) => n + 1);
    }, 1000);
    if (this.editorHost) return;
    this.cargarClases();
    this.tryApplyProgramarCtx();
    this.tryApplyInscribirCtx();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['modoClases']) this.aplicarDefaultsModo();
    if (changes['programarCtx'] || changes['programas']) {
      this.tryApplyProgramarCtx();
    }
    if (changes['inscribirCtx']) {
      this.tryApplyInscribirCtx();
    }
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.buscarSub?.unsubscribe();
  }

  private aplicarDefaultsModo() {
    if (this.esModoPractica()) {
      this.patchForm({ tipoClase: 'practica', cupoMaximo: 1, duracionHoras: 2 });
      if (this.filtroTipo() === 'teoria' || this.filtroTipo() === 'taller') this.filtroTipo.set('');
      if (this.isPage()) this.vistaPage.set('calendario');
    } else if (this.esModoGrupal()) {
      const t = this.form().tipoClase;
      if (t === 'practica') this.patchForm({ tipoClase: 'teoria', cupoMaximo: 25, duracionHoras: undefined });
      if (this.isPage()) this.vistaPage.set('calendario');
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent) {
    const t = ev.target as HTMLElement;
    if (!t.closest('.clase-alumno-buscar')) this.alumnoBusquedaOpen.set(false);
  }

  onAlumnoBusquedaInput(v: string) {
    this.alumnoBusqueda.set(v);
    this.alumnoBusquedaOpen.set(true);
    const q = v.trim();
    if (q.length < 2) {
      this.alumnoBusquedaResults.set([]);
      this.alumnoBusquedaLoading.set(false);
      return;
    }
    this.alumnoBusqueda$.next(q);
  }

  focusAlumnoBusqueda() {
    this.alumnoBusquedaOpen.set(true);
  }

  nombreAlumnoItem(a: AlumnoListItem): string {
    return [a.apellido1, a.apellido2, a.nombre1, a.nombre2].filter(Boolean).join(' ').trim() || String(a.numDoc);
  }

  alumnoYaEnClasePractica(numDoc: number | string): boolean {
    const nd = Number(numDoc);
    if (this.alumnoPracticaSel()?.numDoc === nd) return true;
    return this.inscripciones().some((i) => i.numDoc === nd);
  }

  agregarAlumnoPracticaDesdeBusqueda(a: AlumnoListItem) {
    const nd = Number(a.numDoc);
    if (!Number.isFinite(nd)) return;
    const c = this.claseSel();
    if (c?.estado === 'PROGRAMADA' || c?.estado === 'CREADO') {
      if (this.puedeOperar() && (!this.formModalOpen() || this.esModoEdicion())) {
        this.guardandoInscripcion.set(true);
        const ctx = this.inscribirCtx;
        this.svc.inscribirAlumno(c._id, { numDoc: nd, origenHoras: ctx?.origenHoras }).subscribe({
          next: (r) => {
            this.guardandoInscripcion.set(false);
            this.refreshTrasInscripcion(r.clase, c._id);
            this.alumnoBusquedaOpen.set(false);
            this.alumnoBusqueda.set('');
            this.flash(`${this.nombreAlumnoItem(a)} inscrito`, 'ok');
          },
          error: (e) => {
            this.guardandoInscripcion.set(false);
            this.flash(e?.error?.message || 'No se pudo inscribir', 'error');
          },
        });
        return;
      }
    }
    this.resolverElegiblePractica(nd, this.nombreAlumnoItem(a));
    this.alumnoBusquedaOpen.set(false);
  }

  private resolverElegiblePractica(numDoc: number, nombreFallback: string) {
    const idProg = this.form().idProg;
    if (!idProg) {
      this.alumnoPracticaSel.set({
        numDoc,
        alumnoNombre: nombreFallback,
        pendientes: 0,
        origenHoras: 'matricula',
        servicioLabel: '',
      });
      return;
    }
    this.svc.alumnosElegiblesPrograma(idProg, 'practica', String(numDoc)).subscribe({
      next: (rows) => {
        const found = (rows || []).find((r) => r.numDoc === numDoc);
        this.alumnoPracticaSel.set(
          found || {
            numDoc,
            alumnoNombre: nombreFallback,
            pendientes: 0,
            origenHoras: 'matricula',
            servicioLabel: '',
          },
        );
      },
      error: () => {
        this.alumnoPracticaSel.set({
          numDoc,
          alumnoNombre: nombreFallback,
          pendientes: 0,
          origenHoras: 'matricula',
          servicioLabel: '',
        });
      },
    });
  }

  /** Editar horario, cupo o ubicación (PROGRAMADA/CREADO). Inicio/fin siguen siendo manuales. */
  puedeEditarHorarioClase(c?: ClaseProgramadaCeaDto | null): boolean {
    const clase = c ?? this.claseSel();
    if (!clase) return false;
    const e = String(clase.estado || '').trim().toUpperCase();
    if (e !== 'PROGRAMADA' && e !== 'CREADO') return false;
    return this.puedeGestionar() || this.puedeOperar();
  }

  /** Abre el modal de edición (desde pantallas host como clases-hoy). */
  abrirEdicionClase(c: ClaseProgramadaCeaDto): boolean {
    if (!this.puedeEditarHorarioClase(c)) {
      this.flash('Solo se pueden editar clases en estado PROGRAMADA o CREADO', 'warn');
      return false;
    }
    this.detalleOperarOpen.set(false);
    this.editarClase(c);
    return true;
  }

  /** Host embebido (portal instructor, clases-hoy): panel operativo con edición manual. */
  abrirClaseDesdeHost(claseOrId: ClaseProgramadaCeaDto | string): void {
    const abrir = (c: ClaseProgramadaCeaDto) => {
      if (this.puedeOperar() || this.puedeGestionar() || this.puedeCerrarRetroactivo()) {
        this.formModalOpen.set(false);
        this.seleccionarClase(c);
        this.detalleOperarOpen.set(true);
        return;
      }
      this.flash('No tiene permiso para abrir esta clase', 'warn');
    };
    if (typeof claseOrId === 'string') {
      this.svc.obtenerClase(claseOrId).subscribe({
        next: abrir,
        error: (e) => this.flash(e?.error?.message || 'No se pudo cargar la clase', 'error'),
      });
      return;
    }
    abrir(claseOrId);
  }

  cerrarDetalleOperar(): void {
    this.detalleOperarOpen.set(false);
  }

  editarDesdeDetalleHost(c: ClaseProgramadaCeaDto): void {
    if (!this.abrirEdicionClase(c)) {
      this.seleccionarClase(c);
      this.detalleOperarOpen.set(true);
    }
  }

  editarClase(c: ClaseProgramadaCeaDto) {
    if (!this.puedeEditarHorarioClase(c)) return;
    this.editandoClaseId.set(c._id);
    this.claseSel.set(c);
    this.conflictos.set([]);
    const fecha = ymdCalendario(c.fechaClase);
    this.patchForm({
      idProg: c.idProg,
      tipoClase: c.tipoClase,
      fechaClase: fecha,
      horaDesde: horaInicioEfectiva(c.horaDesde),
      horaHasta: c.horaHasta,
      duracionHoras: c.duracionHoras ?? (c.tipoClase === 'practica' ? (c.horasDescuento ?? 2) : undefined),
      idTema: c.idTema || '',
      idAula: c.idAula || '',
      idTaller: c.idTaller || '',
      idVehiculo: c.idVehiculo || '',
      idEmpleadoInstructor: c.idEmpleadoInstructor ?? undefined,
      cupoMaximo: c.cupoMaximo ?? (c.tipoClase === 'practica' ? 1 : 25),
    });
    this.alumnoPracticaSel.set(null);
    this.buscarAlumno.set('');
    this.buscarAlumnoModal.set('');
    this.numDocInscribir.set('');
    this.cargarTemas(c.idProg);
    this.cargarRecursos(c.idProg);
    this.cargarInscripciones(c._id);
    this.cargarElegibles(c._id);
    this.formModalOpen.set(true);
  }

  tieneCupoInscripcion(c: ClaseProgramadaCeaDto | null): boolean {
    if (!c) return false;
    const n = Math.max(Number(c.inscritos ?? 0), this.inscripciones().length);
    const max = Number(c.cupoMaximo ?? this.form().cupoMaximo ?? (c.tipoClase === 'practica' ? 1 : 25));
    return n < max;
  }

  private refreshTrasInscripcion(clase: ClaseProgramadaCeaDto, idClase: string) {
    this.claseSel.set(clase);
    this.cargarInscripciones(idClase);
    this.cargarElegibles(idClase);
    if (this.editorHost) {
      this.claseGuardada.emit(clase);
    } else {
      this.cargarClases();
    }
  }

  seleccionarHoraInicio(hhmm: string) {
    this.patchForm({ horaDesde: hhmm });
  }

  private generarSlotsHorario(f: CrearClaseCeaBody, stepMin: number): string[] {
    const hr = this.horarioConfigParaForm(f);
    if (!hr?.horaDesde || !hr?.horaHasta) return [];
    const ini = this.parseMins(hr.horaDesde);
    const fin = this.parseMins(hr.horaHasta);
    if (!Number.isFinite(ini) || !Number.isFinite(fin) || fin <= ini) return [];
    const slots: string[] = [];
    for (let m = ini; m < fin; m += stepMin) {
      slots.push(this.formatMins(m));
    }
    return slots;
  }

  patchForm(p: Partial<CrearClaseCeaBody>) {
    this.formError.set(null);
    this.form.update((f) => {
      const next = { ...f, ...p };
      this.syncHoraFinForm(next);
      if (p.horaDesde != null && next.tipoClase !== 'practica' && !this.usaHoraFinCalculada()) {
        const dm = this.parseMins(next.horaDesde);
        const hm = this.parseMins(next.horaHasta || '');
        if (Number.isFinite(dm) && (!Number.isFinite(hm) || hm <= dm)) {
          const hr = this.horarioConfigParaForm(next);
          const cap = hr ? this.parseMins(hr.horaHasta) : dm + 120;
          next.horaHasta = this.formatMins(Math.min(dm + 120, Number.isFinite(cap) ? cap : dm + 120));
        }
      }
      return next;
    });
    if (p.idProg) this.cargarTemas(String(p.idProg));
  }

  horasSesionEnEdicion(): number {
    const f = this.form();
    const c = this.claseSel();
    return horasSesionClase(f.tipoClase, {
      duracionHoras: f.duracionHoras,
      horasDescuento: c?.horasDescuento,
    });
  }

  usaHoraFinCalculada(): boolean {
    const f = this.form();
    if (f.tipoClase === 'practica') return true;
    const c = this.claseSel();
    return this.esModoEdicion() && Number(c?.horasDescuento) > 0;
  }

  duracionSesionBloqueada(): boolean {
    const c = this.claseSel();
    if (!c || c.tipoClase !== 'practica' || !this.esModoEdicion()) return false;
    return Number(c.horasDescuento) > 0 || Number(c.duracionHoras) > 0;
  }

  private syncHoraFinForm(f: CrearClaseCeaBody): void {
    const horas = horasSesionClase(f.tipoClase, {
      duracionHoras: f.duracionHoras,
      horasDescuento: this.claseSel()?.horasDescuento,
    });
    if (f.horaDesde && horas > 0 && (f.tipoClase === 'practica' || Number(this.claseSel()?.horasDescuento) > 0)) {
      f.horaHasta = calcularHoraHastaHHmm(f.horaDesde, horas);
    }
  }

  onProgFormChange(idProg: string) {
    this.patchForm({ idProg });
    if (this.form().tipoClase === 'practica') {
      this.cargarElegiblesPrograma();
      this.cargarRecursos(idProg);
    }
  }

  private calcularHoraHastaLocal(horaDesde: string, duracionHoras: number): string {
    return calcularHoraHastaHHmm(horaDesde, duracionHoras);
  }

  horaFinFormulario(): string {
    const f = this.form();
    const horas = this.horasSesionEnEdicion();
    if (f.horaDesde && horas > 0 && this.usaHoraFinCalculada()) {
      return calcularHoraHastaHHmm(f.horaDesde, horas);
    }
    return f.horaHasta || '';
  }

  calcularHorasDescuentoForm(f: CrearClaseCeaBody): number {
    let hasta = f.horaHasta || '';
    if (f.tipoClase === 'practica' && f.horaDesde && f.duracionHoras) {
      hasta = this.calcularHoraHastaLocal(f.horaDesde, Number(f.duracionHoras));
    }
    if (f.horaDesde && hasta) return this.horasEntre(f.horaDesde, hasta);
    return 0;
  }

  private horasEntre(desde: string, hasta: string): number {
    const [h1, m1] = String(desde || '').split(':').map(Number);
    const [h2, m2] = String(hasta || '').split(':').map(Number);
    if (!Number.isFinite(h1) || !Number.isFinite(h2)) return 0;
    const mins = h2 * 60 + (m2 || 0) - (h1 * 60 + (m1 || 0));
    return Math.max(0, Math.round((mins / 60) * 100) / 100);
  }

  private tryApplyProgramarCtx() {
    const ctx = this.programarCtx;
    if (!ctx || this.ctxAplicado || !this.programas.length || !this.puedeGestionar()) return;
    const tipo = ctx.tipoClase || (this.esModoPractica() ? 'practica' : 'teoria');
    if (this.esModoPractica() && tipo !== 'practica') return;
    if (this.esModoGrupal() && tipo === 'practica') return;
    this.ctxAplicado = true;
    this.abrirFormModalConCtx(ctx);
  }

  private tryApplyInscribirCtx() {
    const ctx = this.inscribirCtx;
    if (!ctx || this.ctxInscribirAplicado) return;
    this.ctxInscribirAplicado = true;
    this.inscribirBannerOculto.set(false);
    if (ctx.tipoClase) this.filtroTipo.set(ctx.tipoClase);
    this.numDocInscribir.set(String(ctx.numDoc));
    this.flash(
      `Seleccione una clase de ${labelTipoClaseCea(ctx.tipoClase || 'teoria')} con cupo disponible para inscribir a ${ctx.alumnoNombre || ctx.numDoc}.`,
      'ok',
    );
  }

  limpiarModoInscribir() {
    this.inscribirBannerOculto.set(true);
    this.numDocInscribir.set('');
  }

  abrirFormModalConCtx(ctx: ProgramarClaseCeaCtx) {
    this.conflictos.set([]);
    const tipo = ctx.tipoClase || 'practica';
    const idProg = ctx.idProg || this.form().idProg || this.programas[0]?.idProg || '';
    this.onTipoClaseChange(tipo);
    this.patchForm({
      idProg,
      tipoClase: tipo,
      fechaClase: this.fecha(),
    });
    this.alumnoPracticaSel.set(null);
    this.buscarAlumnoModal.set('');

    if (ctx.numDoc != null && ctx.numDoc !== '') {
      const nd = Number(ctx.numDoc);
      const pre: AlumnoElegibleCea = {
        numDoc: nd,
        alumnoNombre: ctx.alumnoNombre || String(ctx.numDoc),
        pendientes: 0,
        origenHoras: (ctx.origenHoras || 'matricula') as OrigenHorasCea,
        servicioLabel: '',
      };
      if (tipo === 'practica') {
        this.alumnoPracticaSel.set(pre);
      }
    }

    this.cargarElegiblesPrograma();
    this.formModalOpen.set(true);
  }

  onFechaAgenda(f: string) {
    this.fecha.set(f);
    this.patchForm({ fechaClase: f });
    this.cargarClases();
  }

  irHoy() {
    this.onFechaAgenda(ymdLocal(new Date()));
  }

  setVistaAgenda(v: VistaAgenda) {
    this.vistaAgenda.set(v);
    if (v === 'calendario') {
      const f = this.fecha();
      if (f) this.semanaInicio.set(inicioSemana(new Date(f + 'T12:00:00')));
      this.cargarSemana();
    }
  }

  semanaAnterior() {
    const d = new Date(this.semanaInicio());
    d.setDate(d.getDate() - 7);
    this.semanaInicio.set(inicioSemana(d));
    this.cargarSemana();
  }

  semanaSiguiente() {
    const d = new Date(this.semanaInicio());
    d.setDate(d.getDate() + 7);
    this.semanaInicio.set(inicioSemana(d));
    this.cargarSemana();
  }

  irSemanaHoy() {
    this.semanaInicio.set(inicioSemana(new Date()));
    this.cargarSemana();
  }

  conteoClasesDia(key: string): number {
    return (this.clasesPorDiaSemana().get(key) ?? []).length;
  }

  clasesEnDia(key: string): ClaseProgramadaCeaDto[] {
    return (this.clasesPorDiaSemana().get(key) ?? []).filter(
      (c) => !layoutHorarioHHmm(c.horaDesde, c.horaHasta).sinHorario,
    );
  }

  layoutClaseCea(c: ClaseProgramadaCeaDto) {
    return layoutHorarioHHmm(c.horaDesde, c.horaHasta);
  }

  layoutsCalendarioDia(clases: ClaseProgramadaCeaDto[]) {
    return layoutsCalendarioDiaHHmm(
      clases.map((c) => ({ id: c._id!, horaDesde: c.horaDesde, horaHasta: c.horaHasta })),
    );
  }

  fmtDiaCal(fecha: Date): string {
    return fmtDiaSemanaCorto(fecha);
  }

  horasClaseCalLabel = horasClaseCalLabel;

  chipClaseCal(c: ClaseProgramadaCeaDto): string {
    return chipClaseCalTexto(c, (x) => this.ubicacionClase(x));
  }

  chipClaseCalCorto(c: ClaseProgramadaCeaDto): string {
    return chipClaseCalCortoTexto(c, (x) => this.ubicacionClase(x));
  }

  /** Etiqueta corta de aula/taller para distinguir clases a la misma hora. */
  etiquetaUbicacionCal(c: ClaseProgramadaCeaDto): string {
    if (c.tipoClase === 'teoria') return c.aulaNombre || c.idAula || 'Sin aula';
    if (c.tipoClase === 'taller') return c.tallerNombre || c.idTaller || 'Sin taller';
    return c.idVehiculo || '—';
  }

  /** Tono de borde por ubicación para separar visualmente cupos simultáneos. */
  ubicacionCalHueClass(c: ClaseProgramadaCeaDto): string {
    const key = String(c.idAula || c.idTaller || c.idVehiculo || c.tipoClase || '');
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h + key.charCodeAt(i) * (i + 3)) % 6;
    return `cal-ubic-h${h}`;
  }

  seleccionarClaseCalendario(c: ClaseProgramadaCeaDto) {
    if (this.isPage()) {
      this.seleccionarClase(c);
      return;
    }
    const f = ymdCalendario(c.fechaClase);
    this.fecha.set(f);
    this.patchForm({ fechaClase: f });
    this.vistaAgenda.set('lista');
    this.svc.listarClases({ fecha: f }).subscribe({
      next: (rows) => {
        this.clases.set(rows || []);
        const found = (rows || []).find((x) => x._id === c._id);
        this.seleccionarClase(found || c);
      },
      error: () => this.seleccionarClase(c),
    });
  }

  cargarSemana() {
    const ini = this.semanaInicio();
    const fin = finSemana(ini);
    this.loadingSemana.set(true);
    this.svc
      .listarClases({ desde: ymdLocal(ini), hasta: ymdLocal(fin) })
      .subscribe({
        next: (rows) => {
          this.clasesSemana.set(rows || []);
          this.loadingSemana.set(false);
        },
        error: (e) => {
          this.loadingSemana.set(false);
          this.flash(e?.error?.message || 'No se pudo cargar la semana', 'error');
        },
      });
  }

  onTipoClaseChange(t: TipoClaseCea) {
    if (this.esModoPractica() && t !== 'practica') return;
    if (this.esModoGrupal() && t === 'practica') return;
    const dur = t === 'practica' ? 2 : undefined;
    const cupo = t === 'practica' ? 1 : t === 'taller' ? 20 : 25;
    this.patchForm({ tipoClase: t, duracionHoras: dur, cupoMaximo: cupo, idTema: '', idAula: '', idTaller: '', idVehiculo: '' });
    this.alumnoPracticaSel.set(null);
    this.elegiblesPrograma.set([]);
    if (t === 'practica') this.cargarElegiblesPrograma();
  }

  cargarElegiblesPrograma() {
    const f = this.form();
    if (f.tipoClase !== 'practica' || !f.idProg) {
      this.elegiblesPrograma.set([]);
      return;
    }
    this.svc.alumnosElegiblesPrograma(f.idProg, f.tipoClase, this.buscarAlumnoModal()).subscribe({
      next: (rows) => {
        const list = this.consolidarElegibles(rows || []);
        this.elegiblesPrograma.set(list);
        const ctx = this.programarCtx;
        if (ctx?.numDoc && f.tipoClase === 'practica' && !this.alumnoPracticaSel()) {
          const nd = Number(ctx.numDoc);
          const found = list.find((a) => a.numDoc === nd);
          if (found) this.alumnoPracticaSel.set(found);
        }
      },
      error: () => this.elegiblesPrograma.set([]),
    });
  }

  seleccionarAlumnoPractica(a: AlumnoElegibleCea) {
    this.alumnoPracticaSel.set(a);
  }

  quitarAlumnoPractica() {
    this.alumnoPracticaSel.set(null);
  }

  private syncAlumnoPracticaDesdeInscripciones(rows: InscripcionClaseCeaDto[]) {
    const ins = rows[0];
    if (!ins) return;
    this.alumnoPracticaSel.set({
      numDoc: ins.numDoc,
      alumnoNombre: ins.alumnoNombre || String(ins.numDoc),
      pendientes: 0,
      origenHoras: ins.origenHoras,
      servicioLabel: '',
    });
  }

  private alumnoPracticaParaPayload(): AlumnoElegibleCea | null {
    const sel = this.alumnoPracticaSel();
    if (sel) return sel;
    const ins = this.inscripciones()[0];
    if (!ins) return null;
    return {
      numDoc: ins.numDoc,
      alumnoNombre: ins.alumnoNombre || String(ins.numDoc),
      pendientes: 0,
      origenHoras: ins.origenHoras,
      servicioLabel: '',
    };
  }

  private buildPayload(): CrearClaseCeaBody {
    const f = this.form();
    const body: CrearClaseCeaBody = {
      ...f,
      horaDesde: horaInicioEfectiva(f.horaDesde),
    };
    const hd = this.horasDescuentoAuto();
    if (hd > 0) body.horasDescuento = hd;

    if (f.tipoClase === 'practica') {
      const a = this.alumnoPracticaParaPayload();
      if (a) {
        body.numDoc = a.numDoc;
        body.origenHoras = a.origenHoras;
        if (hd != null && hd > 0) body.horasAsignadas = hd;
      }
    }
    return body;
  }

  recursosCategoriaLicencia = signal<string | null>(null);

  cargarRecursos(idProg?: string) {
    const prog = idProg || this.form().idProg || this.claseSel()?.idProg || undefined;
    this.svc.recursos({ idProg: prog }).subscribe({
      next: (r) => {
        this.recursos.set(r);
        this.recursosCategoriaLicencia.set(r.categoriaLicencia ?? null);
        if (this.formModalOpen() && !this.form().idEmpleadoInstructor) {
          this.preseleccionarInstructor();
        }
      },
      error: () => undefined,
    });
  }

  private cargarConfigCea() {
    this.svc.obtenerConfig().subscribe({
      next: (cfg) => this.configCea.set(cfg),
      error: () => undefined,
    });
  }

  private preseleccionarInstructor() {
    if (this.form().idEmpleadoInstructor) return;
    const first = this.recursos()?.instructores?.[0];
    if (first?.idEmpleado) {
      this.form.update((f) => ({ ...f, idEmpleadoInstructor: first.idEmpleado }));
    }
  }

  private parseMins(hora: string): number {
    const m = String(hora || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return NaN;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  private formatMins(total: number): string {
    const mins = Math.max(0, Math.round(total));
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** Próximo bloque de 15 min (tarde incluida: 17:15 → sugerir ~17:30). */
  private horarioSugeridoAlAbrir(): { horaDesde: string; horaHasta: string } {
    const f = this.form();
    const hr = this.horarioConfigParaForm(f);
    if (!hr?.horaDesde || !hr?.horaHasta) {
      return { horaDesde: f.horaDesde || '08:00', horaHasta: f.horaHasta || '10:00' };
    }
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const next = Math.ceil((mins + 5) / 15) * 15;
    const hIni = this.parseMins(hr.horaDesde);
    const hFin = this.parseMins(hr.horaHasta);
    if (!Number.isFinite(hIni) || !Number.isFinite(hFin) || hFin <= hIni) {
      return { horaDesde: f.horaDesde || '08:00', horaHasta: f.horaHasta || '10:00' };
    }
    const desde = Math.max(hIni, Math.min(next, hFin - 60));
    const hasta = Math.min(desde + 120, hFin);
    return { horaDesde: this.formatMins(desde), horaHasta: this.formatMins(hasta) };
  }

  private bloqueConfigPorTipo(tipo: TipoClaseCea): BloqueHorarioCea | null {
    const cfg = this.configCea();
    if (!cfg) return null;
    if (tipo === 'taller') return cfg.taller;
    if (tipo === 'practica') return cfg.vehiculo;
    return cfg.aula;
  }

  private horarioConfigParaForm(f: CrearClaseCeaBody): { horaDesde: string; horaHasta: string } | null {
    const bloque = this.bloqueConfigPorTipo(f.tipoClase);
    if (!bloque || !f.fechaClase) return null;
    const d = new Date(`${f.fechaClase}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const dow = d.getDay();
    let sub = bloque.normal || { horaDesde: bloque.horaDesde, horaHasta: bloque.horaHasta };
    if (dow === 6 && bloque.sabado) sub = bloque.sabado;
    if (dow === 0 && bloque.domingo) sub = bloque.domingo;
    return {
      horaDesde: sub?.horaDesde || bloque.horaDesde || '',
      horaHasta: sub?.horaHasta || bloque.horaHasta || '',
    };
  }

  private validarAntesDeGuardar(body: CrearClaseCeaBody): string | null {
    if (!body.idProg) return 'Seleccione el programa';
    if (!body.fechaClase) return 'Indique la fecha de la clase';
    if (!body.horaDesde) return 'Indique la hora de inicio';

    if (body.tipoClase === 'teoria') {
      if (!body.idTema) return 'Seleccione el tema de teoría';
      if (!body.idAula) return 'Seleccione el aula';
    } else if (body.tipoClase === 'taller') {
      if (!body.idTema) return 'Seleccione el tema de taller';
      if (!body.idTaller) return 'Seleccione el taller / patio';
    } else if (body.tipoClase === 'practica') {
      if (!body.idVehiculo) return 'Seleccione el vehículo';
    }

    if (!body.idEmpleadoInstructor) {
      return 'Seleccione el instructor (obligatorio)';
    }

    let horaHasta = body.horaHasta || '';
    if (body.tipoClase === 'practica') {
      if (!body.duracionHoras) return 'Indique la duración de la práctica';
      horaHasta = this.calcularHoraHastaLocal(body.horaDesde, Number(body.duracionHoras));
    } else if (!horaHasta) {
      return 'Indique la hora de fin';
    }

    if (this.horasEntre(body.horaDesde, horaHasta) <= 0) {
      return 'La hora de fin debe ser posterior a la hora de inicio';
    }

    const hr = this.horarioConfigParaForm(body);
    if (hr) {
      const ini = this.parseMins(body.horaDesde);
      const fin = this.parseMins(horaHasta);
      const hIni = this.parseMins(hr.horaDesde);
      const hFin = this.parseMins(hr.horaHasta);
      if (ini < hIni || fin > hFin) {
        return `El horario debe estar entre ${hr.horaDesde} y ${hr.horaHasta} (según configuración CEA)`;
      }
    }

    return null;
  }

  cargarTemas(idProg: string) {
    if (!idProg) return;
    this.svc.listarTemas(idProg).subscribe({
      next: (rows) => this.temasProg.set(rows || []),
      error: () => this.temasProg.set([]),
    });
  }

  cargarClases() {
    this.loadingLista.set(true);
    if (this.isPage()) {
      const [y, m] = this.mesFiltro().split('-').map(Number);
      const { desde, hasta } = rangoVisibleMes(y, (m || 1) - 1);
      const params: Parameters<ProgramacionCeaService['listarClases']>[0] = { desde, hasta };
      if (this.esModoPractica()) params.tipoClase = 'practica';
      else if (this.filtroTipo()) params.tipoClase = this.filtroTipo() as TipoClaseCea;
      if (this.filtroProg()) params.idProg = this.filtroProg();
      this.svc.listarClases(params).subscribe({
        next: (rows) => {
          this.clases.set(rows || []);
          this.loadingLista.set(false);
          const sel = this.claseSel()?._id;
          if (sel) {
            const c = (rows || []).find((x) => x._id === sel);
            if (c) this.claseSel.set(c);
          }
        },
        error: (e) => {
          this.loadingLista.set(false);
          this.flash(e?.error?.message || 'No se pudieron cargar las clases', 'error');
        },
      });
      return;
    }
    this.svc.listarClases({ fecha: this.fecha() }).subscribe({
      next: (rows) => {
        this.clases.set(rows || []);
        this.loadingLista.set(false);
        const sel = this.claseSel()?._id;
        if (sel) {
          const c = (rows || []).find((x) => x._id === sel);
          if (c) this.claseSel.set(c);
        }
      },
      error: (e) => {
        this.loadingLista.set(false);
        this.flash(e?.error?.message || 'No se pudieron cargar las clases', 'error');
      },
    });
  }

  onMesFiltroChange(mes: string) {
    this.mesFiltro.set(mes);
    this.calDiaExpandido.set(null);
    this.cargarClases();
  }

  mesAnterior() {
    let m = this.calMes();
    let a = this.calAnio();
    m--;
    if (m < 0) {
      m = 11;
      a--;
    }
    this.onMesFiltroChange(`${a}-${String(m + 1).padStart(2, '0')}`);
  }

  mesSiguiente() {
    let m = this.calMes();
    let a = this.calAnio();
    m++;
    if (m > 11) {
      m = 0;
      a++;
    }
    this.onMesFiltroChange(`${a}-${String(m + 1).padStart(2, '0')}`);
  }

  irMesHoy() {
    this.onMesFiltroChange(new Date().toISOString().slice(0, 7));
  }

  clasesEnDiaMes(key: string): ClaseProgramadaCeaDto[] {
    const list = [...(this.clasesPorDiaMes().get(key) ?? [])];
    return list.sort((a, b) => {
      const ha = a.horaDesde || '99:99';
      const hb = b.horaDesde || '99:99';
      if (ha !== hb) return ha.localeCompare(hb);
      const ua = this.etiquetaUbicacionCal(a);
      const ub = this.etiquetaUbicacionCal(b);
      if (ua !== ub) return ua.localeCompare(ub, 'es');
      return (a.programaLabel || a.idProg || '').localeCompare(b.programaLabel || b.idProg || '', 'es');
    });
  }

  clasesEnDiaMesVisibles(key: string): ClaseProgramadaCeaDto[] {
    const all = this.clasesEnDiaMes(key);
    if (this.calDiaExpandido() === key) return all;
    return all.slice(0, CAL_MAX_EVENTOS_DIA);
  }

  clasesEnDiaMesOcultas(key: string): number {
    const all = this.clasesEnDiaMes(key);
    if (this.calDiaExpandido() === key) return 0;
    return Math.max(0, all.length - CAL_MAX_EVENTOS_DIA);
  }

  toggleDiaMesExpandido(key: string, ev: Event) {
    ev.stopPropagation();
    this.calDiaExpandido.update((k) => (k === key ? null : key));
  }

  abrirFormEnDia(fechaKey: string, ev?: Event) {
    ev?.stopPropagation();
    if (!this.puedeGestionar() || !fechaKey) return;
    this.editandoClaseId.set(null);
    this.conflictos.set([]);
    this.formError.set(null);
    this.alumnoPracticaSel.set(null);
    this.patchForm({
      fechaClase: fechaKey,
      tipoClase: this.esModoPractica() ? 'practica' : 'teoria',
      ...this.horarioSugeridoAlAbrir(),
    });
    if (this.esModoPractica()) this.cargarElegiblesPrograma();
    this.preseleccionarInstructor();
    this.formModalOpen.set(true);
  }

  seleccionarClase(c: ClaseProgramadaCeaDto) {
    if (this.isPage()) this.formModalOpen.set(false);
    this.claseSel.set(c);
    this.conflictos.set([]);
    this.cargarInscripciones(c._id);
    this.cargarElegibles(c._id);
    const ctx = this.inscribirCtx;
    if (ctx && (c.estado === 'PROGRAMADA' || c.estado === 'CREADO') && c.tipoClase !== 'practica') {
      this.numDocInscribir.set(String(ctx.numDoc));
    }
  }

  cargarInscripciones(idClase: string) {
    this.svc.listarInscripciones(idClase).subscribe({
      next: (rows) => {
        this.inscripciones.set(rows || []);
        if (this.esModoEdicion() && this.form().tipoClase === 'practica') {
          this.syncAlumnoPracticaDesdeInscripciones(rows || []);
        }
        this.cargarRastreoInscritos();
      },
      error: () => {
        this.inscripciones.set([]);
        this.rastreoInscritos.set(new Map());
      },
    });
  }

  cargarRastreoInscritos() {
    const c = this.claseSel();
    const ins = this.inscripciones();
    if (!c || !ins.length) {
      this.rastreoInscritos.set(new Map());
      return;
    }
    const tipo = c.tipoClase;
    const map = new Map<number, FilaRastreoCea>();
    let pendientes = ins.length;
    for (const i of ins) {
      this.svc.rastreoAlumno(i.numDoc).subscribe({
        next: (r) => {
          const fila = (r.filas || []).find(
            (f) =>
              f.idProg === c.idProg &&
              f.tipoHoras === tipo &&
              (f.origenHoras === i.origenHoras || !i.origenHoras),
          );
          if (fila) map.set(i.numDoc, fila);
          pendientes--;
          if (pendientes <= 0) this.rastreoInscritos.set(new Map(map));
        },
        error: () => {
          pendientes--;
          if (pendientes <= 0) this.rastreoInscritos.set(new Map(map));
        },
      });
    }
  }

  rastreoDeInscripcion(ins: InscripcionClaseCeaDto): FilaRastreoCea | null {
    return this.rastreoInscritos().get(ins.numDoc) ?? null;
  }

  cargarElegibles(idClase: string) {
    this.svc.alumnosElegibles(idClase, this.buscarAlumno()).subscribe({
      next: (rows) => this.elegibles.set(this.consolidarElegibles(rows || [])),
      error: () => this.elegibles.set([]),
    });
  }

  abrirFormModal() {
    if (!this.puedeGestionar()) return;
    this.editandoClaseId.set(null);
    this.conflictos.set([]);
    this.formError.set(null);
    this.alumnoPracticaSel.set(null);
    this.buscarAlumnoModal.set('');
    this.alumnoBusqueda.set('');
    this.patchForm({
      fechaClase: this.isPage() ? ymdLocal(new Date()) : this.fecha(),
      tipoClase: this.esModoPractica() ? 'practica' : 'teoria',
      ...this.horarioSugeridoAlAbrir(),
    });
    if (this.esModoPractica() || this.form().tipoClase === 'practica') {
      this.cargarElegiblesPrograma();
    }
    this.preseleccionarInstructor();
    this.formModalOpen.set(true);
  }

  cerrarFormModal() {
    this.formModalOpen.set(false);
    this.editandoClaseId.set(null);
    this.conflictos.set([]);
    this.alumnoPracticaSel.set(null);
  }

  verificarYProgramar() {
    const editId = this.editandoClaseId();
    if (editId) {
      if (!this.puedeEditarHorarioClase(this.claseSel())) return;
    } else if (!this.puedeGestionar()) {
      return;
    }
    const body = this.buildPayload();
    const validacion = this.validarAntesDeGuardar(body);
    if (validacion) {
      this.formError.set(validacion);
      this.flash(validacion, 'error');
      return;
    }
    if (!body.idProg || !body.fechaClase || !body.horaDesde) {
      this.flash('Complete programa, fecha y hora de inicio', 'error');
      return;
    }
    const hd = this.horasDescuentoAuto();
    if (hd <= 0) {
      this.flash('Indique hora inicio y hora fin válidas para calcular las horas a descontar', 'error');
      return;
    }
    body.horasDescuento = hd;
    if (body.tipoClase === 'practica' && !body.numDoc && !editId) {
      this.flash('Seleccione el alumno para la clase práctica', 'error');
      return;
    }
    if (
      body.tipoClase === 'practica' &&
      editId &&
      !body.numDoc &&
      !this.inscripciones().length
    ) {
      this.flash('La clase práctica debe tener un alumno inscrito', 'error');
      return;
    }
    this.saving.set(true);
    this.conflictos.set([]);
    this.formError.set(null);
    this.svc.verificarConflictos(body, editId || undefined).subscribe({
      next: (v) => {
        if (!v.ok && v.conflictos?.length) {
          this.conflictos.set(v.conflictos);
          this.formError.set(v.message || 'Hay conflictos de horario');
          this.flash(v.message || 'Hay conflictos de horario', 'warn');
          this.saving.set(false);
          return;
        }
        const req = editId ? this.svc.actualizarClase(editId, body) : this.svc.crearClase(body);
        req.subscribe({
          next: (c) => {
            let msg = editId ? 'Clase actualizada' : 'Clase programada correctamente';
            const advRaw =
              !editId && c && typeof c === 'object' && 'advertenciasInscripcion' in c
                ? (c as { advertenciasInscripcion?: string[] }).advertenciasInscripcion
                : undefined;
            const adv = Array.isArray(advRaw) ? advRaw : [];
            if (adv.length) msg += `. Advertencias: ${adv.join(' · ')}`;
            this.flash(msg, adv.length ? 'warn' : 'ok');
            this.saving.set(false);
            this.cerrarFormModal();
            if (this.editorHost) {
              this.claseSel.set(c);
              this.cargarInscripciones(c._id);
              this.cargarElegibles(c._id);
              this.detalleOperarOpen.set(true);
              this.claseGuardada.emit(c);
              this.proximaAlert.solicitarActualizacion();
              return;
            }
            if (!this.isPage() && body.fechaClase && body.fechaClase !== this.fecha()) {
              this.fecha.set(body.fechaClase);
            }
            this.cargarClases();
            if (this.vistaAgenda() === 'calendario') this.cargarSemana();
            this.seleccionarClase(c);
            this.proximaAlert.solicitarActualizacion();
          },
          error: (e) => {
            this.conflictos.set(e?.error?.conflictos || []);
            const msg = e?.error?.message || (editId ? 'No se pudo actualizar' : 'No se pudo programar');
            this.formError.set(msg);
            this.flash(msg, 'error');
            this.saving.set(false);
          },
        });
      },
      error: (e) => {
        this.conflictos.set(e?.error?.conflictos || []);
        const msg = e?.error?.message || 'Validación fallida';
        this.formError.set(msg);
        this.flash(msg, 'error');
        this.saving.set(false);
      },
    });
  }

  cancelarClaseSel() {
    const c = this.claseSel();
    if (!c || !this.puedeGestionar()) return;
    void this.borrarClase(c);
  }

  puedeBorrarClase(c: ClaseProgramadaCeaDto): boolean {
    const e = String(c.estado || '').trim().toUpperCase();
    return e === 'PROGRAMADA' || e === 'CREADO' || e === 'CANCELADA';
  }

  async borrarClase(c: ClaseProgramadaCeaDto, ev?: Event) {
    ev?.stopPropagation();
    if (!c._id || !this.puedeGestionar() || !this.puedeBorrarClase(c)) return;
    const ok = await this.confirm.open({
      title: 'Borrar clase',
      message: `¿Eliminar permanentemente la clase de ${this.labelTipoClase(c.tipoClase)} del ${ymdCalendario(c.fechaClase)} a las ${c.horaDesde} (${this.etiquetaUbicacionCal(c)})? Se quitarán también las inscripciones. Esta acción no se puede deshacer.`,
      variant: 'danger',
      confirmLabel: 'Sí, borrar',
    });
    if (!ok) return;
    this.svc.eliminarClase(c._id).subscribe({
      next: () => {
        this.flash('Clase eliminada', 'ok');
        if (this.claseSel()?._id === c._id) this.claseSel.set(null);
        this.cargarClases();
      },
      error: (e) => this.flash(e?.error?.message || 'No se pudo borrar la clase', 'error'),
    });
  }

  async anularProgramacion(c: ClaseProgramadaCeaDto, ev?: Event) {
    void this.borrarClase(c, ev);
  }

  claseEsHoy(c: ClaseProgramadaCeaDto): boolean {
    return esFechaHoy(c.fechaClase);
  }

  puedeIniciarClase(c: ClaseProgramadaCeaDto): boolean {
    return this.puedeOperar() && c.estado === 'PROGRAMADA' && this.claseEsHoy(c);
  }

  tituloIniciarClase(c: ClaseProgramadaCeaDto): string {
    if (!this.claseEsHoy(c)) {
      return 'Solo puede iniciar la clase el día programado (hoy).';
    }
    if (c.estado !== 'PROGRAMADA') {
      return 'La clase ya está iniciada o no está programada.';
    }
    return 'Iniciar clase y registrar hora de inicio';
  }

  clasePuedeCerrarRetroactivo(c: ClaseProgramadaCeaDto): boolean {
    if (!c?.fechaClase) return false;
    const e = String(c.estado || '').toUpperCase();
    if (e === 'FINALIZADO' || e === 'CANCELADA') return false;
    if (!esFechaNoFutura(c.fechaClase)) return false;
    if (!String(c.horaDesde || '').trim()) return false;
    if (!String(c.horaHasta || '').trim() && !(Number(c.duracionHoras) > 0)) return false;
    if (e === 'EN PROCESO' && this.claseEsHoy(c)) return false;
    return true;
  }

  tituloCerrarRetroactivo(c: ClaseProgramadaCeaDto): string {
    const desde = c.horaDesde || '—';
    const hasta = c.horaHasta || (Number(c.duracionHoras) > 0 ? '(según duración)' : '—');
    return `Registrar inicio ${desde} y fin ${hasta} del día programado; inscritos quedarán como ASISTIÓ.`;
  }

  async cerrarClaseRetroactiva() {
    const c = this.claseSel();
    if (!c?._id || !this.puedeCerrarRetroactivo() || !this.clasePuedeCerrarRetroactivo(c)) return;
    const ok = await this.confirm.open({
      title: 'Cerrar clase con horario programado',
      message: this.tituloCerrarRetroactivo(c),
      confirmLabel: 'Cerrar clase',
      variant: 'primary',
    });
    if (!ok) return;
    this.svc.finalizarClaseRetroactiva(c._id).subscribe({
      next: (doc) => {
        this.claseSel.set(doc);
        if (this.editorHost) {
          this.detalleOperarOpen.set(false);
          this.msg.set(null);
          this.claseGuardada.emit(doc);
        } else {
          this.cargarClases();
          this.cargarInscripciones(doc._id);
          this.flash('Clase cerrada con horario programado — horas registradas', 'ok');
        }
      },
      error: (e) => this.flash(e?.error?.message || 'No se pudo cerrar la clase', 'error'),
    });
  }

  iniciarClase() {
    const c = this.claseSel();
    if (!c || !this.puedeOperar()) return;
    if (!this.claseEsHoy(c)) {
      this.flash('Solo puede iniciar la clase el día programado (hoy).', 'warn');
      return;
    }
    this.ejecutarIniciarClase(c._id);
  }

  /** Inicio desde host externo (p. ej. clases de hoy). */
  iniciarClaseDesdeHost(c: ClaseProgramadaCeaDto): void {
    if (!c._id || !this.puedeOperar()) return;
    this.claseSel.set(c);
    if (!this.claseEsHoy(c)) {
      this.flash('Solo puede iniciar la clase el día programado (hoy).', 'warn');
      return;
    }
    this.ejecutarIniciarClase(c._id);
  }

  private ejecutarIniciarClase(id: string): void {
    this.svc.iniciarClase(id).subscribe({
      next: (doc) => {
        this.claseSel.set(doc);
        if (!this.editorHost) this.cargarClases();
        this.flash('Clase iniciada', 'ok');
        if (this.editorHost) this.claseGuardada.emit(doc);
      },
      error: (e) => this.manejarErrorIniciarClase(e),
    });
  }

  private manejarErrorIniciarClase(e: { status?: number; error?: { message?: string; codigo?: string; placa?: string; vehiculoId?: string | null } }): void {
    const body = e?.error;
    const codigo = body?.codigo;
    if (e?.status === 409 && codigo === 'inspeccion_pendiente') {
      this.abrirInspeccionBloqueo(body?.message || 'Debe completar la inspección preoperacional de hoy.', body?.placa || '', body?.vehiculoId ?? null);
      return;
    }
    if (e?.status === 409 && codigo === 'vehiculo_no_apto') {
      this.flash(body?.message || 'El vehículo no está apto para laborar hoy.', 'error');
      return;
    }
    this.flash(body?.message || 'No se pudo iniciar', 'error');
  }

  private abrirInspeccionBloqueo(message: string, placa: string, vehiculoId: string | null): void {
    this.inspeccionBloqueoMsg.set(message);
    this.inspeccionBloqueoPlaca.set(placa || null);
    this.pendienteIniciarTrasInspeccion.set(true);
    this.flash(message, 'warn');

    const abrir = (id: string) => {
      this.vehiculoInspeccionId.set(id);
      this.inspeccionBloqueoOpen.set(true);
    };

    if (vehiculoId) {
      abrir(vehiculoId);
      return;
    }
    if (!placa) {
      this.flash(message, 'error');
      return;
    }
    this.vehiculoSvc.verificarPlaca(placa).subscribe({
      next: (r) => {
        if (r.existe && r.vehiculo?._id) abrir(r.vehiculo._id);
        else this.flash(`${message} No se encontró el vehículo ${placa} en el sistema.`, 'error');
      },
      error: () => this.flash(message, 'warn'),
    });
  }

  onInspeccionGuardadaBloqueo(dto: InspeccionVehiculoDto): void {
    this.inspeccionBloqueoOpen.set(false);
    this.vehiculoInspeccionId.set(null);
    this.inspeccionBloqueoMsg.set(null);
    this.inspeccionBloqueoPlaca.set(null);

    if (dto.aptoLaborar === false) {
      this.pendienteIniciarTrasInspeccion.set(false);
      this.flash('Inspección guardada, pero el vehículo quedó marcado como no apto para laborar hoy.', 'warn');
      return;
    }

    const c = this.claseSel();
    if (this.pendienteIniciarTrasInspeccion() && c?._id) {
      this.pendienteIniciarTrasInspeccion.set(false);
      this.flash('Inspección guardada. Iniciando clase…', 'ok');
      this.ejecutarIniciarClase(c._id);
      return;
    }
    this.pendienteIniciarTrasInspeccion.set(false);
    this.flash('Inspección guardada.', 'ok');
  }

  cerrarInspeccionBloqueo(): void {
    this.inspeccionBloqueoOpen.set(false);
    this.vehiculoInspeccionId.set(null);
    this.pendienteIniciarTrasInspeccion.set(false);
  }

  irFichaVehiculoInspeccion(vehiculoId: string): void {
    this.cerrarInspeccionBloqueo();
    void this.router.navigate(['/app/vehiculos', vehiculoId], {
      queryParams: { tab: 'inspeccion', inspeccionHoy: '1' },
    });
  }

  finalizarClase() {
    const c = this.claseSel();
    if (!c || !this.puedeOperar()) return;
    this.svc.finalizarClase(c._id).subscribe({
      next: (doc) => {
        this.claseSel.set(doc);
        if (!this.editorHost) this.cargarClases();
        this.cargarInscripciones(doc._id);
        this.flash('Clase finalizada — horas registradas', 'ok');
        if (this.editorHost) this.claseGuardada.emit(doc);
      },
      error: (e) => this.flash(e?.error?.message || 'No se pudo finalizar', 'error'),
    });
  }

  inscribirPorDoc() {
    const c = this.claseSel();
    const doc = this.numDocInscribir().trim();
    if (!c || !doc || !this.puedeOperar()) return;
    const ctx = this.inscribirCtx;
    const body: { numDoc: string; origenHoras?: OrigenHorasCea } = { numDoc: doc };
    if (ctx?.origenHoras) body.origenHoras = ctx.origenHoras;
    this.svc.inscribirAlumno(c._id, body).subscribe({
      next: (r) => {
        this.numDocInscribir.set('');
        this.refreshTrasInscripcion(r.clase, c._id);
        this.flash('Alumno inscrito', 'ok');
        if (ctx) this.limpiarModoInscribir();
      },
      error: (e) => this.flash(e?.error?.message || 'No se pudo inscribir', 'error'),
    });
  }

  inscribirAlumnoCtx() {
    const c = this.claseSel();
    const ctx = this.inscribirCtx;
    if (!c || !ctx || !this.puedeOperar()) return;
    this.svc.inscribirAlumno(c._id, { numDoc: ctx.numDoc, origenHoras: ctx.origenHoras }).subscribe({
      next: (r) => {
        this.refreshTrasInscripcion(r.clase, c._id);
        this.flash(`${ctx.alumnoNombre || ctx.numDoc} inscrito en la clase`, 'ok');
        this.limpiarModoInscribir();
      },
      error: (e) => this.flash(e?.error?.message || 'No se pudo inscribir', 'error'),
    });
  }

  inscribirElegible(a: AlumnoElegibleCea) {
    const c = this.claseSel();
    if (!c || !this.puedeOperar()) return;
    this.svc.inscribirAlumno(c._id, { numDoc: a.numDoc, origenHoras: a.origenHoras }).subscribe({
      next: (r) => {
        this.refreshTrasInscripcion(r.clase, c._id);
        this.flash(`${a.alumnoNombre} inscrito`, 'ok');
      },
      error: (e) => this.flash(e?.error?.message || 'No se pudo inscribir', 'error'),
    });
  }

  quitarInscripcion(ins: InscripcionClaseCeaDto) {
    const c = this.claseSel();
    if (!c || !this.puedeOperar()) return;
    this.svc.quitarInscripcion(c._id, ins.numDoc).subscribe({
      next: (r) => {
        if (c.tipoClase === 'practica') this.alumnoPracticaSel.set(null);
        this.refreshTrasInscripcion(r.clase, c._id);
        this.flash('Inscripción quitada', 'ok');
      },
      error: (e) => this.flash(e?.error?.message || 'No se pudo quitar', 'error'),
    });
  }

  estadoClass(estado: string): string {
    if (estado === 'EN PROCESO') return 'estado-proceso';
    if (estado === 'FINALIZADO') return 'estado-ok';
    if (estado === 'CANCELADA') return 'estado-cancel';
    return 'estado-prog';
  }

  ubicacionClase(c: ClaseProgramadaCeaDto): string {
    if (c.tipoClase === 'teoria') return c.aulaNombre || c.idAula || '—';
    if (c.tipoClase === 'taller') return c.tallerNombre || c.idTaller || '—';
    return c.idVehiculo || '—';
  }

  private flash(texto: string, tipo: 'ok' | 'error' | 'warn') {
    this.msg.set(texto);
    this.msgTipo.set(tipo);
    window.setTimeout(() => this.msg.set(null), 5000);
  }
}
