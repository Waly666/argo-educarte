import { CommonModule } from '@angular/common';
import { ArgoDateInputComponent } from '../../shared/argo-date-input/argo-date-input.component';
import { Component, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ClaseInstructorPortalDto,
  InstructorPortalService,
  labelOrigenClaseInstructor,
  labelTipoClaseInstructor,
} from '../../core/services/instructor-portal.service';
import {
  ProgramaCeaDto,
  ProgramacionCeaService,
  labelTipoClaseCea,
} from '../../core/services/programacion-cea.service';
import { PermisoService } from '../../core/services/permiso.service';
import {
  DIAS_SEMANA_CORTO,
  agruparPorFecha,
  ahoraLineaTopPct,
  celdasMes,
  esFinDeSemana,
  finSemana,
  fmtDiaSemanaCorto,
  fmtFechaCalendario,
  fmtMesAnio,
  fmtRangoSemana,
  horasSlots,
  inicioSemana,
  layoutHorarioHHmm,
  layoutsCalendarioDiaHHmm,
  rangoVisibleMes,
  ymdCalendario,
  ymdLocal,
  type CeldaMes,
  type DiaSemana,
} from '../jornadas/jornada-calendario.util';
import {
  estadoClaseCalAccentClass,
  estadoClaseLiveClass,
  rowClaseClass,
  tipoClaseCalBlockClass,
} from '../jornadas/jornada-ui.util';
import { ProgramacionCeaClasesComponent } from '../programacion-cea/programacion-cea-clases.component';
import { JornadaClaseEditorComponent } from '../jornadas/jornada-clase-editor.component';

type VistaMisClases = 'calendario' | 'lista';
const CAL_MAX_EVENTOS_DIA = 4;

@Component({
  selector: 'argo-instructor-portal-mis-clases',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgramacionCeaClasesComponent, JornadaClaseEditorComponent,
    ArgoDateInputComponent,
  ],
  templateUrl: './instructor-portal-mis-clases.component.html',
  styleUrls: [
    './instructor-portal-mis-clases.component.scss',
    '../programacion-cea/programacion-cea-clases-hoy.component.scss',
  ],
})
export class InstructorPortalMisClasesComponent implements OnInit, OnDestroy {
  @ViewChild('claseEditor') claseEditor?: ProgramacionCeaClasesComponent;
  @ViewChild('jornadaEditor') jornadaEditor?: JornadaClaseEditorComponent;

  private portalSvc = inject(InstructorPortalService);
  private ceaSvc = inject(ProgramacionCeaService);
  private permisos = inject(PermisoService);

  vista = signal<VistaMisClases>('calendario');
  fechaSel = signal(ymdLocal(new Date()));
  mesFiltro = signal(new Date().toISOString().slice(0, 7));
  semanaInicio = signal(inicioSemana(new Date()));
  calDiaExpandido = signal<string | null>(null);
  query = signal('');

  loading = signal(false);
  loadingCal = signal(false);
  error = signal<string | null>(null);
  msg = signal<string | null>(null);

  clases = signal<ClaseInstructorPortalDto[]>([]);
  programas = signal<ProgramaCeaDto[]>([]);

  readonly calMaxEventosDia = CAL_MAX_EVENTOS_DIA;
  readonly diasSemanaLabels = DIAS_SEMANA_CORTO;
  readonly horasCal = horasSlots();
  readonly labelOrigen = labelOrigenClaseInstructor;
  readonly labelTipo = labelTipoClaseInstructor;
  readonly ymdCalendario = ymdCalendario;
  readonly fmtFechaCalendario = fmtFechaCalendario;
  readonly esFinDeSemana = esFinDeSemana;
  readonly estadoClaseLiveClass = estadoClaseLiveClass;
  readonly rowClaseClass = rowClaseClass;
  readonly estadoClaseCalAccentClass = estadoClaseCalAccentClass;

  hoyKey = computed(() => ymdLocal(new Date()));
  fechaLabel = computed(() => fmtFechaCalendario(this.fechaSel()));
  esHoySel = computed(() => this.fechaSel() === this.hoyKey());

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
  tituloSemanaCal = computed(() => fmtRangoSemana(this.semanaInicio()));
  diasSemanaCal = computed((): DiaSemana[] => {
    const ini = this.semanaInicio();
    return Array.from({ length: 7 }, (_, i) => {
      const f = new Date(ini);
      f.setDate(f.getDate() + i);
      return { fecha: f, key: ymdLocal(f) };
    });
  });
  semanaIncluyeHoy = computed(() => this.diasSemanaCal().some((d) => d.key === this.hoyKey()));
  ahoraCalTopPct = computed(() => {
    this.diasSemanaCal();
    return ahoraLineaTopPct(new Date());
  });

  puedeOperarCea = computed(() =>
    this.permisos.tiene(['programacion_cea.operar', 'programacion_cea.gestionar']),
  );
  puedeOperarJornada = computed(() =>
    this.permisos.tiene(['jornadas.operar', 'jornadas.gestionar']),
  );

  filtradas = computed(() => this.filtrarClases(this.clasesDelDia()));
  filtradasSemana = computed(() => this.filtrarClases(this.clasesSemanaLista()));

