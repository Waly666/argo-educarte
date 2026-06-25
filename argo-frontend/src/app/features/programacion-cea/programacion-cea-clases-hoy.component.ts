import { CommonModule } from '@angular/common';
import { ArgoDateInputComponent } from '../../shared/argo-date-input/argo-date-input.component';
import { Component, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { PermisoService } from '../../core/services/permiso.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import {
  ClaseProgramadaCeaDto,
  ProgramaCeaDto,
  ProgramacionCeaService,
  labelTipoClaseCea,
} from '../../core/services/programacion-cea.service';
import {
  DIAS_SEMANA_CORTO,
  agruparPorFecha,
  ahoraLineaTopPct,
  celdasMes,
  diasSemana,
  esFinDeSemana,
  esFechaHoy,
  esFechaNoFutura,
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
import {
  chipClaseCal as chipClaseCalTexto,
  chipClaseCalCorto as chipClaseCalCortoTexto,
  horasClaseCalLabel,
} from '../../core/utils/cea-cal-clase.util';
import { ProgramacionCeaClasesComponent } from './programacion-cea-clases.component';

type VistaHoy = 'lista' | 'calendario';
const CAL_MAX_EVENTOS_DIA = 4;

@Component({
  selector: 'argo-programacion-cea-clases-hoy',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ProgramacionCeaClasesComponent,
    ArgoDateInputComponent,
  ],
  templateUrl: './programacion-cea-clases-hoy.component.html',
  styleUrls: ['./programacion-cea-clases-hoy.component.scss'],
})
export class ProgramacionCeaClasesHoyComponent implements OnInit, OnDestroy {
  @ViewChild('claseEditor') claseEditor?: ProgramacionCeaClasesComponent;

  private svc = inject(ProgramacionCeaService);
  private permisos = inject(PermisoService);
  private confirm = inject(ConfirmDialogService);
  private router = inject(Router);

  vista = signal<VistaHoy>('calendario');
  fechaSel = signal(ymdLocal(new Date()));
  mesFiltro = signal(new Date().toISOString().slice(0, 7));
  semanaInicio = signal(inicioSemana(new Date()));
  calDiaExpandido = signal<string | null>(null);

  loading = signal(false);
  loadingCal = signal(false);
  clases = signal<ClaseProgramadaCeaDto[]>([]);
  clasesSemana = signal<ClaseProgramadaCeaDto[]>([]);
  clasesMes = signal<ClaseProgramadaCeaDto[]>([]);
  programas = signal<ProgramaCeaDto[]>([]);
  query = signal('');
  msg = signal<string | null>(null);
  finalizandoId = signal<string | null>(null);

  readonly calMaxEventosDia = CAL_MAX_EVENTOS_DIA;
  readonly diasSemanaLabels = DIAS_SEMANA_CORTO;
  readonly horasCal = horasSlots();

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
  diasSemanaCal = computed((): DiaSemana[] => diasSemana(this.semanaInicio()));
  semanaIncluyeHoy = computed(() => this.diasSemanaCal().some((d) => d.key === this.hoyKey()));
  ahoraCalTopPct = computed(() => {
    this.diasSemanaCal();
    return ahoraLineaTopPct(new Date());
  });

  enProcesoCount = computed(() => this.clases().filter((c) => c.estado === 'EN PROCESO').length);
  programadasCount = computed(() => this.clases().filter((c) => c.estado === 'PROGRAMADA').length);
  finalizadasCount = computed(() => this.clases().filter((c) => c.estado === 'FINALIZADO').length);

  puedeGestionar = computed(() => this.permisos.tiene('programacion_cea.gestionar'));
  esInstructorSolo = computed(
    () => this.permisos.tiene('programacion_cea.operar') && !this.puedeGestionar(),
  );
  puedeOperar = computed(
    () => this.permisos.tiene(['programacion_cea.operar', 'programacion_cea.gestionar']),
  );
  puedeCerrarRetroactivo = computed(() =>
    this.permisos.tiene(['caja.turno', 'caja.admin', 'programacion_cea.gestionar', 'programacion_cea.operar']),
  );
  puedeAbrirClase = computed(
    () => this.puedeGestionar() || this.puedeOperar() || this.puedeCerrarRetroactivo(),
  );

  filtradas = computed(() => this.filtrarClases(this.clases()));
  filtradasSemana = computed(() => this.filtrarClases(this.clasesSemana()));

