import { CommonModule } from '@angular/common';
import { ArgoDateInputComponent } from '../../shared/argo-date-input/argo-date-input.component';
import { Component, DestroyRef, HostListener, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterModule } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';

import { CatalogoService, MunicipioDivipola } from '../../core/services/catalogo.service';
import { CertificadoJornadaAlertService } from '../../core/services/certificado-jornada-alert.service';
import { CertificadoJornadaBloqueoService } from '../../core/services/certificado-jornada-bloqueo.service';
import { JornadaHubDeepLinkService } from '../../core/services/jornada-hub-deeplink.service';
import { JornadaLiveSyncService } from '../../core/services/jornada-live-sync.service';
import {
  ContratacionDto,
  InstructorJornadaDto,
  JornadaCapService,
} from '../../core/services/jornada-cap.service';
import { AuthService } from '../../core/services/auth.service';
import { PermisoService } from '../../core/services/permiso.service';
import { MunicipioBuscarComponent } from '../alumnos/municipio-buscar.component';
import { AlumnoListItem } from '../../core/services/alumno.service';
import { formatNumDoc } from '../../core/utils/num-doc.helpers';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { FormModalComponent } from '../../shared/form-modal/form-modal.component';
import { Hora12InputComponent } from '../../shared/hora-12-input/hora-12-input.component';
import {
  CatalogoEnumBuscarComponent,
  EnumBuscarOption,
} from '../../shared/catalogo-enum-buscar/catalogo-enum-buscar.component';
import { environment } from '../../../environments/environment';
import { AsistenteContextoService } from '../../core/services/asistente-contexto.service';
import { Cliente, ClienteService } from '../../core/services/cliente.service';
import { ComprobanteHoyAlertService } from '../../core/services/comprobante-hoy-alert.service';
import { FacturacionService, PreviewFacturaContrato } from '../../core/services/facturacion.service';
import { tipFormulario } from '../../core/utils/asistente-formulario.util';
import { JornadaCapDto } from '../../core/services/jornada-cap.service';
import { JornadaMapaPickerComponent } from './jornada-mapa-picker.component';
import {
  ProgresoCertResp,
  etiquetaProgresoCert,
} from './jornada-progreso.util';
import { CoordsGeorefEvent, DeteGeorefe, etiquetaDeteGeorefe } from './jornada-georefe.util';
import {
  DIAS_SEMANA_CORTO,
  CeldaMes,
  DiaSemana,
  agruparPorFecha,
  celdasMes,
  diasSemana,
  finMes,
  finSemana,
  fmtDiaSemanaCorto,
  fmtMesAnio,
  fmtRangoSemana,
  horasSlots,
  inicioMes,
  inicioSemana,
  layoutHorarioClase,
  layoutsCalendarioDiaClase,
  ymdLocal,
  ymdCalendario,
  fmtFechaCalendario,
  esFechaHoy,
  ahoraLineaTopPct,
  esFinDeSemana,
  rangoVisibleMes,
} from './jornada-calendario.util';
import {
  JorMsgTipo,
  capAlumnoNombre,
  capCertCodigo,
  capCliente,
  capCodContrato,
  capDeteGeorefe,
  capDocAsis,
  capEstadoClase,
  capEstadoJornada,
  capEstadoJornadaColor,
  capFechaJor,
  capGenerado,
  capHorasCert,
  capHoraJor,
  capInstructor,
  capMetaNum,
  capMunicipioJor,
  capPrograma,
  capSesCert,
  capUbicacionClase,
  etiquetaGenerado,
  iconoJorMsg,
  isoAHoraInput,
  listaOpcionesHora,
  tituloJorMsg,
  validarHoraInput,
  estadoContratoLiveClass,
  labelEstadoContrato,
  rowContratoClass,
  estadoJornadaLiveClass,
  estadoJornadaCalClass,
  rowJornadaClass,
  estadoClaseLiveClass,
  claseJornadaSePuedeEliminar,
  estadoClaseCalBlockClass,
  estadoClaseCalAccentClass,
  rowClaseClass,
  rowCertificadoHoyClass,
} from './jornada-ui.util';

type Tab = 'contratos' | 'jornadas' | 'clases' | 'certificados';
type VistaAgenda = 'lista' | 'calendario';