  clasesPorDiaMes = computed(() =>
    agruparPorFecha(this.filtrarClases(this.clases()), (c) => ymdCalendario(c.fechaClase)),
  );
  clasesPorDiaSemana = computed(() =>
    agruparPorFecha(this.filtradasSemana(), (c) => ymdCalendario(c.fechaClase)),
  );

  clasesSemanaResumen = computed(() => {
    const items = this.filtradasSemana();
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

  clasesSinHorarioSemana = computed(() => {
    const keys = new Set(this.diasSemanaCal().map((d) => d.key));
    return this.filtradasSemana().filter((c) => {
      if (!keys.has(ymdCalendario(c.fechaClase))) return false;
      return layoutHorarioHHmm(c.horaDesde, c.horaHasta).sinHorario;
    });
  });

  enProcesoCount = computed(() => this.filtradas().filter((c) => c.estado === 'EN PROCESO').length);
  programadasCount = computed(() => this.filtradas().filter((c) => c.estado === 'PROGRAMADA').length);
  finalizadasCount = computed(() => this.filtradas().filter((c) => c.estado === 'FINALIZADO').length);

  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.ceaSvc.programas().subscribe({
      next: (p) => this.programas.set(p || []),
      error: () => this.programas.set([]),
    });
    this.cargarTodo();
    this.refreshTimer = setInterval(() => this.cargarTodo(true), 30_000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  setVista(v: VistaMisClases): void {
    this.vista.set(v);
  }

  onFechaChange(fecha: string): void {
    const f = String(fecha || '').trim();
    if (!f) return;
    this.fechaSel.set(f);
    this.mesFiltro.set(f.slice(0, 7));
    this.semanaInicio.set(inicioSemana(new Date(`${f}T12:00:00`)));
    this.calDiaExpandido.set(null);
    this.cargarTodo();
  }

  irHoy(): void {
    this.onFechaChange(this.hoyKey());
  }

  mesAnterior(): void {
    let m = this.calMes();
    let a = this.calAnio();
    m--;
    if (m < 0) {
      m = 11;
      a--;
    }
    this.onMesFiltroChange(`${a}-${String(m + 1).padStart(2, '0')}`);
  }

  mesSiguiente(): void {
    let m = this.calMes();
    let a = this.calAnio();
    m++;
    if (m > 11) {
      m = 0;
      a++;
    }
    this.onMesFiltroChange(`${a}-${String(m + 1).padStart(2, '0')}`);
  }

  irMesHoy(): void {
    this.onMesFiltroChange(new Date().toISOString().slice(0, 7));
  }

  onMesFiltroChange(mes: string): void {
    this.mesFiltro.set(mes);
    this.calDiaExpandido.set(null);
    this.cargarTodo();
  }

  seleccionarDiaMes(key: string): void {
    if (!key) return;
    this.onFechaChange(key);
  }

  semanaAnterior(): void {
    const d = new Date(this.semanaInicio());
    d.setDate(d.getDate() - 7);
    this.semanaInicio.set(inicioSemana(d));
    this.mesFiltro.set(ymdLocal(this.semanaInicio()).slice(0, 7));
    this.cargarTodo();
  }

  semanaSiguiente(): void {
    const d = new Date(this.semanaInicio());
    d.setDate(d.getDate() + 7);
    this.semanaInicio.set(inicioSemana(d));
    this.mesFiltro.set(ymdLocal(this.semanaInicio()).slice(0, 7));
    this.cargarTodo();
  }

  irSemanaHoy(): void {
    this.semanaInicio.set(inicioSemana(new Date()));
    this.mesFiltro.set(this.hoyKey().slice(0, 7));
    this.fechaSel.set(this.hoyKey());
    this.cargarTodo();
  }

  cargarTodo(silencioso = false): void {
    if (!silencioso) this.loading.set(true);
    if (this.vista() === 'calendario') this.loadingCal.set(true);
    const { desde, hasta } = this.rangoCarga();
    this.error.set(null);
    this.portalSvc.misClases({ desde, hasta }).subscribe({
      next: (r) => {
        this.clases.set(r.clases || []);
        this.loading.set(false);
        this.loadingCal.set(false);
      },
      error: (e) => {
        this.clases.set([]);
        this.loading.set(false);
        this.loadingCal.set(false);
        this.error.set(e?.error?.message || 'No se pudieron cargar sus clases.');
      },
    });
  }

  cerrarMsg(): void {
    this.msg.set(null);
  }

  tipoCalBlock(c: ClaseInstructorPortalDto): string {
    if (c.origen === 'jornada') return 'cal-tipo-jornada';
    return tipoClaseCalBlockClass(c.tipoClase);
  }

  labelTipoCal(c: ClaseInstructorPortalDto): string {
    if (c.origen === 'jornada') return 'Jornada carpa';
    return labelTipoClaseCea(c.tipoClase as 'teoria' | 'taller' | 'practica');
  }

  ubicacionClase(c: ClaseInstructorPortalDto): string {
    if (c.origen === 'jornada') return c.temaNombre || 'Carpa';
    if (c.tipoClase === 'teoria') return c.aulaNombre || '—';
    if (c.tipoClase === 'taller') return c.tallerNombre || '—';
    return c.idVehiculo || c.vehiculoLabel || '—';
  }

  chipClaseCal(c: ClaseInstructorPortalDto): string {
    const base = `${this.labelTipoCal(c)} · ${c.programaLabel || c.temaNombre || '—'}`;
    const extra = c.temaNombre && c.programaLabel ? c.temaNombre : this.ubicacionClase(c);
    const mid = extra && extra !== '—' ? `${base} · ${extra}` : base;
    const inst = (c.instructorNombre || '').trim();
    return inst ? `${mid} · ${inst}` : mid;
  }

  chipClaseCalCorto(c: ClaseInstructorPortalDto): string {
    const extra = c.temaNombre || this.ubicacionClase(c);
    return extra && extra !== '—'
      ? `${this.labelTipoCal(c)} · ${extra}`
      : `${this.labelTipoCal(c)} · ${c.programaLabel || '—'}`;
  }

  fmtDiaCal(fecha: Date): string {
    return fmtDiaSemanaCorto(fecha);
  }

  conteoClasesDia(key: string): number {
    return (this.clasesPorDiaSemana().get(key) ?? []).length;
  }

  clasesEnDia(key: string): ClaseInstructorPortalDto[] {
    return (this.clasesPorDiaSemana().get(key) ?? []).filter(
      (c) => !layoutHorarioHHmm(c.horaDesde, c.horaHasta).sinHorario,
    );
  }

  clasesEnDiaMes(key: string): ClaseInstructorPortalDto[] {
    const list = [...(this.clasesPorDiaMes().get(key) ?? [])];
    return list.sort((a, b) => (a.horaDesde || '99:99').localeCompare(b.horaDesde || '99:99'));
  }

  clasesEnDiaMesVisibles(key: string): ClaseInstructorPortalDto[] {
    const all = this.clasesEnDiaMes(key);
    if (this.calDiaExpandido() === key) return all;
    return all.slice(0, CAL_MAX_EVENTOS_DIA);
  }

  clasesEnDiaMesOcultas(key: string): number {
    const all = this.clasesEnDiaMes(key);
    if (this.calDiaExpandido() === key) return 0;
    return Math.max(0, all.length - CAL_MAX_EVENTOS_DIA);
  }

  layoutClase(c: ClaseInstructorPortalDto) {
    return layoutHorarioHHmm(c.horaDesde, c.horaHasta);
  }

  layoutsCalendarioDia(clases: ClaseInstructorPortalDto[]) {
    return layoutsCalendarioDiaHHmm(
      clases.map((c) => ({ id: c._id, horaDesde: c.horaDesde, horaHasta: c.horaHasta })),
    );
  }

  /** Abre editor CEA o jornada carpa en modal embebido. */
  onClaseClick(c: ClaseInstructorPortalDto, ev?: Event): void {
    ev?.stopPropagation();
    if (c.origen === 'jornada') {
      if (!this.puedeOperarJornada()) {
        this.msg.set('No tiene permiso para abrir esta clase de jornada.');
        setTimeout(() => this.msg.set(null), 4000);
        return;
      }
      this.jornadaEditor?.abrirClaseDesdeHost(c._id, c.idJornada ?? undefined);
      return;
    }
    if (!this.puedeOperarCea()) {
      this.msg.set('No tiene permiso para abrir esta clase.');
      setTimeout(() => this.msg.set(null), 4000);
      return;
    }
    this.claseEditor?.abrirClaseDesdeHost(c._id);
  }

  onClaseEditada(): void {
    this.cargarTodo(true);
  }

  private clasesDelDia(): ClaseInstructorPortalDto[] {
    const key = this.fechaSel();
    return this.clases().filter((c) => ymdCalendario(c.fechaClase) === key);
  }

  private clasesSemanaLista(): ClaseInstructorPortalDto[] {
    const ini = ymdLocal(this.semanaInicio());
    const fin = ymdLocal(finSemana(this.semanaInicio()));
    return this.clases().filter((c) => {
      const y = ymdCalendario(c.fechaClase);
      return y >= ini && y <= fin;
    });
  }

  private rangoCarga(): { desde: string; hasta: string } {
    const mes = rangoVisibleMes(this.calAnio(), this.calMes());
    const ini = ymdLocal(this.semanaInicio());
    const fin = ymdLocal(finSemana(this.semanaInicio()));
    return {
      desde: mes.desde < ini ? mes.desde : ini,
      hasta: mes.hasta > fin ? mes.hasta : fin,
    };
  }

  private filtrarClases(rows: ClaseInstructorPortalDto[]): ClaseInstructorPortalDto[] {
    const q = this.query().trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((c) => {
      const campos = [
        c.programaLabel,
        c.temaNombre,
        c.instructorNombre,
        c.aulaNombre,
        c.tallerNombre,
        c.idVehiculo,
        c.tipoClase,
        c.estado,
        c.horaDesde,
        c.horaHasta,
        c.origen,
      ];
      return campos.some((v) => String(v || '').toLowerCase().includes(q));
    });
  }
}