  clasesPorDiaMes = computed(() =>
    agruparPorFecha(this.filtrarClases(this.clasesMes()), (c) => ymdCalendario(c.fechaClase)),
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

  total = computed(() => this.clases().length);

  labelTipoClase = labelTipoClaseCea;
  estadoClaseLiveClass = estadoClaseLiveClass;
  rowClaseClass = rowClaseClass;
  tipoClaseCalBlockClass = tipoClaseCalBlockClass;
  estadoClaseCalAccentClass = estadoClaseCalAccentClass;
  esFinDeSemana = esFinDeSemana;
  ymdCalendario = ymdCalendario;

  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.svc.programas().subscribe({
      next: (p) => this.programas.set(p || []),
      error: () => this.programas.set([]),
    });
    this.cargarTodo();
    this.refreshTimer = setInterval(() => this.cargarTodo(true), 15_000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  setVista(v: VistaHoy): void {
    this.vista.set(v);
    if (v === 'calendario') this.cargarCalendario(true);
  }

  onFechaChange(fecha: string): void {
    const f = String(fecha || '').trim();
    if (!f) return;
    this.fechaSel.set(f);
    this.mesFiltro.set(f.slice(0, 7));
    this.semanaInicio.set(inicioSemana(new Date(f + 'T12:00:00')));
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
    this.cargarMes();
  }

  seleccionarDiaMes(key: string): void {
    if (!key) return;
    this.onFechaChange(key);
  }

  semanaAnterior(): void {
    const d = new Date(this.semanaInicio());
    d.setDate(d.getDate() - 7);
    this.semanaInicio.set(inicioSemana(d));
    this.cargarSemana(true);
  }

  semanaSiguiente(): void {
    const d = new Date(this.semanaInicio());
    d.setDate(d.getDate() + 7);
    this.semanaInicio.set(inicioSemana(d));
    this.cargarSemana(true);
  }

  irSemanaHoy(): void {
    this.semanaInicio.set(inicioSemana(new Date()));
    this.cargarSemana(true);
  }

  cargarTodo(silencioso = false): void {
    this.cargar(silencioso);
    if (this.vista() === 'calendario') this.cargarCalendario(silencioso);
  }

  cargar(silencioso = false): void {
    if (!silencioso) this.loading.set(true);
    this.svc.listarClasesDelDia(this.fechaSel()).subscribe({
      next: (rows) => {
        this.clases.set(rows || []);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.msg.set(e?.error?.message || 'No se pudieron cargar las clases del día.');
      },
    });
  }

  cargarCalendario(silencioso = false): void {
    this.cargarSemana(silencioso);
    this.cargarMes(silencioso);
  }

  cargarSemana(silencioso = false): void {
    if (!silencioso) this.loadingCal.set(true);
    const ini = this.semanaInicio();
    const fin = finSemana(ini);
    this.svc.listarClases({ desde: ymdLocal(ini), hasta: ymdLocal(fin) }).subscribe({
      next: (rows) => {
        this.clasesSemana.set(rows || []);
        this.loadingCal.set(false);
      },
      error: () => this.loadingCal.set(false),
    });
  }

  cargarMes(silencioso = false): void {
    const [y, m] = this.mesFiltro().split('-').map(Number);
    const { desde, hasta } = rangoVisibleMes(y, (m || 1) - 1);
    this.svc.listarClases({ desde, hasta }).subscribe({
      next: (rows) => this.clasesMes.set(rows || []),
      error: () => {},
    });
  }

  cerrarMsg(): void {
    this.msg.set(null);
  }

  ubicacionClase(c: ClaseProgramadaCeaDto): string {
    if (c.tipoClase === 'teoria') return c.aulaNombre || c.idAula || '—';
    if (c.tipoClase === 'taller') return c.tallerNombre || c.idTaller || '—';
    return c.idVehiculo || '—';
  }

  horasClaseCalLabel = horasClaseCalLabel;

  chipClaseCal(c: ClaseProgramadaCeaDto): string {
    return chipClaseCalTexto(c, (x) => this.ubicacionClase(x));
  }

  chipClaseCalCorto(c: ClaseProgramadaCeaDto): string {
    return chipClaseCalCortoTexto(c, (x) => this.ubicacionClase(x));
  }

  fmtDiaCal(fecha: Date): string {
    return fmtDiaSemanaCorto(fecha);
  }

  conteoClasesDia(key: string): number {
    return (this.clasesPorDiaSemana().get(key) ?? []).length;
  }

  clasesEnDia(key: string): ClaseProgramadaCeaDto[] {
    return (this.clasesPorDiaSemana().get(key) ?? []).filter(
      (c) => !layoutHorarioHHmm(c.horaDesde, c.horaHasta).sinHorario,
    );
  }

  clasesEnDiaMes(key: string): ClaseProgramadaCeaDto[] {
    const list = [...(this.clasesPorDiaMes().get(key) ?? [])];
    return list.sort((a, b) => (a.horaDesde || '99:99').localeCompare(b.horaDesde || '99:99'));
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

  toggleDiaMesExpandido(key: string, ev?: Event): void {
    ev?.stopPropagation();
    this.calDiaExpandido.update((k) => (k === key ? null : key));
  }

  layoutClaseCea(c: ClaseProgramadaCeaDto) {
    return layoutHorarioHHmm(c.horaDesde, c.horaHasta);
  }

  layoutsCalendarioDia(clases: ClaseProgramadaCeaDto[]) {
    return layoutsCalendarioDiaHHmm(
      clases.map((c) => ({ id: c._id!, horaDesde: c.horaDesde, horaHasta: c.horaHasta })),
    );
  }

  /** Clic en calendario: abre editor o panel operativo según permisos. */
  onClaseClick(c: ClaseProgramadaCeaDto, ev?: Event): void {
    ev?.stopPropagation();
    if (this.puedeAbrirClase()) {
      this.claseEditor?.abrirClaseDesdeHost(c);
    }
  }

  onClaseEditada(c: ClaseProgramadaCeaDto): void {
    if (c.estado === 'FINALIZADO') {
      this.msg.set('Clase cerrada con horario programado — horas registradas');
    }
    this.cargarTodo(true);
  }

  irHubClase(c: ClaseProgramadaCeaDto): void {
    void this.router.navigate(['/app/programacion-cea'], {
      queryParams: {
        tab: 'clases',
        clase: c._id,
        fecha: ymdCalendario(c.fechaClase) || this.fechaSel(),
      },
    });
  }

  iniciarYOperar(c: ClaseProgramadaCeaDto): void {
    if (!c._id || !this.puedeOperar()) return;
    if (!esFechaHoy(c.fechaClase)) {
      this.msg.set('Solo puede iniciar la clase el día programado (hoy).');
      return;
    }
    if (this.claseEditor) {
      this.claseEditor.iniciarClaseDesdeHost(c);
      return;
    }
    this.svc.iniciarClase(c._id).subscribe({
      next: () => {
        this.msg.set(null);
        this.cargarTodo(true);
      },
      error: (e) => this.msg.set(e?.error?.message || 'No se pudo iniciar la clase.'),
    });
  }

  finalizarClase(c: ClaseProgramadaCeaDto): void {
    if (!c._id || !this.puedeOperar() || c.estado !== 'EN PROCESO') return;
    this.finalizandoId.set(c._id);
    this.svc.finalizarClase(c._id).subscribe({
      next: (doc) => {
        this.finalizandoId.set(null);
        this.clases.update((rows) => rows.map((x) => (x._id === doc._id ? doc : x)));
        this.clasesSemana.update((rows) => rows.map((x) => (x._id === doc._id ? doc : x)));
        this.clasesMes.update((rows) => rows.map((x) => (x._id === doc._id ? doc : x)));
      },
      error: (e) => {
        this.finalizandoId.set(null);
        this.msg.set(e?.error?.message || 'No se pudo finalizar la clase.');
      },
    });
  }

  clasePuedeCerrarRetroactivo(c: ClaseProgramadaCeaDto): boolean {
    if (!c?.fechaClase) return false;
    const e = String(c.estado || '').toUpperCase();
    if (e === 'FINALIZADO' || e === 'CANCELADA') return false;
    if (!esFechaNoFutura(c.fechaClase)) return false;
    if (!String(c.horaDesde || '').trim()) return false;
    if (!String(c.horaHasta || '').trim() && !(Number(c.duracionHoras) > 0)) return false;
    if (e === 'EN PROCESO' && esFechaHoy(c.fechaClase)) return false;
    return true;
  }

  async cerrarClaseRetroactiva(c: ClaseProgramadaCeaDto, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    if (!c._id || !this.puedeCerrarRetroactivo() || !this.clasePuedeCerrarRetroactivo(c)) return;
    const hasta = c.horaHasta || (Number(c.duracionHoras) > 0 ? '(según duración)' : '—');
    const ok = await this.confirm.open({
      title: 'Cerrar clase con horario programado',
      message: `Registrar inicio ${c.horaDesde} y fin ${hasta} del día programado. Los inscritos quedarán como ASISTIÓ.`,
      confirmLabel: 'Cerrar clase',
      variant: 'primary',
    });
    if (!ok) return;
    this.finalizandoId.set(c._id);
    this.svc.finalizarClaseRetroactiva(c._id).subscribe({
      next: (doc) => {
        this.finalizandoId.set(null);
        this.msg.set(null);
        this.clases.update((rows) => rows.map((x) => (x._id === doc._id ? doc : x)));
        this.clasesSemana.update((rows) => rows.map((x) => (x._id === doc._id ? doc : x)));
        this.clasesMes.update((rows) => rows.map((x) => (x._id === doc._id ? doc : x)));
      },
      error: (e) => {
        this.finalizandoId.set(null);
        this.msg.set(e?.error?.message || 'No se pudo cerrar la clase.');
      },
    });
  }

  private filtrarClases(rows: ClaseProgramadaCeaDto[]): ClaseProgramadaCeaDto[] {
    const q = this.query().trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((c) => {
      const campos = [
        c.programaLabel,
        c.idProg,
        c.instructorNombre,
        c.temaNombre,
        c.aulaNombre,
        c.tallerNombre,
        c.idVehiculo,
        c.tipoClase,
        c.estado,
        c.horaDesde,
        c.horaHasta,
      ];
      return campos.some((v) => String(v || '').toLowerCase().includes(q));
    });
  }
}