@Component({
  selector: 'argo-jornadas-hub',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MunicipioBuscarComponent,
    JornadaMapaPickerComponent,
    FormModalComponent,
    CatalogoEnumBuscarComponent,
    Hora12InputComponent,
  
    ArgoDateInputComponent,
  ],
  templateUrl: './jornadas-hub.component.html',
  styleUrls: ['./jornadas-hub.component.scss'],
})
export class JornadasHubComponent implements OnInit, OnDestroy {
  private jornadaSvc = inject(JornadaCapService);
  private auth = inject(AuthService);
  private permisoSvc = inject(PermisoService);
  private certAlertSvc = inject(CertificadoJornadaAlertService);
  private liveSync = inject(JornadaLiveSyncService);
  private certBloqueoSvc = inject(CertificadoJornadaBloqueoService);
  private catSvc = inject(CatalogoService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private deeplink = inject(JornadaHubDeepLinkService);
  private destroyRef = inject(DestroyRef);
  private confirmSvc = inject(ConfirmDialogService);
  private asistente = inject(AsistenteContextoService);
  private clienteSvc = inject(ClienteService);
  private feSvc = inject(FacturacionService);
  private comprobanteAlertSvc = inject(ComprobanteHoyAlertService);

  tab = signal<Tab>('contratos');
  vistaJornadas = signal<VistaAgenda>('lista');
  vistaClases = signal<VistaAgenda>('lista');
  calMes = signal(new Date().getMonth());
  calAnio = signal(new Date().getFullYear());
  semanaInicio = signal(inicioSemana(new Date()));
  jornadasCalendario = signal<JornadaCapDto[]>([]);
  loadingCalJornadas = signal(false);
  calDiaExpandido = signal<string | null>(null);
  readonly calMaxEventosDia = 3;
  msg = signal<string | null>(null);
  msgTipo = signal<JorMsgTipo>('info');
  msgTitulo = signal('');
  modalMsg = signal<string | null>(null);
  modalMsgTipo = signal<JorMsgTipo>('info');
  modalMsgTitulo = signal('');
  msgEsError = signal(false);
  jornadaEditError = signal<string | null>(null);
  direccionAlertaActiva = signal(false);
  loading = signal(false);

  contratos = signal<ContratacionDto[]>([]);
  contratoSel = signal<string>('');
  clientesFe = signal<Cliente[]>([]);
  tiposContrato = signal<{ id: string; label: string }[]>([]);
  estadoFacturaContrato = signal<{ facturado: boolean; factura: { _id: string; numeroFactura: string } | null } | null>(
    null,
  );
  previewFacturaContrato = signal<PreviewFacturaContrato | null>(null);
  emitiendoFactura = signal(false);
  formContrato = signal<ContratacionDto>(this.emptyContrato());
  fechaFinalizacionContrato = signal(ymdLocal(new Date()));

  jornadas = signal<any[]>([]);
  jornadasEnProcesoAhora = computed(() => this.jornadas().filter((j) => j?.estado === 'EN PROCESO'));
  jornadaSel = signal<string>('');

  clases = signal<any[]>([]);
  claseSel = signal<string>('');
  claseActiva = signal<any | null>(null);
  programasJornada = signal<any[]>([]);
  nuevaClaseProg = signal('');
  nuevaClaseUbic = signal('Carpa');
  asistencias = signal<any[]>([]);
  numDocAsis = signal('');
  progresoPreview = signal<ProgresoCertResp | null>(null);
  nombreAlumnoPreview = signal('');
  progresoPreviewLoading = signal(false);

  certsGenerados = signal<any[]>([]);
  certsHoyCount = computed(
    () => this.certsGenerados().filter((c) => esFechaHoy(c?.fechaEmision)).length,
  );

  etiquetaProgresoCert = etiquetaProgresoCert;
  etiquetaDeteGeorefe = etiquetaDeteGeorefe;
  etiquetaGenerado = etiquetaGenerado;
  ymdLocal = ymdLocal;
  iconoJorMsg = iconoJorMsg;
  capEstadoJornada = capEstadoJornada;
  capEstadoJornadaColor = capEstadoJornadaColor;
  capEstadoClase = capEstadoClase;
  capUbicacionClase = capUbicacionClase;
  capDeteGeorefe = capDeteGeorefe;
  capCodContrato = capCodContrato;
  capCliente = capCliente;
  capMunicipioJor = capMunicipioJor;
  capFechaJor = capFechaJor;
  capHoraJor = capHoraJor;
  capMetaNum = capMetaNum;
  capSesCert = capSesCert;
  capHorasCert = capHorasCert;
  capCertCodigo = capCertCodigo;
  capDocAsis = capDocAsis;
  capAlumnoNombre = capAlumnoNombre;
  capPrograma = capPrograma;
  capGenerado = capGenerado;
  capInstructor = capInstructor;
  estadoContratoLiveClass = estadoContratoLiveClass;
  labelEstadoContrato = labelEstadoContrato;
  rowContratoClass = rowContratoClass;
  estadoJornadaLiveClass = estadoJornadaLiveClass;
  estadoJornadaCalClass = estadoJornadaCalClass;
  rowJornadaClass = rowJornadaClass;
  estadoClaseLiveClass = estadoClaseLiveClass;
  claseJornadaSePuedeEliminar = claseJornadaSePuedeEliminar;
  estadoClaseCalBlockClass = estadoClaseCalBlockClass;
  estadoClaseCalAccentClass = estadoClaseCalAccentClass;
  esFinDeSemana = esFinDeSemana;
  rowClaseClass = rowClaseClass;
  rowCertificadoHoyClass = rowCertificadoHoyClass;
  esFechaHoy = esFechaHoy;
  private progresoDebounce: ReturnType<typeof setTimeout> | null = null;

  contratoActivo = computed(() => this.contratos().find((c) => c._id === this.contratoSel()));
  puedeAsignarInstructor = computed(() => this.permisoSvc.tiene('jornadas.gestionar'));
  /** Solo administrador (jornadas.gestionar) puede eliminar clases no finalizadas. */
  puedeEliminarClase = computed(() => this.permisoSvc.tiene('jornadas.gestionar'));
  puedeEliminarClaseActiva = computed(
    () => this.puedeEliminarClase() && claseJornadaSePuedeEliminar(this.claseActiva()?.estado),
  );
  inscritosConAsistencia = computed(() => this.inscritos().filter((i) => i.tieneAsistencia).length);
  /** Inscritos que aún requieren asistencia (excluye certificados vigentes en el contrato). */
  inscritosPendientesAsistencia = computed(() =>
    this.inscritos().filter((i) => !i.tieneAsistencia && !i.yaCertificadoContrato),
  );
  inscritosSinAsistencia = computed(() => this.inscritosPendientesAsistencia().length);
  inscritosCertificadosContrato = computed(() =>
    this.inscritos().filter((i) => i.yaCertificadoContrato).length,
  );
  totalAlumnosMatriculadosModal = computed(() =>
    this.modalModoClase() === 'editar'
      ? this.inscritos().length
      : this.alumnosMatricular().length,
  );
  instructorSesionNombre = computed(
    () => this.auth.user()?.empleado?.nombreCompleto || this.auth.user()?.username || '—',
  );

  hoyKey = computed(() => ymdLocal(new Date()));
  tituloMesCal = computed(() => fmtMesAnio(this.calAnio(), this.calMes()));
  calCeldas = computed((): CeldaMes[] => celdasMes(this.calAnio(), this.calMes()));
  jornadasPorDia = computed(() =>
    agruparPorFecha(this.jornadasCalendario(), (j) => ymdCalendario(j.fechaProgramacion)),
  );
  tituloSemanaCal = computed(() => fmtRangoSemana(this.semanaInicio()));
  diasSemanaClases = computed((): DiaSemana[] => diasSemana(this.semanaInicio()));
  horasCal = horasSlots();
  diasSemanaLabels = DIAS_SEMANA_CORTO;
  clasesSemanaFiltradas = computed(() => {
    const est = this.filtroAdminEstado();
    const keys = new Set(this.diasSemanaClases().map((d) => d.key));
    return this.clases().filter((c) => {
      if (!keys.has(ymdLocal(c.fechaJornada))) return false;
      if (!est) return true;
      return String(c.estado || '').toUpperCase() === est.toUpperCase();
    });
  });
  clasesPorDiaSemanaFiltradas = computed(() =>
    agruparPorFecha(this.clasesSemanaFiltradas(), (c) => ymdLocal(c.fechaJornada)),
  );
  clasesSinHorarioSemana = computed(() => {
    const keys = new Set(this.diasSemanaClases().map((d) => d.key));
    return this.clasesSemanaFiltradas().filter((c) => {
      if (!keys.has(ymdLocal(c.fechaJornada))) return false;
      return layoutHorarioClase(c.horaInicio, c.horaFin).sinHorario;
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
      else programada++;
    }
    return { total: items.length, programada, proceso, finalizado };
  });
  jornadasMesActual = computed(() => {
    const keysMes = new Set(
      this.calCeldas().filter((c) => !c.otroMes && c.key).map((c) => c.key),
    );
    return this.jornadasCalendario().filter((j) => keysMes.has(ymdCalendario(j.fechaProgramacion)));
  });
  jornadasMesResumen = computed(() => {
    const items = this.jornadasMesActual();
    let inactivo = 0;
    let proceso = 0;
    let finalizado = 0;
    for (const j of items) {
      const e = String(j.estado || '').toUpperCase();
      if (e === 'EN PROCESO') proceso++;
      else if (e === 'FINALIZADO') finalizado++;
      else inactivo++;
    }
    return { total: items.length, inactivo, proceso, finalizado };
  });
  ahoraCalTopPct = computed(() => {
    this.diasSemanaClases();
    return ahoraLineaTopPct(new Date());
  });
  semanaIncluyeHoy = computed(() => this.diasSemanaClases().some((d) => d.key === this.hoyKey()));

  /** Jornadas EN PROCESO = fecha programada = hoy (según el equipo). */
  jornadasOperablesHoy = computed(() =>
    this.jornadas().filter((j) => j.estado === 'EN PROCESO'),
  );

  ubicaciones = ['Carpa', 'Domo', 'Empresa', 'Colegio', 'Auditorio', 'Coliseo', 'Estadio', 'Otro'];

  supervisores = signal<{ _id: string; nombre: string }[]>([]);
  instructores = signal<InstructorJornadaDto[]>([]);
  ciudadContratoTexto = signal('');
  supNuevoNombre = signal('');

  jornadaEdit = signal<JornadaCapDto | null>(null);
  jornadaEditLat = signal('');
  jornadaEditLng = signal('');
  jornadaEditDeteGeorefe = signal<DeteGeorefe>('');
  jornadaEditDireccion = signal('');
  jornadaEditMunicipio = signal('');
  jornadaEditDepto = signal('');
  jornadaEditCodMunicipio = signal('');
  jornadaEditMunicipioTexto = signal('');
  jornadaEditSupervisor = signal('');
  jornadaEditIdSupervisor = signal('');
  jornadaEditFecha = signal('');
  jornadaEditMapaAbierto = signal(false);
  supNuevoNombreJornada = signal('');

  opcionesSupervisores = computed<EnumBuscarOption[]>(() =>
    this.supervisores().map((s) => ({ value: s._id, label: s.nombre })),
  );

  opcionesClientesContrato = computed<EnumBuscarOption[]>(() =>
    this.clientesFe().map((c) => ({
      value: c._id || '',
      label: `${c.nombre || c.razonSocial || c.nombres || '—'} · ${c.identificacion}`,
    })),
  );

  textoClienteContrato = computed(() => {
    const cli = this.clienteFeSeleccionado();
    if (!cli) return '';
    const nom = (cli.nombre || cli.razonSocial || cli.nombres || '').trim();
    return nom ? `${nom} · ${cli.identificacion}` : String(cli.identificacion || '');
  });

  opcionesContratosToolbar = computed<EnumBuscarOption[]>(() =>
    this.contratos().map((c) => ({
      value: c._id || '',
      label: this.labelContrato(c),
    })),
  );

  textoContratoSel = computed(() => {
    const id = this.contratoSel();
    if (!id) return '';
    const c = this.contratos().find((x) => x._id === id);
    return c ? this.labelContrato(c) : '';
  });

  opcionesJornadasHoyToolbar = computed<EnumBuscarOption[]>(() =>
    this.jornadasOperablesHoy().map((j) => ({
      value: j._id || '',
      label: `${this.labelJornada(j)} — ${j.estado}`,
    })),
  );

  textoJornadaSel = computed(() => {
    const id = this.jornadaSel();
    if (!id) return '';
    const j = this.jornadasOperablesHoy().find((x) => x._id === id);
    return j ? `${this.labelJornada(j)} — ${j.estado}` : '';
  });

  textoSupervisorContrato = computed(() => {
    const id = this.formContrato().idSupervisor || '';
    if (!id) return '';
    return this.supervisores().find((s) => s._id === id)?.nombre || this.formContrato().supervisor || '';
  });

  textoSupervisorJornadaEdit = computed(() => {
    const id = this.jornadaEditIdSupervisor();
    if (!id) return '';
    return this.supervisores().find((s) => s._id === id)?.nombre || this.jornadaEditSupervisor() || '';
  });

  opcionesJornadasCrear = computed<EnumBuscarOption[]>(() =>
    this.jornadasParaCrear().map((j) => ({
      value: j._id,
      label: `${this.labelJornadaCorta(j)} — ${j.estado}`,
    })),
  );

  textoJornadaModal = computed(() => {
    const id = this.modalCrearJornadaId();
    if (!id) return '';
    const j =
      this.jornadasParaCrear().find((x) => x._id === id) ||
      this.jornadas().find((x) => x._id === id);
    return j ? `${this.labelJornadaCorta(j)} — ${j.estado}` : '';
  });

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

  georefLoading = signal(false);
  private georefDebounce: ReturnType<typeof setTimeout> | null = null;

  claseEditando = signal(false);
  claseEditProg = signal('');
  claseEditUbic = signal('Carpa');
  claseEditInstructorId = signal<number | ''>('');

  /** Modo de operación de la pestaña Clases: 'operar' (jornada del día) o 'admin' (todas). */
  modoClases = signal<'operar' | 'admin'>('operar');
  filtroAdminEstado = signal<string>('');

  modalCrearClase = signal(false);
  /** 'nuevo' = crea; 'editar' = abre clase existente */
  modalModoClase = signal<'nuevo' | 'editar'>('nuevo');
  subiendoFotoEvidencia = signal(false);
  modalHoraInicio = signal('');
  modalHoraFin = signal('');
  readonly opcionesHoras = listaOpcionesHora(15);
  modalClaseInstructorId = signal<number | ''>('');
  guardandoClase = signal(false);
  alumnoBusqueda = signal('');
  alumnoBusquedaOpen = signal(false);
  alumnoBusquedaLoading = signal(false);
  alumnoBusquedaResults = signal<AlumnoListItem[]>([]);
  alumnosMatricular = signal<AlumnoListItem[]>([]);
  /** Alumnos ya matriculados al programa (modo editar) con flag de asistencia */
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
  guardandoAsistencia = signal<number | null>(null);
  guardandoInscripcion = signal(false);
  cronometroDisplay = signal('00:00:00');
  private cronometroTimer: ReturnType<typeof setInterval> | null = null;
  private alumnoBusqueda$ = new Subject<string>();
  private livePollTimer: ReturnType<typeof setInterval> | null = null;
  private ultimoLiveTick = 0;
  private jornadaPendienteQp = signal<string | null>(null);
  private clasePendienteQp = signal<string | null>(null);
  private tabPendienteQp = signal<Tab | null>(null);

  constructor() {
    effect(() => {
      const tick = this.liveSync.refreshTick();
      if (tick <= this.ultimoLiveTick) return;
      this.ultimoLiveTick = tick;
      const t = this.tab();
      if (t === 'jornadas') this.recargarVistaJornadas();
      else if (t === 'clases') this.recargarClases();
    });
    effect(() => {
      if (this.modalCrearClase()) {
        this.asistente.setTipsPrepend([
          tipFormulario('Esta clase', this.subtituloModalClase(), 'jor-clase-ctx'),
        ]);
      } else {
        this.asistente.clearTipsPrepend();
      }
    });
  }

  ngOnInit() {
    this.cargarSupervisores();
    this.cargarInstructores();
    this.cargarDatosFacturacionContrato();
    let contratosListos = false;
    this.jornadaSvc.listarContratos().subscribe({
      next: (rows) => {
        this.contratos.set(rows || []);
        contratosListos = true;
        this.aplicarQueryParams(this.route.snapshot.queryParamMap);
      },
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((qp) => {
      if (contratosListos) this.aplicarQueryParams(qp);
    });
    this.deeplink.nav$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((link) => {
      if (contratosListos) this.aplicarDeepLink(link);
    });
    this.alumnoBusqueda$
      .pipe(
        debounceTime(220),
        distinctUntilChanged(),
        switchMap((q) => {
          this.alumnoBusquedaLoading.set(true);
          return this.jornadaSvc.buscarAlumnos(q, 12);
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
  }

  ngOnDestroy() {
    this.detenerCronometro();
    this.detenerLivePoll();
  }

  private aplicarQueryParams(qp: ParamMap) {
    const contratoQp = qp.get('contrato');
    const nuevoQp = qp.get('nuevo');
    const tabQp = qp.get('tab');
    const jornadaQp = qp.get('jornada');
    const claseQp = qp.get('clase');

    if (claseQp) this.clasePendienteQp.set(claseQp);
    else this.clasePendienteQp.set(null);

    if (nuevoQp) {
      this.formContrato.set(this.emptyContrato());
      this.ciudadContratoTexto.set('');
      this.tab.set('contratos');
      return;
    }
    if (!contratoQp) return;

    const tab =
      tabQp === 'jornadas' || tabQp === 'clases' || tabQp === 'certificados' || tabQp === 'contratos'
        ? tabQp
        : undefined;
    this.aplicarDeepLink({ contrato: contratoQp, tab, jornada: jornadaQp || undefined });
  }

  private aplicarDeepLink(link: { contrato: string; tab?: Tab; jornada?: string }) {
    const tabDest = link.tab;
    if (tabDest === 'jornadas' || tabDest === 'clases' || tabDest === 'certificados' || tabDest === 'contratos') {
      this.tab.set(tabDest);
      this.tabPendienteQp.set(tabDest);
    } else {
      this.tabPendienteQp.set(null);
    }
    if (link.jornada) this.jornadaPendienteQp.set(link.jornada);
    else this.jornadaPendienteQp.set(null);

    const c = this.contratos().find((x) => x._id === link.contrato);
    if (!c) return;

    this.contratoSel.set(link.contrato);
    const tab = this.tabPendienteQp();
    if (tab === 'jornadas' || tab === 'clases') {
      this.tab.set(tab);
      this.onContratoSelChange(link.contrato);
    } else {
      this.editarContrato(c);
      this.tab.set('contratos');
    }
  }

  ESTADOS_CONTRATO: ReadonlyArray<'En Ejecución' | 'Ejecutado'> = ['En Ejecución', 'Ejecutado'];

  emptyContrato(): ContratacionDto {
    return {
      pais: 'Colombia',
      estado: 'En Ejecución',
      codContrato: '',
      objetoContrato: '',
      idClienteFacturacion: null,
      valorContrato: 0,
      numerojornadas: 1,
      jornadasPorDia: 1,
      numeroAlumnos: 0,
      numSesCert: 1,
      incluiSab: false,
      incluiDom: false,
      incluiFest: false,
    };
  }

  nuevoContratoForm() {
    this.formContrato.set(this.emptyContrato());
    this.ciudadContratoTexto.set('');
    this.fechaFinalizacionContrato.set(ymdLocal(new Date()));
  }

  abrirContratoEnJornadas(c: ContratacionDto, ev?: Event) {
    ev?.stopPropagation();
    if (!c._id) return;
    this.contratoSel.set(c._id);
    this.editarContrato(c);
    this.setTab('jornadas');
  }

  cambiarEstadoContrato(c: ContratacionDto, estado: string, ev?: Event) {
    ev?.stopPropagation();
    if (!c._id || c.estado === estado) return;
    this.jornadaSvc.actualizarContrato(c._id, { ...c, estado }).subscribe({
      next: (actualizado) => {
        this.contratos.update((arr) =>
          arr.map((x) => (x._id === actualizado._id ? actualizado : x)),
        );
        if (this.formContrato()._id === actualizado._id) {
          this.formContrato.update((f) => ({
            ...f,
            estado: actualizado.estado,
            fechaFinalizacion: actualizado.fechaFinalizacion,
          }));
        }
        if (actualizado.estado === 'Ejecutado' && this.contratoSel() === actualizado._id) {
          this.recargarVistaJornadas();
        }
        this.mostrarMsg(
          `Contrato marcado como «${actualizado.estado}».`,
          actualizado.estado === 'Ejecutado' ? 'info' : 'ok',
          'Estado actualizado',
        );
      },
      error: (e) =>
        this.mostrarMsg(e?.error?.message || 'No se pudo cambiar el estado.', 'error', 'Error'),
    });
  }

  contratoFormEjecutado(): boolean {
    return (this.formContrato().estado || 'En Ejecución') === 'Ejecutado';
  }

  async finalizarContratoActual() {
    const f = this.formContrato();
    if (!f._id) {
      this.mostrarMsg('Guarde el contrato antes de finalizarlo.', 'warn', 'Contrato sin guardar');
      return;
    }
    if (this.contratoFormEjecutado()) return;
    const cod = (f.codContrato || '').trim() || 'este contrato';
    const ok = await this.confirmSvc.open({
      title: 'Finalizar contrato',
      message: `¿Marcar «${cod}» como Ejecutado con fecha ${this.fmtFecha(this.fechaFinalizacionContrato())}? Las jornadas activas dejarán de generar alertas.`,
      confirmLabel: 'Finalizar contrato',
      variant: 'danger',
    });
    if (!ok) return;
    this.loading.set(true);
    this.jornadaSvc.finalizarContrato(f._id, this.fechaFinalizacionContrato()).subscribe({
      next: (r) => {
        this.loading.set(false);
        const c = r.contrato;
        this.formContrato.set({
          ...c,
          objetoContrato: c.objetoContrato || c.objeto || '',
          fechaInicJornadas: c.fechaInicJornadas ? ymdCalendario(c.fechaInicJornadas) : '',
        });
        this.recargarContratos();
        if (this.contratoSel() === c._id) this.recargarVistaJornadas();
        this.mostrarMsg(
          r.message || 'Contrato finalizado correctamente.',
          'ok',
          'Contrato ejecutado',
        );
      },
      error: (e) => {
        this.loading.set(false);
        this.mostrarMsg(e?.error?.message || 'No se pudo finalizar el contrato.', 'error', 'Error');
      },
    });
  }

  setTab(t: Tab) {
    this.tab.set(t);
    if (t === 'jornadas' || t === 'clases' || t === 'certificados') {
      if (!this.contratoSel() && this.contratos().length) {
        const c = this.contratos()[0];
        if (c._id) this.onContratoSelChange(c._id);
      }
    }
    if (t === 'jornadas') this.recargarVistaJornadas();
    if (t === 'clases') {
      this.cargarProgramasJornada();
      this.cargarInstructores();
      if (this.contratoSel()) {
        this.jornadaSvc.listarJornadas({ idContrato: this.contratoSel() }).subscribe({
          next: (r) => {
            this.jornadas.set(r || []);
            this.autoSeleccionarJornadaHoy();
            this.recargarClases();
          },
        });
      } else {
        this.recargarClases();
      }
    }
    if (t === 'certificados') this.recargarCerts();
    this.syncLivePoll();
  }

  /** Refresco periódico de listados en pestañas Jornadas / Clases (vista admin). */
  private syncLivePoll() {
    this.detenerLivePoll();
    if (!this.puedeAsignarInstructor()) return;
    const t = this.tab();
    if (t !== 'jornadas' && t !== 'clases') return;
    this.livePollTimer = setInterval(() => {
      const tab = this.tab();
      if (tab === 'jornadas') this.recargarVistaJornadas();
      else if (tab === 'clases') this.recargarClases();
    }, 10_000);
  }

  private detenerLivePoll() {
    if (this.livePollTimer) {
      clearInterval(this.livePollTimer);
      this.livePollTimer = null;
    }
  }

  cargarProgramasJornada() {
    this.jornadaSvc.programasJornadaCap().subscribe({
      next: (p) => {
        this.programasJornada.set(p || []);
        if (this.modalCrearClase()) {
          const idRaw = this.nuevaClaseProg() || this.claseActiva()?.idPrograma;
          if (idRaw) this.sincronizarProgramaModal(String(idRaw));
        }
      },
      error: () => this.programasJornada.set([]),
    });
  }

  /** Mismo criterio que el backend al guardar idPrograma en la clase. */
  programaOptionValue(p: { idPrograma?: unknown; _id?: unknown; idProg?: unknown }): string {
    if (p?.idPrograma != null && String(p.idPrograma).trim() !== '') {
      return String(p.idPrograma);
    }
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

  sincronizarProgramaModal(idProgRaw?: string | null) {
    const id = String(idProgRaw ?? '').trim();
    if (!id) {
      this.nuevaClaseProg.set('');
      return;
    }
    const hit = this.buscarProgramaEnLista(id);
    this.nuevaClaseProg.set(hit ? this.programaOptionValue(hit) : id);
  }

  programaModalEnLista(): boolean {
    const v = this.nuevaClaseProg();
    if (!v) return true;
    return !!this.buscarProgramaEnLista(v);
  }

  etiquetaProgramaModal(): string {
    const v = this.nuevaClaseProg();
    if (!v) return '';
    const p = this.buscarProgramaEnLista(v);
    if (p) return String(p.nombreProg || p.codigoProg || v);
    const cl = this.claseActiva();
    return String(cl?.programaNombre || v);
  }

  cargarInstructores() {
    this.jornadaSvc.listarInstructores().subscribe({
      next: (r) => this.instructores.set(r || []),
      error: () => this.instructores.set([]),
    });
  }

  labelInstructorClase(c: { instructorNombre?: string; idinstructor?: string }): string {
    return (c.instructorNombre || c.idinstructor || '—').trim() || '—';
  }

  cargarSupervisores() {
    this.jornadaSvc.listarSupervisores().subscribe({
      next: (r) => this.supervisores.set(r || []),
    });
  }

  onClaseInstructorChange(id: string) {
    this.claseEditInstructorId.set(id ? Number(id) : '');
  }

  onModalClaseInstructorChange(id: string) {
    this.modalClaseInstructorId.set(id ? Number(id) : '');
  }

  abrirModalCrearClase() {
    this.modalModoClase.set('nuevo');
    this.claseActiva.set(null);
    this.claseSel.set('');
    this.modalClaseInstructorId.set('');
    this.alumnoBusqueda.set('');
    this.alumnoBusquedaResults.set([]);
    this.alumnoBusquedaOpen.set(false);
    this.alumnosMatricular.set([]);
    this.inscritos.set([]);
    this.nuevaClaseProg.set('');
    this.nuevaClaseUbic.set('Carpa');
    this.modalFechaClase.set('');
    this.modalCrearJornadaId.set(this.jornadaSel() || '');
    if (!this.jornadasParaCrear().length) this.cargarJornadasParaCrear();
    this.cargarProgramasJornada();
    this.sincronizarFechaClaseDesdeJornada(this.modalCrearJornadaId());
    this.modalCrearClase.set(true);
  }

  abrirModalEditarClase(c: any) {
    this.modalModoClase.set('editar');
    this.claseSel.set(c._id);
    this.claseActiva.set(c);
    this.modalCrearJornadaId.set(String(c.idJornada || ''));
    this.modalFechaClase.set(c.fechaClase ? String(c.fechaClase) : c.fechaJornada ? String(c.fechaJornada) : '');
    this.nuevaClaseProg.set(String(c.idPrograma || ''));
    this.nuevaClaseUbic.set(c.ubicacion || 'Carpa');
    this.modalClaseInstructorId.set(c.idEmpleadoInstructor ?? '');
    this.modalHoraInicio.set(isoAHoraInput(c.horaInicio));
    this.modalHoraFin.set(isoAHoraInput(c.horaFin));
    this.alumnoBusqueda.set('');
    this.alumnoBusquedaResults.set([]);
    this.alumnoBusquedaOpen.set(false);
    this.alumnosMatricular.set([]);
    this.inscritos.set([]);
    if (!this.jornadasParaCrear().length) this.cargarJornadasParaCrear();
    this.sincronizarProgramaModal(String(c.idPrograma || ''));
    this.cargarProgramasJornada();
    this.cargarInscritos(c._id);
    this.modalCrearClase.set(true);
    this.iniciarCronometroSiAplica();
  }

  cargarInscritos(idClase: string) {
    this.jornadaSvc.inscritosClase(idClase).subscribe({
      next: (rows) => this.inscritos.set(rows || []),
      error: () => this.inscritos.set([]),
    });
  }

  jornadaClaseModalOperable(): boolean {
    const cl = this.claseActiva();
    if (!cl) return false;
    if (!esFechaHoy(cl.fechaClase || cl.fechaJornada)) return false;
    if (cl.jornadaEstado === 'EN PROCESO') return true;
    const jId = String(this.modalCrearJornadaId() || cl.idJornada || '');
    const j =
      this.jornadas().find((x) => x._id === jId) ||
      this.jornadasParaCrear().find((x: any) => x._id === jId);
    return j?.estado === 'EN PROCESO';
  }

  claseModalIniciable(): boolean {
    const cl = this.claseActiva();
    if (!cl || cl.estado === 'FINALIZADO') return false;
    if (cl.estado === 'EN PROCESO' && cl.horaInicio) return false;
    return this.jornadaClaseModalOperable();
  }

  tituloBotonIniciarClase(): string {
    const cl = this.claseActiva();
    if (cl && !esFechaHoy(cl.fechaClase || cl.fechaJornada)) {
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

  private actualizarCronometroDisplay() {
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

  private detenerCronometro() {
    if (this.cronometroTimer) {
      clearInterval(this.cronometroTimer);
      this.cronometroTimer = null;
    }
  }

  private iniciarCronometroSiAplica() {
    this.detenerCronometro();
    this.actualizarCronometroDisplay();
    const cl = this.claseActiva();
    if (cl?.estado === 'EN PROCESO' && cl.horaInicio && !cl.horaFin) {
      this.cronometroTimer = setInterval(() => this.actualizarCronometroDisplay(), 1000);
    }
  }

  claseModalFinalizable(): boolean {
    const cl = this.claseActiva();
    return !!cl && cl.estado === 'EN PROCESO';
  }

  claseModalEnProceso(): boolean {
    return this.claseActiva()?.estado === 'EN PROCESO';
  }

  /** Admin: también en clases finalizadas (correcciones). */
  puedeMarcarAsistenciaInscrito(): boolean {
    if (this.claseModalEnProceso()) return true;
    return this.puedeEliminarClase() && this.claseActiva()?.estado === 'FINALIZADO';
  }

  puedeMarcarAsistenciaAlumno(a: {
    yaCertificadoContrato?: boolean;
    tieneAsistencia?: boolean;
  }): boolean {
    if (a.yaCertificadoContrato && !a.tieneAsistencia) return false;
    return this.puedeMarcarAsistenciaInscrito();
  }

  idContratoParaClaseModal(): string {
    if (this.modalModoClase() === 'editar' && this.claseActiva()) {
      const j = this.jornadas().find((x) => x._id === this.claseActiva()?.idJornada);
      return j?.idContrato || this.contratoSel() || '';
    }
    const j = this.jornadas().find((x) => x._id === this.modalCrearJornadaId());
    return j?.idContrato || this.contratoSel() || '';
  }

  urlFotoEvidencia(path?: string | null): string {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    return `${environment.uploadsUrl}/${path.replace(/^\/+/, '')}`;
  }

  onFotoEvidenciaSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    const id = this.claseSel();
    if (!file || !id) return;
    this.subiendoFotoEvidencia.set(true);
    this.jornadaSvc.subirFotoEvidenciaClase(id, file).subscribe({
      next: (c) => {
        this.claseActiva.set(c);
        this.subiendoFotoEvidencia.set(false);
        this.recargarClases();
        this.mostrarMsg('Foto de evidencia guardada.', 'ok', 'Evidencia');
      },
      error: (e) => {
        this.subiendoFotoEvidencia.set(false);
        this.mostrarMsg(e?.error?.message || 'No se pudo subir la foto.', 'error', 'Error');
      },
    });
    input.value = '';
  }

  /** Instructor: solo EN PROCESO. Administrador: en cualquier estado de la clase. */
  puedeBorrarAsistenciaDeClase(): boolean {
    if (this.puedeEliminarClase()) return true;
    return this.claseModalEnProceso();
  }

  /** Instructor: mientras la clase no esté finalizada. Administrador: siempre. */
  puedeQuitarInscritoDeClase(): boolean {
    if (this.puedeEliminarClase()) return true;
    return this.claseActiva()?.estado !== 'FINALIZADO';
  }

  iniciarClaseModal() {
    const id = this.claseSel();
    if (!id || !this.claseModalIniciable()) return;
    this.jornadaSvc.iniciarClase(id).subscribe({
      next: (c) => {
        this.claseActiva.set(c);
        this.iniciarCronometroSiAplica();
        this.recargarClases();
        this.liveSync.notificarClaseIniciada(c as unknown as Record<string, unknown>);
        this.mostrarMsg('Clase iniciada. El cronómetro está activo.', 'ok', 'Clase iniciada');
      },
      error: (e) => this.mostrarMsg(e?.error?.message || 'No se pudo iniciar la clase.', 'error', 'Error'),
    });
  }

  finalizarClaseModal() {
    const id = this.claseSel();
    if (!id) return;
    this.jornadaSvc.finalizarClase(id).subscribe({
      next: (r: any) => {
        const c = r?.clase || { ...this.claseActiva(), estado: 'FINALIZADO' };
        this.claseActiva.set(c);
        this.detenerCronometro();
        this.actualizarCronometroDisplay();
        this.cargarInscritos(id);
        this.recargarClases();
        this.recargarCerts();
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
      },
      error: (e) => this.mostrarMsg(e?.error?.message || 'No se pudo finalizar la clase.', 'error', 'Error'),
    });
  }

  sincronizarAsistenciasClaseModal() {
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
        this.recargarCerts();
        if (r.certificadosNuevos > 0) {
          this.certAlertSvc.notificarVariosDesdeRespuesta(r.certificadosEmitidos);
        }
        const msg = r.message || 'Asistencias sincronizadas.';
        const tipo = r.certificadosNuevos > 0 ? 'ok' : 'info';
        this.mostrarMsgModal(msg, tipo, 'Asistencia');
        this.mostrarMsg(msg, tipo, 'Asistencia');
      },
      error: (e) => {
        const err = e?.error?.message || 'No se pudo registrar la asistencia.';
        this.mostrarMsgModal(err, 'error', 'Error');
        this.mostrarMsg(err, 'error', 'Error');
      },
    });
  }

  guardarCambiosClaseModal() {
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
        this.recargarClases();
        this.mostrarMsg('Cambios guardados.', 'ok', 'Clase actualizada');
      },
      error: (e) => this.mostrarMsg(e?.error?.message || 'No se pudo guardar la clase.', 'error', 'Error'),
    });
  }

  async quitarInscritoDeClase(
    numDoc: number,
    nombre?: string,
    opts?: { tieneAsistencia?: boolean },
  ) {
    const id = this.claseSel();
    if (!id) return;
    const extraAsist =
      opts?.tieneAsistencia
        ? ' También se eliminará su asistencia en esta clase.'
        : '';
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
        this.cargarAsistencias(id);
        this.mostrarMsg('Alumno retirado de la clase.', 'ok', 'Inscripción eliminada');
      },
      error: (e) => {
        this.guardandoAsistencia.set(null);
        this.mostrarMsg(e?.error?.message || 'No se pudo quitar al alumno.', 'error', 'Error');
      },
    });
  }

  async borrarAsistenciaInscrito(numDoc: number, nombre?: string) {
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
        this.cargarAsistencias(id);
        this.mostrarMsg('Asistencia eliminada.', 'ok', 'Asistencia borrada');
      },
      error: (e) => {
        this.guardandoAsistencia.set(null);
        this.mostrarMsg(e?.error?.message || 'No se pudo borrar la asistencia.', 'error', 'Error');
      },
    });
  }

  marcarAsistenciaInscrito(numDoc: number) {
    const id = this.claseSel();
    if (!id) return;
    this.guardandoAsistencia.set(numDoc);
    this.jornadaSvc.registrarAsistencia(id, numDoc).subscribe({
      next: (r: any) => {
        this.guardandoAsistencia.set(null);
        this.cargarInscritos(id);
        this.cargarAsistencias(id);
        this.mostrarResultadoAsistencia(r);
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
          return;
        }
        this.mostrarMsg(body?.message || 'No se pudo registrar la asistencia.', 'error', 'Error');
      },
    });
  }

  /** Jornadas disponibles para crear clase (EN PROCESO de hoy, todas las del sistema). */
  jornadasParaCrear = signal<any[]>([]);
  modalCrearJornadaId = signal<string>('');
  /** Fecha de la clase (= fecha programada de la jornada elegida). */
  modalFechaClase = signal<string>('');

  onModalCrearJornadaChange(id: string) {
    this.modalCrearJornadaId.set(id || '');
    this.sincronizarFechaClaseDesdeJornada(id);
  }

  private sincronizarFechaClaseDesdeJornada(jornadaId: string) {
    if (!jornadaId) {
      this.modalFechaClase.set('');
      return;
    }
    const j =
      this.jornadasParaCrear().find((x: any) => x._id === jornadaId) ||
      this.jornadas().find((x) => x._id === jornadaId);
    this.modalFechaClase.set(j?.fechaProgramacion ? String(j.fechaProgramacion) : '');
  }

  cargarJornadasParaCrear() {
    this.jornadaSvc.listarJornadas().subscribe({
      next: (rows) => {
        this.jornadasParaCrear.set(
          (rows || []).filter((j: any) => this.jornadaEnVentanaCreacion(j)),
        );
        if (this.modalCrearJornadaId()) {
          this.sincronizarFechaClaseDesdeJornada(this.modalCrearJornadaId());
        }
      },
      error: () => this.jornadasParaCrear.set([]),
    });
  }

  /** Solo se permite crear clases para una jornada el día anterior o el mismo día. */
  jornadaEnVentanaCreacion(j: { fechaProgramacion?: string | Date }): boolean {
    if (!j?.fechaProgramacion) return false;
    const inicioDia = (d: Date) => {
      const r = new Date(d);
      r.setHours(0, 0, 0, 0);
      return r;
    };
    const prog = inicioDia(new Date(j.fechaProgramacion)).getTime();
    const hoy = inicioDia(new Date()).getTime();
    const dias = Math.round((prog - hoy) / (24 * 60 * 60 * 1000));
    return dias === 0 || dias === 1;
  }

  labelJornadaCorta(j: any): string {
    const cod = this.codContratoDe(j?.idContrato);
    const fecha = this.fmtFecha(j?.fechaProgramacion);
    const muni = j?.municipio ? ` · ${j.municipio}` : '';
    const idx = j?.indiceEnDia && j.indiceEnDia > 1 ? ` #${j.indiceEnDia}` : '';
    return `${cod ? cod + ' · ' : ''}${fecha}${idx}${muni}`;
  }

  cerrarModalCrearClase() {
    if (this.guardandoClase()) return;
    this.detenerCronometro();
    this.modalCrearClase.set(false);
    this.alumnoBusquedaOpen.set(false);
    this.limpiarMsgModal();
  }

  limpiarMsgModal() {
    this.modalMsg.set(null);
    this.modalMsgTitulo.set('');
  }

  mostrarMsgModal(texto: string, tipo: JorMsgTipo = 'info', titulo?: string) {
    this.modalMsg.set(texto);
    this.modalMsgTipo.set(tipo);
    this.modalMsgTitulo.set(titulo ?? tituloJorMsg(tipo));
  }

  private mensajeInscripcionOk(r: { inscripcionDuplicada?: boolean; yaExistia?: boolean; matricula?: { yaExistia?: boolean } }, nombre: string): string {
    if (r?.inscripcionDuplicada) return `${nombre} ya estaba inscrito en esta clase.`;
    const yaMatriculado = r?.yaExistia || r?.matricula?.yaExistia;
    if (yaMatriculado) return `${nombre} inscrito en la clase (ya estaba matriculado al programa).`;
    return `${nombre} matriculado e inscrito en la clase.`;
  }

  onAlumnoBusquedaInput(value: string) {
    this.alumnoBusqueda.set(value);
    this.alumnoBusquedaOpen.set(true);
    this.alumnoBusqueda$.next((value ?? '').trim());
  }

  focusAlumnoBusqueda() {
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
    if (this.modalModoClase() === 'editar') {
      return this.inscritos().some((x) => formatNumDoc(x.numDoc) === doc);
    }
    return this.alumnosMatricular().some((x) => formatNumDoc(x.numDoc) === doc);
  }

  agregarAlumnoMatricula(a: AlumnoListItem) {
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

  private ejecutarAgregarAlumnoMatricula(a: AlumnoListItem) {
    if (this.modalModoClase() === 'editar' && this.claseSel()) {
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
      const idC = this.claseSel();
      this.guardandoInscripcion.set(true);
      this.jornadaSvc
        .matricularAlumno({ numDoc: a.numDoc, idPrograma: idP, idClase: idC })
        .subscribe({
          next: (r: any) => {
            this.guardandoInscripcion.set(false);
            this.cargarInscritos(idC);
            const nombre = this.nombreAlumnoItem(a);
            const msg = this.mensajeInscripcionOk(r, nombre);
            const tipo = r?.inscripcionDuplicada ? 'info' : 'ok';
            this.mostrarMsgModal(msg, tipo, 'Alumno inscrito');
            this.mostrarMsg(msg, tipo, 'Alumno inscrito');
          },
          error: (e) => {
            this.guardandoInscripcion.set(false);
            if (e?.status === 409 && e?.error?.codigo === 'ya_certificado_contrato') {
              void this.certBloqueoSvc.mostrarDesdeError(e.error, this.nombreAlumnoItem(a));
              return;
            }
            const err = e?.error?.message || 'No se pudo inscribir al alumno.';
            this.mostrarMsgModal(err, 'error', 'Error');
            this.mostrarMsg(err, 'error', 'Error');
          },
        });
      this.alumnoBusqueda.set('');
      this.alumnoBusquedaResults.set([]);
      this.alumnoBusquedaOpen.set(false);
      return;
    }

    if (this.alumnoYaEnLista(a)) {
      this.mostrarMsg('Ese alumno ya está en la lista de matrícula.', 'info', 'Duplicado');
      return;
    }
    this.alumnosMatricular.update((list) => [...list, a]);
    this.mostrarMsgModal(
      `${this.nombreAlumnoItem(a)} agregado. Se matriculará al guardar la clase.`,
      'ok',
      'Alumno agregado',
    );
    this.alumnoBusqueda.set('');
    this.alumnoBusquedaResults.set([]);
    this.alumnoBusquedaOpen.set(false);
  }

  imprimirCertificadoInscrito(a: {
    numDoc: number;
    nombreCompleto?: string;
    certificadoId?: string | null;
    certificadoCodigo?: string | null;
  }) {
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

  quitarAlumnoMatricula(a: AlumnoListItem) {
    const doc = formatNumDoc(a.numDoc);
    this.alumnosMatricular.update((list) =>
      list.filter((x) => formatNumDoc(x.numDoc) !== doc),
    );
  }

  @HostListener('document:click', ['$event'])
  cerrarBusquedaAlumnoFuera(ev: MouseEvent) {
    const t = ev.target as HTMLElement;
    if (!t.closest('.clase-alumno-buscar')) this.alumnoBusquedaOpen.set(false);
  }

  crearSupervisor() {
    const nombre = this.supNuevoNombre().trim();
    if (!nombre) return;
    this.jornadaSvc.crearSupervisor({ nombre }).subscribe({
      next: (s) => {
        this.supNuevoNombre.set('');
        this.cargarSupervisores();
        this.patchContrato('idSupervisor', s._id);
        this.patchContrato('supervisor', s.nombre);
      },
    });
  }

  crearSupervisorJornada() {
    const nombre = this.supNuevoNombreJornada().trim();
    if (!nombre) return;
    this.jornadaSvc.crearSupervisor({ nombre }).subscribe({
      next: (s) => {
        this.supNuevoNombreJornada.set('');
        this.cargarSupervisores();
        this.jornadaEditIdSupervisor.set(s._id);
        this.jornadaEditSupervisor.set(s.nombre);
      },
    });
  }

  onSupervisorChange(id: string) {
    this.patchContrato('idSupervisor', id || undefined);
    const sup = this.supervisores().find((s) => s._id === id);
    this.patchContrato('supervisor', sup?.nombre || '');
  }

  onSupervisorContratoPick(opt: EnumBuscarOption): void {
    this.onSupervisorChange(String(opt.value));
  }

  onSupervisorContratoLimpiar(): void {
    this.onSupervisorChange('');
  }

  onJornadaSupervisorChange(id: string) {
    this.jornadaEditIdSupervisor.set(id || '');
    const sup = this.supervisores().find((s) => s._id === id);
    this.jornadaEditSupervisor.set(sup?.nombre || '');
  }

  onSupervisorJornadaPick(opt: EnumBuscarOption): void {
    this.onJornadaSupervisorChange(String(opt.value));
  }

  onSupervisorJornadaLimpiar(): void {
    this.onJornadaSupervisorChange('');
  }

  onJornadaModalPick(opt: EnumBuscarOption): void {
    this.onModalCrearJornadaChange(String(opt.value));
  }

  onJornadaModalLimpiar(): void {
    this.onModalCrearJornadaChange('');
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

  onMuniContrato(m: MunicipioDivipola) {
    this.ciudadContratoTexto.set(m.label);
    this.formContrato.update((f) => ({
      ...f,
      codMunicipio: m.codMunicipio,
      ciudad: m.nombreMunicipio,
      departamento: m.nombreDepto,
    }));
  }

  onMunicipioJornada(m: MunicipioDivipola) {
    this.jornadaEditMunicipioTexto.set(m.label);
    this.jornadaEditMunicipio.set(m.nombreMunicipio);
    this.jornadaEditDepto.set(m.nombreDepto);
    this.jornadaEditCodMunicipio.set(m.codMunicipio);
    this.jornadaEditDeteGeorefe.set('MANUAL');
  }

  private cargarTextoMunicipioJornada(j: JornadaCapDto) {
    const fallback =
      j.municipio && j.depto ? `${j.municipio} - ${j.depto}` : j.municipio || '';
    this.jornadaEditMunicipioTexto.set(fallback);
    if (j.codMunicipio) {
      this.catSvc.municipioPorCodigo(j.codMunicipio).subscribe({
        next: (m) => this.jornadaEditMunicipioTexto.set(m.label || fallback),
        error: () => this.jornadaEditMunicipioTexto.set(fallback),
      });
    }
  }

  recargarContratos() {
    this.jornadaSvc.listarContratos().subscribe({
      next: (r) => this.contratos.set(r || []),
    });
  }

  cargarDatosFacturacionContrato(): void {
    this.clienteSvc.listar().subscribe({
      next: (rows) => {
        this.clientesFe.set(rows || []);
        const cli = this.clienteFeSeleccionado();
        if (cli) this.aplicarClienteAlContrato(cli);
      },
      error: () => this.clientesFe.set([]),
    });
    this.clienteSvc.catalogos().subscribe({
      next: (c) => this.tiposContrato.set(c.tiposContratoCap || []),
      error: () => this.tiposContrato.set([]),
    });
  }

  labelTipoContratoCap(id?: string | null): string {
    const t = this.tiposContrato().find((x) => x.id === id);
    return t?.label || id || '—';
  }

  clienteFeLabel(id?: string | null): string {
    if (!id) return '';
    const c = this.clientesFe().find((x) => x._id === id);
    return c ? `${c.nombre || c.razonSocial || ''} (${c.identificacion})` : '';
  }

  clienteFeSeleccionado(): Cliente | null {
    const id = this.formContrato().idClienteFacturacion;
    if (!id) return null;
    return this.clientesFe().find((x) => x._id === id) || null;
  }

  private tipoIdDesdeCliente(code?: string | null): string {
    const map: Record<string, string> = {
      '31': 'NIT',
      '13': 'CC',
      '22': 'CE',
      '12': 'TI',
      '41': 'PP',
    };
    const c = String(code || '').trim();
    return map[c] || c || 'NIT';
  }

  private contratoDtoConCliente(f: ContratacionDto, cli: Cliente): ContratacionDto {
    return {
      ...f,
      idClienteFacturacion: cli._id || f.idClienteFacturacion || null,
      razoSocial: (cli.razonSocial || cli.nombres || '').trim(),
      nombreComercial: (cli.nombreComercial || '').trim(),
      numeroIdentificacion: (cli.identificacion || '').trim(),
      tipoIdentificacion: this.tipoIdDesdeCliente(cli.identificationDocumentCode),
      email: cli.correo || f.email || '',
      telefono: cli.telefono || f.telefono || '',
    };
  }

  private aplicarClienteAlContrato(cli: Cliente | null): void {
    if (!cli?._id) {
      this.patchContrato('idClienteFacturacion', null);
      return;
    }
    this.formContrato.update((f) => this.contratoDtoConCliente(f, cli));
  }

  onClienteFacturacionChange(id: string): void {
    const c = this.clientesFe().find((x) => x._id === id) || null;
    this.aplicarClienteAlContrato(c);
    this.previewFacturaContrato.set(null);
  }

  onClienteContratoPick(opt: EnumBuscarOption): void {
    this.onClienteFacturacionChange(String(opt.value));
  }

  onClienteContratoLimpiar(): void {
    this.onClienteFacturacionChange('');
  }

  inicialesCliente(cli: Cliente): string {
    const base = (cli.razonSocial || cli.nombres || cli.nombreComercial || cli.nombre || '?').trim();
    const parts = base.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return base.slice(0, 2).toUpperCase();
  }

  nombreMostrarCliente(cli: Cliente): string {
    return (cli.razonSocial || cli.nombres || cli.nombre || cli.nombreComercial || '—').trim();
  }

  abrirCrearClienteFe(): void {
    window.open('/app/configuracion/clientes', '_blank', 'noopener');
  }

  recargarClientesFe(): void {
    this.clienteSvc.listar().subscribe({
      next: (rows) => {
        this.clientesFe.set(rows || []);
        const cli = this.clienteFeSeleccionado();
        if (cli) this.aplicarClienteAlContrato(cli);
        this.mostrarMsg('Lista de clientes actualizada.', 'ok', 'Clientes');
      },
      error: () => this.mostrarMsg('No se pudieron recargar los clientes.', 'error', 'Clientes'),
    });
  }

  cargarEstadoFacturaContrato(id?: string): void {
    if (!id) {
      this.estadoFacturaContrato.set(null);
      return;
    }
    this.feSvc.estadoFacturaContrato(id).subscribe({
      next: (r) => this.estadoFacturaContrato.set(r),
      error: () => this.estadoFacturaContrato.set(null),
    });
  }

  puedeFacturarContrato(): boolean {
    return (
      this.permisoSvc.tiene('facturacion') || this.permisoSvc.tiene('alumnos.pagos')
    );
  }

  contratoYaFacturado(): boolean {
    return !!this.estadoFacturaContrato()?.facturado;
  }

  private guardarDatosFacturacionContrato(id: string) {
    const f = this.formContrato();
    return this.jornadaSvc.actualizarContrato(id, {
      idClienteFacturacion: f.idClienteFacturacion || null,
      valorContrato: f.valorContrato ?? 0,
    });
  }

  calcularPreviewFacturaContrato(): void {
    const id = this.formContrato()._id;
    if (!id) {
      this.mostrarMsg('Guarde el contrato antes de calcular la factura.', 'warn', 'Facturación');
      return;
    }
    if (!this.formContrato().idClienteFacturacion) {
      this.mostrarMsg('Seleccione el cliente de facturación.', 'warn', 'Facturación');
      return;
    }
    const valor = Number(this.formContrato().valorContrato) || 0;
    if (!(valor > 0)) {
      this.mostrarMsg('Indique el valor del contrato (mayor a cero).', 'warn', 'Facturación');
      return;
    }
    this.guardarDatosFacturacionContrato(id).subscribe({
      next: () => {
        this.feSvc.previewFacturaContrato(id).subscribe({
          next: (p) => {
            this.previewFacturaContrato.set(p);
            this.mostrarMsg('Resumen de factura calculado.', 'ok', 'Facturación');
          },
          error: (e) =>
            this.mostrarMsg(e?.error?.message || 'No se pudo calcular la factura', 'error', 'Facturación'),
        });
      },
      error: (e) =>
        this.mostrarMsg(e?.error?.message || 'No se pudo guardar valor/cliente del contrato', 'error', 'Facturación'),
    });
  }

  emitirFacturaContrato(): void {
    const id = this.formContrato()._id;
    if (!id) return;
    if (!this.previewFacturaContrato()) {
      this.mostrarMsg('Calcule la factura primero (botón «Calcular factura»).', 'warn', 'Facturación');
      return;
    }
    this.emitiendoFactura.set(true);
    this.guardarDatosFacturacionContrato(id).subscribe({
      next: () => {
        this.feSvc.emitirFacturaContrato(id).subscribe({
          next: (doc) => {
            this.emitiendoFactura.set(false);
            this.cargarEstadoFacturaContrato(id);
            this.previewFacturaContrato.set(null);
            this.mostrarMsg(
              `Factura ${doc.numeroFactura || ''} emitida para el contrato.`,
              'ok',
              'Factura electrónica',
            );
            if (doc.urlPdf) window.open(doc.urlPdf, '_blank', 'noopener');
            this.comprobanteAlertSvc.notificarDesdeFactura(doc as unknown as Record<string, unknown>, {
              nombreCompleto:
                (doc as { adquirente?: { nombre?: string } }).adquirente?.nombre || 'Contrato capacitación',
            });
          },
          error: (e) => {
            this.emitiendoFactura.set(false);
            this.mostrarMsg(e?.error?.message || 'Error al emitir factura', 'error', 'Facturación');
          },
        });
      },
      error: (e) => {
        this.emitiendoFactura.set(false);
        this.mostrarMsg(e?.error?.message || 'No se pudo guardar valor/cliente del contrato', 'error', 'Facturación');
      },
    });
  }

  fmtMoney(n?: number | null): string {
    return Number(n || 0).toLocaleString('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    });
  }

  guardarContrato() {
    const f = this.formContrato();
    if (!f.idClienteFacturacion) {
      this.mostrarMsg(
        'Seleccione la empresa desde el catálogo de clientes.',
        'warn',
        'Datos del contrato',
      );
      return;
    }
    const cli = this.clientesFe().find((x) => x._id === f.idClienteFacturacion);
    if (!cli) {
      this.mostrarMsg(
        'Cliente no encontrado. Recargue la lista o créelo en Configuración → Clientes.',
        'warn',
        'Datos del contrato',
      );
      return;
    }
    const payload = this.contratoDtoConCliente(f, cli);
    this.loading.set(true);
    const req = payload._id
      ? this.jornadaSvc.actualizarContrato(payload._id, payload)
      : this.jornadaSvc.crearContrato(payload);
    req.subscribe({
      next: (c) => {
        this.loading.set(false);
        this.formContrato.set(c);
        this.contratoSel.set(c._id || '');
        this.recargarContratos();
        this.mostrarMsg('La contratación quedó registrada. Ya puede generar las jornadas.', 'ok', 'Contrato guardado');
      },
      error: (e) => {
        this.loading.set(false);
        this.mostrarMsg(e?.error?.message || 'Revise los datos e intente de nuevo.', 'error', 'No se guardó el contrato');
      },
    });
  }

  editarContrato(c: ContratacionDto) {
    this.formContrato.set({
      ...c,
      objetoContrato: c.objetoContrato || c.objeto || '',
      fechaInicJornadas: c.fechaInicJornadas ? ymdCalendario(c.fechaInicJornadas) : '',
    });
    const cli = this.clientesFe().find((x) => x._id === c.idClienteFacturacion);
    if (cli) this.aplicarClienteAlContrato(cli);
    this.fechaFinalizacionContrato.set(
      c.fechaFinalizacion ? ymdCalendario(c.fechaFinalizacion) : ymdLocal(new Date()),
    );
    this.contratoSel.set(c._id || '');
    const label =
      c.ciudad && c.departamento
        ? `${c.ciudad} — ${c.departamento}`
        : c.ciudad || '';
    this.ciudadContratoTexto.set(label);
    this.previewFacturaContrato.set(null);
    this.cargarEstadoFacturaContrato(c._id);
    if (c.codMunicipio) {
      this.catSvc.municipioPorCodigo(c.codMunicipio).subscribe({
        next: (m) => this.ciudadContratoTexto.set(m.label || label),
        error: () => this.ciudadContratoTexto.set(label),
      });
    }
  }

  generarJornadas() {
    const id = this.formContrato()._id || this.contratoSel();
    if (!id) {
      this.mostrarMsg('Primero guarde la contratación; después use «Generar faltantes».', 'warn', 'Contrato sin guardar');
      return;
    }
    const inicioTxt = this.formContrato().fechaInicJornadas
      ? this.fmtFecha(this.formContrato().fechaInicJornadas)
      : '';
    if (!inicioTxt || inicioTxt === '—') {
      this.mostrarMsg('Indique la fecha de inicio de jornadas en el contrato y guárdelo.', 'warn', 'Fecha requerida');
      return;
    }
    this.loading.set(true);
    this.jornadaSvc.generarJornadas(id).subscribe({
      next: (r) => {
        this.loading.set(false);
        const desde = r.fechaDesde ? this.fmtFecha(r.fechaDesde) : inicioTxt;
        const notaHoy =
          r.ajustadoDesdeHoy && r.fechaInicioContrato
            ? ` (inicio contrato ${this.fmtFecha(r.fechaInicioContrato)}; se omitieron días pasados)`
            : '';
        this.mostrarMsg(
          r.count > 0
            ? `Se crearon ${r.count} jornada(s) desde el ${desde}${notaHoy}. Total en contrato: ${r.total ?? r.count}.`
            : 'No había fechas pendientes por programar.',
          r.count > 0 ? 'ok' : 'info',
          r.count > 0 ? 'Jornadas generadas' : 'Sin cambios',
        );
        this.recargarContratos();
        this.onContratoSelChange(id);
        this.setTab('jornadas');
        if (r.count > 0) {
          this.liveSync.mostrarToastGeneracionJornadas(r.count);
          this.jornadaSvc.listarJornadas({ idContrato: id }).subscribe({
            next: (rows) => this.liveSync.marcarJornadasConocidas((rows || []).map((j) => j._id)),
          });
        }
      },
      error: (e) => {
        this.loading.set(false);
        this.mostrarMsg(e?.error?.message || 'No fue posible generar las jornadas.', 'error', 'Error de programación');
      },
    });
  }

  setVistaJornadas(v: VistaAgenda) {
    this.vistaJornadas.set(v);
    this.recargarVistaJornadas();
  }

  setVistaClases(v: VistaAgenda) {
    this.vistaClases.set(v);
    if (v === 'calendario') this.recargarClases();
  }

  recargarVistaJornadas() {
    if (this.vistaJornadas() === 'calendario') {
      this.recargarJornadasCalendario();
      return;
    }
    this.recargarJornadas();
  }

  recargarJornadas() {
    const id = this.contratoSel();
    if (!id) {
      this.jornadas.set([]);
      return;
    }
    this.jornadaSvc.listarJornadas({ idContrato: id }).subscribe({
      next: (r) => {
        this.jornadas.set(r || []);
        this.liveSync.marcarJornadasConocidas((r || []).map((j) => j._id));
        const pend = this.jornadaPendienteQp();
        if (pend && (r || []).some((j) => j._id === pend)) {
          this.jornadaSel.set(pend);
          this.jornadaPendienteQp.set(null);
          const j = (r || []).find((x) => x._id === pend);
          if (this.tab() === 'clases') {
            if (this.clasePendienteQp()) {
              this.recargarClases();
            } else if (j) {
              this.abrirJornadaEnClases(j);
            }
          } else if (this.tab() === 'jornadas' && j) {
            this.vistaJornadas.set('lista');
            this.editarJornada(j);
          }
        } else {
          this.autoSeleccionarJornadaHoy();
        }
      },
    });
  }

  recargarJornadasCalendario() {
    const { desde, hasta } = rangoVisibleMes(this.calAnio(), this.calMes());
    const id = this.contratoSel();
    const params: { desde: string; hasta: string; idContrato?: string } = { desde, hasta };
    if (id) params.idContrato = id;
    this.loadingCalJornadas.set(true);
    this.jornadaSvc.listarJornadas(params).subscribe({
      next: (r) => {
        this.jornadasCalendario.set(r || []);
        this.liveSync.marcarJornadasConocidas((r || []).map((j) => j._id));
        this.loadingCalJornadas.set(false);
      },
      error: () => {
        this.jornadasCalendario.set([]);
        this.loadingCalJornadas.set(false);
      },
    });
  }

  mesAnterior() {
    let m = this.calMes() - 1;
    let a = this.calAnio();
    if (m < 0) {
      m = 11;
      a -= 1;
    }
    this.calMes.set(m);
    this.calAnio.set(a);
    this.calDiaExpandido.set(null);
    this.recargarJornadasCalendario();
  }

  mesSiguiente() {
    let m = this.calMes() + 1;
    let a = this.calAnio();
    if (m > 11) {
      m = 0;
      a += 1;
    }
    this.calMes.set(m);
    this.calAnio.set(a);
    this.calDiaExpandido.set(null);
    this.recargarJornadasCalendario();
  }

  irMesHoy() {
    const hoy = new Date();
    this.calMes.set(hoy.getMonth());
    this.calAnio.set(hoy.getFullYear());
    this.calDiaExpandido.set(null);
    this.recargarJornadasCalendario();
  }

  semanaAnterior() {
    const d = new Date(this.semanaInicio());
    d.setDate(d.getDate() - 7);
    this.semanaInicio.set(inicioSemana(d));
  }

  semanaSiguiente() {
    const d = new Date(this.semanaInicio());
    d.setDate(d.getDate() + 7);
    this.semanaInicio.set(inicioSemana(d));
  }

  irSemanaHoy() {
    this.semanaInicio.set(inicioSemana(new Date()));
  }

  jornadasEnDia(key: string): JornadaCapDto[] {
    if (!key) return [];
    return this.jornadasPorDia().get(key) ?? [];
  }

  jornadasEnDiaVisibles(key: string): JornadaCapDto[] {
    const all = this.jornadasEnDia(key);
    if (this.calDiaExpandido() === key) return all;
    return all.slice(0, this.calMaxEventosDia);
  }

  jornadasEnDiaOcultas(key: string): number {
    const all = this.jornadasEnDia(key);
    if (this.calDiaExpandido() === key) return 0;
    return Math.max(0, all.length - this.calMaxEventosDia);
  }

  toggleDiaCalExpandido(key: string, ev?: Event) {
    ev?.stopPropagation();
    this.calDiaExpandido.update((k) => (k === key ? null : key));
  }

  conteoClasesDia(key: string): number {
    return (this.clasesPorDiaSemanaFiltradas().get(key) ?? []).length;
  }

  clasesEnDia(key: string): any[] {
    return (this.clasesPorDiaSemanaFiltradas().get(key) ?? []).filter(
      (c) => !layoutHorarioClase(c.horaInicio, c.horaFin).sinHorario,
    );
  }

  layoutClase(c: { horaInicio?: string; horaFin?: string }) {
    return layoutHorarioClase(c.horaInicio, c.horaFin);
  }

  layoutsCalendarioDia(clases: { _id?: string; horaInicio?: string; horaFin?: string }[]) {
    return layoutsCalendarioDiaClase(
      clases.filter((c) => c._id).map((c) => ({ id: c._id!, horaInicio: c.horaInicio, horaFin: c.horaFin })),
    );
  }

  codContratoDe(idContrato?: string): string {
    if (!idContrato) return '';
    return (this.contratos().find((c) => c._id === idContrato)?.codContrato || '').trim();
  }

  chipJornadaCal(j: JornadaCapDto): string {
    const cod = this.codContratoDe(j.idContrato);
    const m = (j.municipio || '').trim();
    const idx = j.indiceEnDia && j.indiceEnDia > 1 ? ` #${j.indiceEnDia}` : '';
    if (cod && m) return `${cod} · ${m}${idx}`;
    return cod || m || 'Jornada' + idx;
  }

  chipClaseCal(c: any): string {
    const prog = this.nombrePrograma(c.idPrograma);
    const inst = this.labelInstructorClase(c);
    const base = c.ubicacion ? `${prog} · ${c.ubicacion}` : prog;
    return inst && inst !== '—' ? `${base} · ${inst}` : base;
  }

  chipClaseCalCorto(c: any): string {
    const prog = this.nombrePrograma(c.idPrograma);
    return c.ubicacion ? `${prog} · ${c.ubicacion}` : prog;
  }

  fmtDiaCal(fecha: Date): string {
    return fmtDiaSemanaCorto(fecha);
  }

  semanaContiene(fechaIso?: string): boolean {
    if (!fechaIso) return false;
    const d = new Date(fechaIso);
    const ini = this.semanaInicio();
    const fin = finSemana(ini);
    return d >= ini && d <= fin;
  }

  private autoSeleccionarJornadaHoy() {
    if (this.tab() !== 'clases') return;
    const ops = this.jornadasOperablesHoy();
    const actual = this.jornadaSel();
    if (ops.length === 1) {
      if (actual !== ops[0]._id) {
        this.jornadaSel.set(ops[0]._id);
        this.recargarClases();
      }
      return;
    }
    if (!ops.some((j) => j._id === actual)) {
      this.jornadaSel.set('');
      this.claseSel.set('');
      this.claseActiva.set(null);
      this.clases.set([]);
    }
  }

  onContratoSelChange(id: string) {
    this.contratoSel.set(id);
    const c = this.contratos().find((x) => x._id === id);
    if (c) this.editarContrato(c);
    this.jornadaSel.set('');
    this.claseSel.set('');
    this.claseActiva.set(null);
    this.recargarVistaJornadas();
    if (this.tab() === 'clases') {
      this.cargarProgramasJornada();
      this.cargarInstructores();
      this.recargarClases();
    }
    this.consultarProgresoPreview(this.numDocAsis());
    if (this.tab() === 'certificados') this.recargarCerts();
  }

  onContratoToolbarPick(opt: EnumBuscarOption): void {
    this.onContratoSelChange(String(opt.value));
  }

  onContratoToolbarLimpiar(): void {
    this.onContratoSelChange('');
  }

  onJornadaSelChange(id: string) {
    this.jornadaSel.set(id);
    this.claseSel.set('');
    this.claseActiva.set(null);
    this.recargarClases();
  }

  onJornadaToolbarPick(opt: EnumBuscarOption): void {
    this.onJornadaSelChange(String(opt.value));
  }

  onJornadaToolbarLimpiar(): void {
    this.onJornadaSelChange('');
  }

  patchContrato(k: keyof ContratacionDto, v: unknown) {
    this.formContrato.update((f) => ({ ...f, [k]: v }));
  }

  jornadaSeleccionadaOperable(): boolean {
    const j = this.jornadas().find((x) => x._id === this.jornadaSel());
    return j?.estado === 'EN PROCESO';
  }

  /** ¿La clase seleccionada pertenece a una jornada EN PROCESO operable? */
  claseSeleccionadaOperable(): boolean {
    const cl = this.claseActiva();
    if (!cl) return false;
    if (cl.jornadaEstado === 'EN PROCESO') return true;
    const j = this.jornadas().find((x) => x._id === cl.idJornada);
    return j?.estado === 'EN PROCESO';
  }

  abrirJornadaEnClases(j: any) {
    if (j.estado !== 'EN PROCESO') {
      this.mostrarMsg('Solo puede operar clases el día programado (estado EN PROCESO).', 'warn', 'Jornada no operable');
      return;
    }
    this.jornadaSel.set(j._id);
    this.setTab('clases');
  }

  recargarClases() {
    const idJ = this.jornadaSel();
    const idC = this.contratoSel();
    const opts = idJ ? { idJornada: idJ } : idC ? { idContrato: idC } : {};
    this.jornadaSvc.listarClases(opts).subscribe({
      next: (r) => {
        this.clases.set(this.filtrarClasesAdmin(r || []));
        this.liveSync.marcarClasesConocidas((r || []).map((c) => c._id));
        this.liveSync.sincronizarEstadosClases(r || []);
        const clasePend = this.clasePendienteQp();
        if (clasePend) {
          const cEdit = (r || []).find((x: any) => x._id === clasePend);
          if (cEdit) {
            this.abrirModalEditarClase(cEdit);
          }
          this.clasePendienteQp.set(null);
          return;
        }
        const act = this.claseSel();
        if (act) {
          const c = (r || []).find((x: any) => x._id === act);
          this.claseActiva.set(c || null);
          if (c) this.cargarAsistencias(c._id);
        }
      },
    });
  }

  private filtrarClasesAdmin(rows: any[]): any[] {
    const est = this.filtroAdminEstado();
    if (!est) return rows;
    return rows.filter((c) => String(c.estado || '').toUpperCase() === est.toUpperCase());
  }

  setModoClases(modo: 'operar' | 'admin') {
    if (modo === 'admin' && !this.puedeAsignarInstructor()) return;
    this.modoClases.set(modo);
    this.claseSel.set('');
    this.claseActiva.set(null);
    this.claseEditando.set(false);
    if (modo === 'admin') {
      this.vistaClases.set('lista');
      if (!this.contratos().length) this.recargarContratos();
      this.cargarProgramasJornada();
      this.cargarInstructores();
    }
    this.recargarClases();
  }

  labelContratoCortoClase(c: any): string {
    const id = c?.idContrato || this.jornadas().find((x) => x._id === c?.idJornada)?.idContrato;
    return this.labelContratoCorto(id);
  }

  onFiltroAdminEstadoChange(est: string) {
    this.filtroAdminEstado.set(est);
    this.recargarClases();
  }

  labelClienteContrato(c: ContratacionDto): string {
    const nom = (c.clienteNombre || c.nombreComercial || c.razoSocial || '').trim();
    const id = (c.clienteIdentificacion || c.numeroIdentificacion || '').trim();
    if (nom && id) return `${nom} (${id})`;
    return nom || id || '—';
  }

  labelContratoCorto(idContrato?: string): string {
    if (!idContrato) return '—';
    const c = this.contratos().find((x) => x._id === idContrato);
    if (!c) return '—';
    return (c.codContrato || c.clienteNombre || c.nombreComercial || c.razoSocial || '').trim() || '—';
  }

  labelContratoDeJornada(idJornada?: string): string {
    if (!idJornada) return '—';
    const j = this.jornadas().find((x) => x._id === idJornada);
    return j ? this.labelContratoCorto(j.idContrato) : '—';
  }

  guardarClaseConMatriculas() {
    const idJ = this.modalCrearJornadaId() || this.jornadaSel();
    const idP = this.nuevaClaseProg();
    if (!idJ) {
      this.mostrarMsg('Seleccione la jornada del día (EN PROCESO) en el formulario.', 'warn', 'Falta jornada');
      return;
    }
    if (!idP) {
      this.mostrarMsg('Seleccione el programa de capacitación para la nueva clase.', 'warn', 'Falta programa');
      return;
    }
    this.guardandoClase.set(true);
    this.jornadaSvc
      .crearClase({
        idJornada: idJ,
        idPrograma: idP,
        ubicacion: this.nuevaClaseUbic(),
        ...(this.puedeAsignarInstructor() && this.modalClaseInstructorId()
          ? { idEmpleadoInstructor: Number(this.modalClaseInstructorId()) }
          : {}),
      })
      .pipe(
        switchMap((c) =>
          this.matricularAlumnosEnPrograma(idP, this.alumnosMatricular(), c._id).pipe(
            map((matResults) => ({ c, matResults })),
          ),
        ),
        finalize(() => this.guardandoClase.set(false)),
      )
      .subscribe({
        next: ({ c, matResults }) => {
          this.modalModoClase.set('editar');
          this.modalCrearClase.set(true);
          this.claseSel.set(c._id);
          this.claseActiva.set(c);
          this.alumnosMatricular.set([]);
          this.cargarInscritos(c._id);
          this.iniciarCronometroSiAplica();
          this.recargarClases();
          this.liveSync.registrarClaseLocal(c);
          this.liveSync.mostrarToastClase(c as unknown as Record<string, unknown>);
          const ok = matResults.filter((r) => r.ok).length;
          const fail = matResults.filter((r) => !r.ok);
          let texto = 'Clase creada. Pulse ▶ Iniciar clase cuando la jornada esté EN PROCESO.';
          if (matResults.length) {
            texto += ` Inscritos: ${ok}/${matResults.length}.`;
            if (fail.length) {
              texto += ` No inscritos: ${fail.map((f) => f.nombre).join(', ')}.`;
            }
          }
          this.mostrarMsg(texto, fail.length ? 'warn' : 'ok', 'Clase creada');
        },
        error: (e) =>
          this.mostrarMsg(e?.error?.message || 'No se pudo crear la clase.', 'error', 'Error'),
      });
  }

  private matricularAlumnosEnPrograma(idPrograma: string, alumnos: AlumnoListItem[], idClase?: string) {
    if (!alumnos.length) return of([]);
    return forkJoin(
      alumnos.map((a) =>
        this.jornadaSvc.matricularAlumno({ numDoc: a.numDoc, idPrograma, idClase }).pipe(
          map(() => ({ ok: true as const, nombre: this.nombreAlumnoItem(a) })),
          catchError((e) =>
            of({
              ok: false as const,
              nombre: this.nombreAlumnoItem(a),
              error: e?.error?.message || 'Error al matricular',
            }),
          ),
        ),
      ),
    );
  }

  seleccionarClase(c: any) {
    this.claseSel.set(c._id);
    this.claseActiva.set(c);
    this.claseEditando.set(false);
    this.cargarAsistencias(c._id);
    this.consultarProgresoPreview(this.numDocAsis());
  }

  seleccionarClaseCalendario(c: any) {
    this.seleccionarClase(c);
    queueMicrotask(() => {
      document.getElementById('clase-panel-ops')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  abrirJornadaCalendario(j: JornadaCapDto) {
    if (j.idContrato && j.idContrato !== this.contratoSel()) {
      this.onContratoSelChange(j.idContrato);
    }
    this.editarJornada(j);
    queueMicrotask(() => {
      document.getElementById('jornada-edit-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  labelContrato(c: ContratacionDto): string {
    const cod = (c.codContrato || '').trim();
    const nom = (c.clienteNombre || c.nombreComercial || c.razoSocial || '').trim();
    if (cod && nom) return `${cod} — ${nom}`;
    return cod || nom || '—';
  }

  labelJornada(j: { fechaProgramacion?: string; indiceEnDia?: number; municipio?: string }) {
    const f = this.fmtFecha(j.fechaProgramacion);
    const idx = j.indiceEnDia && j.indiceEnDia > 1 ? ` #${j.indiceEnDia}` : '';
    const m = j.municipio ? ` · ${j.municipio}` : '';
    return `${f}${idx}${m}`;
  }

  subtituloModalClase(): string {
    const id = this.modalCrearJornadaId();
    if (!id) return 'Seleccione la jornada EN PROCESO de hoy';
    const j =
      this.jornadasParaCrear().find((x) => x._id === id) ||
      this.jornadas().find((x) => x._id === id);
    return j ? this.labelJornada(j) : 'Jornada seleccionada';
  }

  editarJornada(j: JornadaCapDto, ev?: Event) {
    ev?.stopPropagation();
    ev?.preventDefault();
    this.jornadaEditError.set(null);
    this.direccionAlertaActiva.set(false);
    this.jornadaEdit.set({ ...j });
    this.jornadaEditLat.set(j.lat != null ? String(j.lat) : '');
    this.jornadaEditLng.set(j.lng != null ? String(j.lng) : '');
    this.jornadaEditDeteGeorefe.set((j.deteGeorefe as DeteGeorefe) || '');
    this.jornadaEditDireccion.set(j.direccion || '');
    this.jornadaEditMunicipio.set(j.municipio || '');
    this.jornadaEditDepto.set(j.depto || '');
    this.jornadaEditCodMunicipio.set(j.codMunicipio || '');
    this.cargarTextoMunicipioJornada(j);
    this.jornadaEditSupervisor.set(j.supervisor || '');
    const supMatch = this.supervisores().find(
      (s) => s.nombre.trim().toLowerCase() === String(j.supervisor || '').trim().toLowerCase(),
    );
    this.jornadaEditIdSupervisor.set(supMatch?._id || '');
    this.supNuevoNombreJornada.set('');
    this.jornadaEditFecha.set(j.fechaProgramacion ? ymdCalendario(j.fechaProgramacion) : '');
    this.jornadaEditMapaAbierto.set(false);
    this.mostrarMsg(`Editando ${this.labelJornada(j)} — complete dirección y ubicación.`, 'info', 'Edición de jornada');
    if (j.lat != null && j.lng != null) {
      this.resolverMunicipioDesdeCoords(j.lat, j.lng);
    }
    queueMicrotask(() => {
      document.getElementById('jornada-edit-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  cancelarEdicionJornada() {
    this.cerrarEdicionJornada();
    this.mostrarMsg('Los cambios de la jornada no se guardaron.', 'info', 'Edición cancelada');
    this.scrollAListadoJornadas();
  }

  private cerrarEdicionJornada(): void {
    if (this.georefDebounce) {
      clearTimeout(this.georefDebounce);
      this.georefDebounce = null;
    }
    this.georefLoading.set(false);
    this.jornadaEdit.set(null);
    this.jornadaEditLat.set('');
    this.jornadaEditLng.set('');
    this.jornadaEditDeteGeorefe.set('');
    this.jornadaEditDireccion.set('');
    this.jornadaEditMunicipio.set('');
    this.jornadaEditDepto.set('');
    this.jornadaEditCodMunicipio.set('');
    this.jornadaEditMunicipioTexto.set('');
    this.jornadaEditSupervisor.set('');
    this.jornadaEditIdSupervisor.set('');
    this.supNuevoNombreJornada.set('');
    this.jornadaEditFecha.set('');
    this.jornadaEditMapaAbierto.set(false);
    this.direccionAlertaActiva.set(false);
    this.jornadaEditError.set(null);
  }

  onDireccionJornadaChange(valor: string) {
    this.jornadaEditDireccion.set(valor);
    if (valor.trim()) {
      this.direccionAlertaActiva.set(false);
      if (this.jornadaEditError() === 'La dirección es obligatoria. Complete el campo Dirección antes de guardar.') {
        this.jornadaEditError.set(null);
      }
    }
  }

  private alertaDireccionObligatoria(): void {
    const texto = 'La dirección es obligatoria. Complete el campo Dirección antes de guardar.';
    this.jornadaEditError.set(texto);
    this.direccionAlertaActiva.set(true);
    this.mostrarMsg(texto, 'error', 'Dirección obligatoria');
    queueMicrotask(() => {
      document.getElementById('jornada-edit-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const input = document.getElementById('jornada-edit-direccion') as HTMLInputElement | null;
      input?.focus();
    });
  }

  private scrollAListadoJornadas(): void {
    queueMicrotask(() => {
      document.getElementById('jornadas-listado')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  mostrarMsg(texto: string, tipo: JorMsgTipo = 'info', titulo?: string) {
    this.msg.set(texto);
    this.msgTipo.set(tipo);
    this.msgTitulo.set(titulo ?? tituloJorMsg(tipo));
    this.msgEsError.set(tipo === 'error');
  }

  cerrarMsg() {
    this.msg.set(null);
    this.msgTitulo.set('');
    this.msgEsError.set(false);
  }

  guardarEdicionJornada(ev?: Event) {
    ev?.stopPropagation();
    ev?.preventDefault();
    this.jornadaEditError.set(null);
    this.direccionAlertaActiva.set(false);
    const j = this.jornadaEdit();
    if (!j?._id) {
      this.jornadaEditError.set('No hay jornada seleccionada para guardar.');
      return;
    }
    const direccion = this.jornadaEditDireccion().trim();
    if (!direccion) {
      this.alertaDireccionObligatoria();
      return;
    }
    const lat = this.parseCoordInput(this.jornadaEditLat());
    const lng = this.parseCoordInput(this.jornadaEditLng());
    let deteGeorefe = this.jornadaEditDeteGeorefe();
    if (lat != null && lng != null && !deteGeorefe) {
      deteGeorefe = 'MANUAL';
    }
    if (lat == null || lng == null) {
      deteGeorefe = '';
    }
    const codMuni = this.jornadaEditCodMunicipio().trim();
    const fechaProg = this.jornadaEditFecha().trim();
    if (!fechaProg) {
      this.jornadaEditError.set('La fecha de programación es obligatoria.');
      return;
    }
    this.loading.set(true);
    this.jornadaSvc
      .actualizarJornada(j._id, {
        fechaProgramacion: fechaProg,
        lat,
        lng,
        deteGeorefe: deteGeorefe || '',
        direccion,
        municipio: this.jornadaEditMunicipio().trim(),
        depto: this.jornadaEditDepto().trim(),
        codMunicipio: codMuni && codMuni !== '—' ? codMuni : '',
        supervisor: this.jornadaEditSupervisor().trim(),
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.cerrarEdicionJornada();
          this.recargarVistaJornadas();
          this.mostrarMsg('Ubicación y datos de la jornada actualizados.', 'ok', 'Jornada guardada');
          this.scrollAListadoJornadas();
        },
        error: (e) => {
          const texto =
            e?.error?.message ||
            (typeof e?.error === 'string' ? e.error : null) ||
            e?.message ||
            'Error al guardar jornada';
          this.jornadaEditError.set(texto);
          this.mostrarMsg(texto, 'error', 'No se guardó la jornada');
          document.getElementById('jornada-edit-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
      });
  }

  async eliminarJornada(j: JornadaCapDto, ev?: Event) {
    ev?.stopPropagation();
    ev?.preventDefault();
    const ok = await this.confirmSvc.open({
      title: 'Eliminar jornada',
      message: `¿Eliminar la jornada ${this.labelJornada(j)}? También se borran sus clases sin asistencias. Luego puede usar «Generar faltantes».`,
      variant: 'danger',
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    this.jornadaSvc.eliminarJornada(j._id).subscribe({
      next: (r) => {
        if (this.jornadaEdit()?._id === j._id) this.cerrarEdicionJornada();
        if (this.jornadaSel() === j._id) {
          this.jornadaSel.set('');
          this.claseSel.set('');
          this.claseActiva.set(null);
        }
        this.recargarVistaJornadas();
        this.recargarClases();
        this.mostrarMsg(
          r.message || `Jornada eliminada. Quedan ${r.restantes ?? 0} en el contrato.`,
          'ok',
          'Jornada eliminada',
        );
      },
      error: (e) => this.mostrarMsg(e?.error?.message || 'No se pudo eliminar la jornada.', 'error', 'Error'),
    });
  }

  jornadaEnEdicion(id?: string): boolean {
    return !!id && this.jornadaEdit()?._id === id;
  }

  parseCoordInput(raw: string): number | null {
    const t = raw.trim().replace(',', '.');
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  jornadaEditLatNum(): number | null {
    return this.parseCoordInput(this.jornadaEditLat());
  }

  jornadaEditLngNum(): number | null {
    return this.parseCoordInput(this.jornadaEditLng());
  }

  toggleMapaJornadaEdit(): void {
    this.jornadaEditMapaAbierto.update((v) => !v);
  }

  onMapaCoords(ev: CoordsGeorefEvent): void {
    this.jornadaEditLat.set(String(Math.round(ev.lat * 1e6) / 1e6));
    this.jornadaEditLng.set(String(Math.round(ev.lng * 1e6) / 1e6));
    this.jornadaEditDeteGeorefe.set(ev.deteGeorefe);
    this.resolverMunicipioDesdeCoords(ev.lat, ev.lng);
  }

  onCoordsManualChange(): void {
    const lat = this.parseCoordInput(this.jornadaEditLat());
    const lng = this.parseCoordInput(this.jornadaEditLng());
    if (lat == null || lng == null) {
      this.jornadaEditDeteGeorefe.set('');
      this.jornadaEditMunicipio.set('');
      this.jornadaEditDepto.set('');
      this.jornadaEditCodMunicipio.set('');
      this.jornadaEditMunicipioTexto.set('');
      return;
    }
    if (this.jornadaEditDeteGeorefe() !== 'MAPA' && this.jornadaEditDeteGeorefe() !== 'DISPOSITIVO_MOVIL') {
      this.jornadaEditDeteGeorefe.set('MANUAL');
    }
    this.resolverMunicipioDesdeCoords(lat, lng, 600);
  }

  private resolverMunicipioDesdeCoords(lat: number, lng: number, delayMs = 300): void {
    if (this.georefDebounce) clearTimeout(this.georefDebounce);
    this.georefDebounce = setTimeout(() => {
      this.georefDebounce = null;
      this.georefLoading.set(true);
      this.jornadaSvc.resolverMunicipioGeoref(lat, lng).subscribe({
        next: (geo) => {
          this.georefLoading.set(false);
          if (geo.municipio) this.jornadaEditMunicipio.set(geo.municipio);
          if (geo.depto) this.jornadaEditDepto.set(geo.depto);
          if (geo.codMunicipio) {
            this.jornadaEditCodMunicipio.set(geo.codMunicipio);
            this.catSvc.municipioPorCodigo(geo.codMunicipio).subscribe({
              next: (m) => this.jornadaEditMunicipioTexto.set(m.label),
              error: () => {
                this.jornadaEditMunicipioTexto.set(
                  geo.municipio && geo.depto ? `${geo.municipio} - ${geo.depto}` : geo.municipio || '',
                );
              },
            });
          } else if (geo.municipio) {
            this.jornadaEditMunicipioTexto.set(
              geo.depto ? `${geo.municipio} - ${geo.depto}` : geo.municipio,
            );
            this.jornadaEditCodMunicipio.set('');
          }
        },
        error: () => {
          this.georefLoading.set(false);
        },
      });
    }, delayMs);
  }

  nombrePrograma(idProg: string): string {
    const p = this.buscarProgramaEnLista(idProg);
    if (p) return String(p.nombreProg || p.codigoProg || idProg);
    return String(idProg);
  }

  iniciarEdicionClase(c: any) {
    this.claseSel.set(c._id);
    this.claseActiva.set(c);
    this.claseEditando.set(true);
    this.claseEditProg.set(String(c.idPrograma || ''));
    this.claseEditUbic.set(c.ubicacion || 'Carpa');
    this.claseEditInstructorId.set(c.idEmpleadoInstructor ?? '');
  }

  cancelarEdicionClase() {
    this.claseEditando.set(false);
  }

  guardarEdicionClase() {
    const id = this.claseSel();
    if (!id) return;
    const dto: { idPrograma?: string; ubicacion?: string; idEmpleadoInstructor?: number } = {
      idPrograma: this.claseEditProg(),
      ubicacion: this.claseEditUbic(),
    };
    if (this.puedeAsignarInstructor() && this.claseEditInstructorId()) {
      dto.idEmpleadoInstructor = Number(this.claseEditInstructorId());
    }
    this.jornadaSvc
      .actualizarClase(id, dto)
      .subscribe({
        next: (c) => {
          this.claseEditando.set(false);
          this.claseActiva.set(c);
          this.recargarClases();
          this.mostrarMsg('Programa, ubicación e instructor actualizados.', 'ok', 'Clase actualizada');
        },
        error: (e) => this.mostrarMsg(e?.error?.message || 'No se pudo crear la clase.', 'error', 'Error'),
      });
  }

  async eliminarClase(c: { _id: string; estado?: string }) {
    if (!this.puedeEliminarClase()) {
      this.mostrarMsg('Solo un administrador puede eliminar clases.', 'warn', 'Sin permiso');
      return;
    }
    if (!claseJornadaSePuedeEliminar(c.estado)) {
      this.mostrarMsg(
        'No se puede eliminar una clase finalizada. Conserva historial, asistencias y certificados.',
        'warn',
        'Clase finalizada',
      );
      return;
    }
    const ok = await this.confirmSvc.open({
      title: 'Eliminar clase',
      message:
        '¿Eliminar esta clase? También se borrarán las inscripciones y asistencias registradas (si las hay).',
      variant: 'danger',
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    this.jornadaSvc.eliminarClase(c._id).subscribe({
      next: () => {
        if (this.claseSel() === c._id) {
          this.claseSel.set('');
          this.claseActiva.set(null);
          this.claseEditando.set(false);
        }
        this.recargarClases();
        this.mostrarMsg('La clase fue eliminada del turno.', 'ok', 'Clase eliminada');
      },
      error: (e) => this.mostrarMsg(e?.error?.message || 'No se pudo eliminar la clase.', 'error', 'Error'),
    });
  }

  onNumDocAsisChange(value: string) {
    this.numDocAsis.set(value);
    this.consultarProgresoPreview(value);
  }

  consultarProgresoPreview(raw: string) {
    if (this.progresoDebounce) clearTimeout(this.progresoDebounce);
    const nd = raw.trim();
    const idContrato = this.contratoSel();
    if (!nd || nd.length < 5 || !idContrato) {
      this.progresoPreview.set(null);
      this.nombreAlumnoPreview.set('');
      this.progresoPreviewLoading.set(false);
      return;
    }
    this.progresoPreviewLoading.set(true);
    this.progresoDebounce = setTimeout(() => {
      this.jornadaSvc.progresoCertificacion(nd, idContrato).subscribe({
        next: (p) => {
          this.progresoPreview.set(p);
          this.progresoPreviewLoading.set(false);
        },
        error: () => {
          this.progresoPreview.set(null);
          this.progresoPreviewLoading.set(false);
        },
      });
      this.jornadaSvc.buscarAlumnoDoc(nd).subscribe({
        next: (a: any) => {
          const nom = [a.nombre1, a.nombre2].filter(Boolean).join(' ').trim() || String(a.nombres || '').trim();
          const ap = [a.apellido1, a.apellido2].filter(Boolean).join(' ').trim() || String(a.apellidos || '').trim();
          this.nombreAlumnoPreview.set(`${nom} ${ap}`.trim() || a.nombreCompleto || '');
        },
        error: () => this.nombreAlumnoPreview.set(''),
      });
    }, 400);
  }

  cargarAsistencias(idClase: string) {
    this.jornadaSvc.listarAsistencias(idClase).subscribe({
      next: (r) => this.asistencias.set(r || []),
    });
  }

  iniciarClase() {
    const id = this.claseSel();
    if (!id) return;
    this.jornadaSvc.iniciarClase(id).subscribe({
      next: (c) => {
        this.claseActiva.set(c);
        this.recargarClases();
        this.liveSync.notificarClaseIniciada(c as unknown as Record<string, unknown>);
      },
    });
  }

  finalizarClase() {
    const id = this.claseSel();
    if (!id) return;
    this.jornadaSvc.finalizarClase(id).subscribe({
      next: (r: any) => {
        const c = r?.clase || { ...this.claseActiva(), estado: 'FINALIZADO' };
        this.claseActiva.set(c);
        this.recargarClases();
        this.liveSync.notificarClaseFinalizada(c as unknown as Record<string, unknown>);
        if (r?.certificadosGenerados > 0) {
          this.certAlertSvc.notificarVariosDesdeRespuesta(r?.certificadosEmitidos);
        }
        let msg = 'La clase quedó cerrada. Ya no admite nuevas asistencias.';
        if (r?.certificadosGenerados > 0) {
          msg += ` Certificados emitidos: ${r.certificadosGenerados}.`;
        }
        this.mostrarMsg(msg, r?.certificadosGenerados > 0 ? 'ok' : 'info', 'Clase finalizada');
      },
    });
  }

  marcarAsistencia() {
    const id = this.claseSel();
    const nd = this.numDocAsis().trim();
    if (!id || !nd) return;
    const p = this.progresoPreview();
    if (p?.certificado) {
      void this.certBloqueoSvc.mostrarAlumnoCertificado({
        nombreAlumno: this.nombreAlumnoPreview() || nd,
        certificado: p.certificado,
      });
      return;
    }
    this.jornadaSvc.registrarAsistencia(id, nd).subscribe({
      next: (r: any) => {
        this.numDocAsis.set('');
        this.progresoPreview.set(null);
        this.nombreAlumnoPreview.set('');
        this.cargarAsistencias(id);
        this.mostrarResultadoAsistencia(r);
      },
      error: (e) => {
        const body = e?.error;
        if (e?.status === 409 && body?.codigo === 'ya_certificado_contrato') {
          const nombre = this.nombreAlumnoPreview() || nd;
          void this.certBloqueoSvc.mostrarDesdeError(body, nombre);
          return;
        }
        if (e?.status === 409 && body?.sesiones != null) {
          this.mostrarResultadoAsistencia(body);
          return;
        }
        this.mostrarMsg(body?.message || 'No se pudo registrar la asistencia.', 'error', 'Error');
      },
    });
  }

  private mostrarResultadoAsistencia(r: any) {
    const ses = r.sesiones ?? 0;
    const req = r.numSesCert ?? this.contratoActivo()?.numSesCert ?? '?';
    if (r.certificadoGenerado && r.certificado) {
      this.certAlertSvc.notificarDesdeRespuesta(r.certificado, r.nombreAlumno);
      this.recargarCerts();
      this.mostrarMsg(
        `Certificado automático emitido (${ses}/${req} sesiones). Código: ${r.certificado.codigoCert || '—'}`,
        'ok',
        'Certificado emitido',
      );
      this.recargarCerts();
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

  irInstructor() {
    const q: Record<string, string> = {};
    if (this.jornadaSel()) q['jornada'] = this.jornadaSel();
    const j = this.jornadas().find((x) => x._id === this.jornadaSel());
    if (j?.fechaProgramacion) q['fecha'] = String(j.fechaProgramacion).slice(0, 10);
    void this.router.navigate(['/app/jornadas/instructor'], { queryParams: q });
  }

  recargarCerts() {
    const id = this.contratoSel();
    this.jornadaSvc.certificadosGenerados(id || undefined).subscribe({
      next: (r) => this.certsGenerados.set(r || []),
    });
  }

  imprimirCert(c: { _id: string }) {
    this.jornadaSvc.imprimirCertificadoJornada(c._id, (m) => this.mostrarMsg(m, 'info', 'Certificado'));
  }

  nuevoAlumnoJornada() {
    void this.router.navigate(['/app/jornadas/alumnos/nuevo']);
  }

  listaAlumnosJornada() {
    void this.router.navigate(['/app/jornadas/alumnos']);
  }

  fmtFecha(f?: string | Date) {
    return fmtFechaCalendario(f);
  }

  fmtHora(f?: string) {
    if (!f) return '—';
    return new Date(f).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }
}
