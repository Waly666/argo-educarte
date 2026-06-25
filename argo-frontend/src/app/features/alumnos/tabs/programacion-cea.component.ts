import { CommonModule } from '@angular/common';
import { ArgoDateInputComponent } from '../../../shared/argo-date-input/argo-date-input.component';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, forkJoin } from 'rxjs';

import { PermisoService } from '../../../core/services/permiso.service';
import { ConfirmDialogService } from '../../../shared/confirm-dialog/confirm-dialog.service';
import { AlumnoStore } from '../../../core/services/alumno-store.service';
import {
  ClaseProgramadaCeaDto,
  CrearClaseCeaBody,
  ConflictoProgramacionCea,
  FilaRastreoCea,
  InscripcionClaseCeaDto,
  ProgramacionCeaService,
  RecursosProgramacionCea,
  TemaProgramaCeaDto,
  labelOrigenHorasCea,
  labelTipoClaseCea,
  labelTipoHorasCea,
  trackFilaRastreoCea,
} from '../../../core/services/programacion-cea.service';
import {
  agruparPorFecha,
  ahoraLineaTopPct,
  celdasMes,
  diasSemana,
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
  DIAS_SEMANA_CORTO,
  type CeldaMes,
  type DiaSemana,
} from '../../jornadas/jornada-calendario.util';
import {
  estadoClaseCalAccentClass,
  estadoClaseCalBlockClass,
  estadoClaseLiveClass,
  formatoHoraLegibleCo,
  rowClaseClass,
  tipoClaseCalBlockClass,
} from '../../jornadas/jornada-ui.util';
import { FormModalComponent } from '../../../shared/form-modal/form-modal.component';
import { Hora12InputComponent } from '../../../shared/hora-12-input/hora-12-input.component';
import {
  CatalogoEnumBuscarComponent,
  EnumBuscarOption,
} from '../../../shared/catalogo-enum-buscar/catalogo-enum-buscar.component';
import {
  chipClaseCal as chipClaseCalTexto,
  chipClaseCalCorto as chipClaseCalCortoTexto,
  horasClaseCalLabel,
} from '../../../core/utils/cea-cal-clase.util';
import { calcularHoraHastaHHmm, horasSesionClase } from '../../../core/utils/cea-horario.util';
import { horaInicioEfectiva } from '../../../core/utils/hora-12.util';
import { AsistenteContextoService } from '../../../core/services/asistente-contexto.service';
import { tipFormulario } from '../../../core/utils/asistente-formulario.util';
import type { AsistenteTip } from '../../../core/constants/asistente.types';

const CAL_MAX_EVENTOS_DIA = 4;

type VistaProgCea = 'calendario' | 'lista';

function ymdLocalDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function claseTieneHorario(c: ClaseProgramadaCeaDto): boolean {
  return Boolean(String(c.horaDesde || '').trim());
}

function claseSinHorarioDefinido(c: ClaseProgramadaCeaDto): boolean {
  const est = String(c.estado || '').toUpperCase();
  if (est === 'CANCELADA' || est === 'FINALIZADO') return false;
  return !claseTieneHorario(c) || layoutHorarioHHmm(c.horaDesde, c.horaHasta).sinHorario;
}

function fechaEnRango(fechaClase: string | Date | undefined, desde: string, hasta: string): boolean {
  const ymd = ymdCalendario(fechaClase);
  if (!ymd) return false;
  return ymd >= desde && ymd <= hasta;
}

@Component({
  selector: 'argo-alumno-programacion-cea',
  standalone: true,
  imports: [CommonModule, FormsModule, FormModalComponent, Hora12InputComponent, CatalogoEnumBuscarComponent,
    ArgoDateInputComponent,
  ],
  templateUrl: './programacion-cea.component.html',
  styleUrls: [
    './programacion-cea.component.scss',
    '../../programacion-cea/programacion-cea-clases-hoy.component.scss',
  ],
})
export class AlumnoProgramacionCeaComponent implements OnInit {
  private svc = inject(ProgramacionCeaService);
  private store = inject(AlumnoStore);
  private permisos = inject(PermisoService);
  private confirm = inject(ConfirmDialogService);
  private asistente = inject(AsistenteContextoService);

  constructor() {
    effect(() => {
      if (this.modalAbierto()) {
        this.asistente.setTipsPrepend(this.tipsMiaFormulario());
      } else {
        this.asistente.clearTipsPrepend();
      }
    });
  }

  loading = signal(false);
  error = signal<string | null>(null);
  filas = signal<FilaRastreoCea[]>([]);
  alumnoNombre = signal('');

  calendarioAbierto = signal(true);
  vista = signal<VistaProgCea>('calendario');
  fechaSel = signal(ymdLocalDate());
  mesFiltro = signal(new Date().toISOString().slice(0, 7));
  semanaInicio = signal(inicioSemana(new Date()));
  query = signal('');
  msg = signal<string | null>(null);
  msgTipo = signal<'ok' | 'error' | 'warn'>('ok');

  clasesTodas = signal<ClaseProgramadaCeaDto[]>([]);
  loadingCalendario = signal(false);
  loadingClases = signal(false);
  calDiaExpandido = signal<string | null>(null);

  modalAbierto = signal(false);
  modalEditando = signal(false);
  claseSel = signal<ClaseProgramadaCeaDto | null>(null);
  inscripciones = signal<InscripcionClaseCeaDto[]>([]);
  loadingDetalle = signal(false);
  savingClase = signal(false);
  recursos = signal<RecursosProgramacionCea | null>(null);
  temasProg = signal<TemaProgramaCeaDto[]>([]);
  formClase = signal<CrearClaseCeaBody>({
    idProg: '',
    tipoClase: 'teoria',
    fechaClase: ymdLocalDate(),
    horaDesde: '',
    horaHasta: '',
  });
  formError = signal<string | null>(null);
  conflictos = signal<ConflictoProgramacionCea[]>([]);

  duracionSesionPractica = signal<number | null>(null);
  duracionesPermitidas = signal<number[]>([1, 2, 3, 4]);
  duracionSesionDefault = signal(2);
  clasesCeaGeneradas = signal(false);
  savingPrefPractica = signal(false);
  clasesGrupalesFaltantes = signal({ total: 0, teoria: 0, taller: 0 });
  generandoFaltantes = signal(false);
  borrandoClase = signal(false);
  limpiandoFlotantes = signal(false);

  readonly calMaxEventosDia = CAL_MAX_EVENTOS_DIA;
  readonly horasCal = horasSlots();
  estadoClaseCalBlockClass = estadoClaseCalBlockClass;
  estadoClaseCalAccentClass = estadoClaseCalAccentClass;
  estadoClaseLiveClass = estadoClaseLiveClass;
  rowClaseClass = rowClaseClass;
  tipoClaseCalBlockClass = tipoClaseCalBlockClass;
  formatoHoraLegible = formatoHoraLegibleCo;
  diasSemanaLabels = DIAS_SEMANA_CORTO;
  esFinDeSemana = esFinDeSemana;
  ymdCalendario = ymdCalendario;
  claseTieneHorario = claseTieneHorario;

  puedeOperar = computed(() => this.permisos.tiene(['programacion_cea.operar', 'programacion_cea.gestionar']));
  puedeGestionar = computed(() => this.permisos.tiene(['programacion_cea.gestionar']));

  tieneHorasPractica = computed(() =>
    this.filas().some((f) => f.tipoHoras === 'practica' && f.requeridas > 0),
  );

  labelDuracionAutomatica = computed(() => {
    const d = this.duracionSesionDefault();
    return `Automático (${d} h por sesión)`;
  });

  pendientesCount = computed(() => this.filas().filter((f) => f.pendientes > 0).length);
  totalPendientes = computed(() =>
    this.filas().reduce((acc, f) => acc + Math.max(0, Number(f.pendientes) || 0), 0),
  );

  tieneClasesGrupalesFaltantes = computed(() => (this.clasesGrupalesFaltantes().total || 0) > 0);

  hoyKey = computed(() => ymdLocalDate(new Date()));
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
  tituloSemanaCal = computed(() => fmtRangoSemana(this.semanaInicio()));
  calCeldas = computed((): CeldaMes[] => celdasMes(this.calAnio(), this.calMes()));
  diasSemanaCal = computed((): DiaSemana[] => diasSemana(this.semanaInicio()));
  semanaIncluyeHoy = computed(() => this.diasSemanaCal().some((d) => d.key === this.hoyKey()));
  ahoraCalTopPct = computed(() => {
    this.diasSemanaCal();
    return ahoraLineaTopPct(new Date());
  });

  clasesFiltradas = computed(() => this.filtrarClases(this.clasesTodas()));
  filtradas = computed(() =>
    this.clasesFiltradas().filter((c) => ymdCalendario(c.fechaClase) === this.fechaSel()),
  );
  filtradasSemana = computed(() => {
    const ini = ymdLocal(this.semanaInicio());
    const fin = ymdLocal(finSemana(this.semanaInicio()));
    return this.clasesFiltradas().filter((c) => {
      const y = ymdCalendario(c.fechaClase);
      return y >= ini && y <= fin;
    });
  });
  clasesMesVisible = computed(() => {
    const { desde, hasta } = rangoVisibleMes(this.calAnio(), this.calMes());
    return this.clasesFiltradas().filter((c) => fechaEnRango(c.fechaClase, desde, hasta));
  });

  clasesPorDiaMes = computed(() =>
    agruparPorFecha(this.clasesMesVisible(), (c) => ymdCalendario(c.fechaClase)),
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

  /** Práctica, taller y teoría CREADO del alumno que aún no tienen horario (todas las fechas). */
  clasesSinHorarioCal = computed(() =>
    this.clasesFiltradas()
      .filter((c) => {
        if (!claseSinHorarioDefinido(c)) return false;
        if (c.tipoClase === 'practica' || c.tipoClase === 'taller') return true;
        if (c.tipoClase === 'teoria') return String(c.estado || '').toUpperCase() === 'CREADO';
        return false;
      })
      .sort((a, b) => {
        const orden: Record<string, number> = { practica: 0, taller: 1, teoria: 2 };
        const ta = orden[a.tipoClase] ?? 9;
        const tb = orden[b.tipoClase] ?? 9;
        if (ta !== tb) return ta - tb;
        return ymdCalendario(a.fechaClase).localeCompare(ymdCalendario(b.fechaClase));
      }),
  );

  resumenSinHorarioCal = computed(() => {
    const list = this.clasesSinHorarioCal();
    return {
      total: list.length,
      practica: list.filter((c) => c.tipoClase === 'practica').length,
      taller: list.filter((c) => c.tipoClase === 'taller').length,
      teoria: list.filter((c) => c.tipoClase === 'teoria').length,
    };
  });

  /** Clases CREADO del alumno sin horario — candidatas a limpieza masiva. */
  clasesFlotantesLimpiables = computed(() =>
    this.clasesFiltradas().filter(
      (c) => String(c.estado || '').toUpperCase() === 'CREADO' && !claseTieneHorario(c),
    ),
  );

  accionBorradoClase = computed((): 'quitar' | 'borrar' | null => {
    const c = this.claseSel();
    if (!c || !this.puedeBorrarClase(c)) return null;
    if (this.esClaseGrupal(c)) return 'quitar';
    if (c.tipoClase === 'practica') return 'borrar';
    return null;
  });

  enProcesoCount = computed(() => this.filtradas().filter((c) => c.estado === 'EN PROCESO').length);
  programadasCount = computed(() => this.filtradas().filter((c) => c.estado === 'PROGRAMADA').length);
  finalizadasCount = computed(() => this.filtradas().filter((c) => c.estado === 'FINALIZADO').length);
  totalClasesAlumno = computed(() => this.clasesTodas().length);

  clasesPorProgramar = computed(() => this.clasesTodas().filter((c) => !claseTieneHorario(c)));

  temasFiltrados = computed(() => {
    const tipo = this.formClase().tipoClase;
    const tipoTema = tipo === 'teoria' ? 'teoria' : tipo === 'taller' ? 'taller' : null;
    if (!tipoTema) return [];
    return this.temasProg().filter((t) => t.tipo === tipoTema && t.activo !== false);
  });

  opcionesDuracionPref = computed<EnumBuscarOption[]>(() => [
    { value: 'auto', label: this.labelDuracionAutomatica() },
    ...this.duracionesPermitidas().map((d) => ({ value: String(d), label: `${d} h por sesión` })),
  ]);

  textoDuracionPref = computed(() => {
    const v = this.duracionSesionPractica();
    return v == null ? this.labelDuracionAutomatica() : `${v} h por sesión`;
  });

  opcionesDuracionClase = computed<EnumBuscarOption[]>(() =>
    this.duracionesPermitidas().map((d) => ({ value: d, label: `${d} h` })),
  );

  textoDuracionClase = computed(() => {
    const d = this.formClase().duracionHoras;
    return d != null && Number.isFinite(Number(d)) ? `${d} h` : '';
  });

  opcionesVehiculos = computed<EnumBuscarOption[]>(() =>
    (this.recursos()?.vehiculos || []).map((v) => ({
      value: v.placa,
      label: v.label,
      hint: v.placa,
    })),
  );

  textoVehiculo = computed(() => {
    const placa = this.formClase().idVehiculo;
    const v = (this.recursos()?.vehiculos || []).find((x) => x.placa === placa);
    return v?.label || String(placa || '');
  });

  opcionesTemas = computed<EnumBuscarOption[]>(() =>
    this.temasFiltrados().map((t) => ({ value: String(t._id), label: String(t.nombre || '') })),
  );

  textoTema = computed(() => {
    const id = this.formClase().idTema;
    const t = this.temasFiltrados().find((x) => String(x._id) === String(id));
    return t?.nombre || '';
  });

  opcionesAulas = computed<EnumBuscarOption[]>(() =>
    (this.recursos()?.aulas || []).map((a) => ({ value: a.id, label: a.nombre })),
  );

  textoAula = computed(() => {
    const id = this.formClase().idAula;
    return (this.recursos()?.aulas || []).find((a) => a.id === id)?.nombre || String(id || '');
  });

  opcionesTalleres = computed<EnumBuscarOption[]>(() =>
    (this.recursos()?.talleres || []).map((t) => ({ value: t.id, label: t.nombre })),
  );

  textoTaller = computed(() => {
    const id = this.formClase().idTaller;
    return (this.recursos()?.talleres || []).find((t) => t.id === id)?.nombre || String(id || '');
  });

  opcionesInstructores = computed<EnumBuscarOption[]>(() =>
    (this.recursos()?.instructores || []).map((i) => ({
      value: i.idEmpleado,
      label: i.nombreCompleto,
    })),
  );

  textoInstructor = computed(() => {
    const id = this.formClase().idEmpleadoInstructor;
    return (
      (this.recursos()?.instructores || []).find((i) => Number(i.idEmpleado) === Number(id))
        ?.nombreCompleto || ''
    );
  });

  modalTitulo = computed(() => {
    const c = this.claseSel();
    if (!c) return 'Clase CEA';
    return `${labelTipoClaseCea(c.tipoClase)} — ${c.programaLabel || c.idProg}`;
  });

  private tipsMiaFormulario(): AsistenteTip[] {
    const c = this.claseSel();
    const tips: AsistenteTip[] = [];
    if (c?.estado) {
      tips.push(tipFormulario('Estado de la clase', String(c.estado), 'al-cea-estado'));
    }
    if (this.modalEditando()) {
      tips.push(
        tipFormulario('Fecha y horario', 'Ajuste la programación de la clase.', 'al-cea-s1'),
        tipFormulario('Recursos e instructor', 'Ubicación, vehículo y persona a cargo.', 'al-cea-s2'),
      );
    }
    return tips;
  }

  labelTipo = labelTipoHorasCea;
  labelOrigen = labelOrigenHorasCea;
  trackRastreo = trackFilaRastreoCea;
  labelTipoClase = labelTipoClaseCea;

  ngOnInit(): void {
    this.cargar();
  }

  cargar() {
    const nd = this.store.numDoc();
    if (nd == null) {
      this.filas.set([]);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.svc.rastreoAlumno(nd).subscribe({
      next: (r) => {
        this.filas.set(r.filas || []);
        this.alumnoNombre.set(r.alumnoNombre || this.store.nombreCompleto() || '');
        this.duracionSesionPractica.set(r.duracionSesionPracticaCea ?? null);
        this.duracionesPermitidas.set(r.duracionesPermitidas?.length ? r.duracionesPermitidas : [1, 2, 3, 4]);
        this.duracionSesionDefault.set(r.duracionSesionPracticaDefault ?? 2);
        this.clasesCeaGeneradas.set(!!r.clasesCeaGeneradas);
        this.clasesGrupalesFaltantes.set(
          r.clasesGrupalesFaltantes ?? { total: 0, teoria: 0, taller: 0 },
        );
        this.loading.set(false);
        this.cargarClasesAlumno();
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e?.error?.message || 'No se pudo cargar el rastreo CEA.');
        this.filas.set([]);
      },
    });
  }

  toggleCalendario() {
    this.calendarioAbierto.update((v) => !v);
    this.cerrarModal();
    this.calDiaExpandido.set(null);
  }

  setVista(v: VistaProgCea): void {
    this.vista.set(v);
  }

  onFechaChange(fecha: string): void {
    const f = String(fecha || '').trim();
    if (!f) return;
    this.fechaSel.set(f);
    this.mesFiltro.set(f.slice(0, 7));
    this.semanaInicio.set(inicioSemana(new Date(`${f}T12:00:00`)));
    this.calDiaExpandido.set(null);
  }

  irHoy(): void {
    this.onFechaChange(this.hoyKey());
  }

  onMesFiltroChange(mes: string): void {
    this.mesFiltro.set(mes);
    this.calDiaExpandido.set(null);
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
  }

  semanaSiguiente(): void {
    const d = new Date(this.semanaInicio());
    d.setDate(d.getDate() + 7);
    this.semanaInicio.set(inicioSemana(d));
    this.mesFiltro.set(ymdLocal(this.semanaInicio()).slice(0, 7));
  }

  irSemanaHoy(): void {
    this.semanaInicio.set(inicioSemana(new Date()));
    this.mesFiltro.set(this.hoyKey().slice(0, 7));
    this.fechaSel.set(this.hoyKey());
  }

  generarClasesFaltantes(): void {
    const nd = this.store.numDoc();
    if (nd == null || !this.puedeGestionar() || this.generandoFaltantes()) return;

    this.generandoFaltantes.set(true);
    this.msg.set(null);

    this.svc.completarClasesFaltantes(nd).subscribe({
      next: (r) => {
        this.generandoFaltantes.set(false);
        this.clasesGrupalesFaltantes.set(
          r.faltantesDespues ?? { total: 0, teoria: 0, taller: 0 },
        );
        const generadas = r.clases ?? 0;
        this.msgTipo.set(generadas > 0 ? 'ok' : 'warn');
        this.msg.set(
          r.message ||
            (generadas > 0
              ? `Se generaron o inscribieron ${generadas} clase(s) faltante(s).`
              : 'No había clases teóricas ni de taller pendientes por generar.'),
        );
        this.cargar();
      },
      error: (e) => {
        this.generandoFaltantes.set(false);
        this.msgTipo.set('error');
        this.msg.set(e?.error?.message || 'No se pudieron generar las clases faltantes.');
      },
    });
  }

  onMesCalChange(ym: string) {
    this.onMesFiltroChange(ym);
  }

  onDuracionSesionPracticaChange(val: number | null | string) {
    const nd = this.store.numDoc();
    if (nd == null || !this.puedeGestionar()) return;

    const parsed =
      val === null || val === '' || val === 'auto' ? null : Number(val);
    if (parsed != null && !Number.isFinite(parsed)) return;

    const prev = this.duracionSesionPractica();
    this.duracionSesionPractica.set(parsed);
    this.savingPrefPractica.set(true);

    this.svc.guardarPreferenciasAlumno(nd, { duracionSesionPracticaCea: parsed }).subscribe({
      next: (r) => {
        this.duracionSesionPractica.set(r.duracionSesionPracticaCea ?? null);
        this.duracionesPermitidas.set(r.duracionesPermitidas?.length ? r.duracionesPermitidas : [1, 2, 3, 4]);
        this.clasesCeaGeneradas.set(!!r.clasesCeaGeneradas);
        this.savingPrefPractica.set(false);
        this.flash('Preferencia de sesión de práctica guardada', 'ok');
      },
      error: (e) => {
        this.duracionSesionPractica.set(prev);
        this.savingPrefPractica.set(false);
        this.flash(e?.error?.message || 'No se pudo guardar la preferencia', 'error');
      },
    });
  }

  onDuracionPrefPick(opt: EnumBuscarOption): void {
    if (String(opt.value) === 'auto') this.onDuracionSesionPracticaChange(null);
    else this.onDuracionSesionPracticaChange(Number(opt.value));
  }

  onDuracionPrefLimpiar(): void {
    this.onDuracionSesionPracticaChange(null);
  }

  onDuracionClasePick(opt: EnumBuscarOption): void {
    this.patchForm({ duracionHoras: +opt.value });
  }

  onDuracionClaseLimpiar(): void {
    this.patchForm({ duracionHoras: undefined });
  }

  onVehiculoPick(opt: EnumBuscarOption): void {
    this.patchForm({ idVehiculo: String(opt.value) });
  }

  onVehiculoLimpiar(): void {
    this.patchForm({ idVehiculo: '' });
  }

  onTemaPick(opt: EnumBuscarOption): void {
    this.patchForm({ idTema: String(opt.value) });
  }

  onTemaLimpiar(): void {
    this.patchForm({ idTema: '' });
  }

  onAulaPick(opt: EnumBuscarOption): void {
    this.patchForm({ idAula: String(opt.value) });
  }

  onAulaLimpiar(): void {
    this.patchForm({ idAula: '' });
  }

  onTallerPick(opt: EnumBuscarOption): void {
    this.patchForm({ idTaller: String(opt.value) });
  }

  onTallerLimpiar(): void {
    this.patchForm({ idTaller: '' });
  }

  onInstructorPick(opt: EnumBuscarOption): void {
    this.patchForm({ idEmpleadoInstructor: Number(opt.value) });
  }

  onInstructorLimpiar(): void {
    this.patchForm({ idEmpleadoInstructor: undefined });
  }

  duracionPracticaEfectiva(): number {
    return this.duracionSesionPractica() ?? this.duracionSesionDefault();
  }

  horasSesionEnEdicion(): number {
    const f = this.formClase();
    const c = this.claseSel();
    return horasSesionClase(f.tipoClase, {
      duracionHoras: f.duracionHoras,
      horasDescuento: c?.horasDescuento,
    });
  }

  usaHoraFinCalculada(): boolean {
    const f = this.formClase();
    if (f.tipoClase === 'practica') return true;
    const c = this.claseSel();
    return Number(c?.horasDescuento) > 0;
  }

  duracionSesionBloqueada(): boolean {
    const c = this.claseSel();
    if (!c) return false;
    return this.horasSesionEnEdicion() > 0;
  }

  recursosCategoriaLicencia = signal<string | null>(null);

  private cargarRecursos(idProg?: string) {
    this.svc.recursos({ idProg: idProg || this.claseSel()?.idProg || undefined }).subscribe({
      next: (r) => {
        this.recursos.set(r);
        this.recursosCategoriaLicencia.set(r.categoriaLicencia ?? null);
      },
      error: () => {
        this.recursos.set(null);
        this.recursosCategoriaLicencia.set(null);
      },
    });
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
    this.fechaSel.set(this.hoyKey());
    this.semanaInicio.set(inicioSemana(new Date()));
  }

  cargarCalendario() {
    this.cargarClasesAlumno(true);
  }

  /** Carga todas las clases inscritas del alumno (incluye CREADO sin horario). */
  cargarClasesAlumno(soloCalendario = false) {
    const nd = this.store.numDoc();
    if (nd == null) return;
    if (soloCalendario) this.loadingCalendario.set(true);
    else this.loadingClases.set(true);
    this.svc.clasesAlumno(nd, { todas: true }).subscribe({
      next: (rows) => {
        this.clasesTodas.set(rows || []);
        if (soloCalendario) this.loadingCalendario.set(false);
        else this.loadingClases.set(false);
      },
      error: (e) => {
        this.clasesTodas.set([]);
        if (soloCalendario) this.loadingCalendario.set(false);
        else this.loadingClases.set(false);
        if (soloCalendario) {
          this.flash(e?.error?.message || 'No se pudo cargar el calendario', 'error');
        }
      },
    });
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

  conteoClasesDia(key: string): number {
    return (this.clasesPorDiaSemana().get(key) ?? []).length;
  }

  clasesEnDia(key: string): ClaseProgramadaCeaDto[] {
    return (this.clasesPorDiaSemana().get(key) ?? []).filter(
      (c) => claseTieneHorario(c) && !layoutHorarioHHmm(c.horaDesde, c.horaHasta).sinHorario,
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

  chipClaseCalCorto(c: ClaseProgramadaCeaDto): string {
    return chipClaseCalCortoTexto(c, (x) => this.ubicacionClase(x));
  }

  etiquetaSinHorarioCal(c: ClaseProgramadaCeaDto): string {
    const f = ymdCalendario(c.fechaClase);
    return f ? `${f} · ${this.chipClaseCalCorto(c)}` : this.chipClaseCalCorto(c);
  }

  onClaseCalClick(c: ClaseProgramadaCeaDto, ev?: Event): void {
    ev?.stopPropagation();
    if (!claseTieneHorario(c) && this.puedeEditarClase(c)) {
      this.abrirModalClase(c, { programar: true });
      return;
    }
    this.seleccionarClase(c);
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

  seleccionarClase(c: ClaseProgramadaCeaDto, ev?: Event) {
    ev?.stopPropagation();
    this.abrirModalClase(c);
  }

  abrirModalClase(c: ClaseProgramadaCeaDto, opts?: { programar?: boolean }) {
    this.claseSel.set(c);
    this.modalAbierto.set(true);
    this.modalEditando.set(false);
    this.formError.set(null);
    const autoEditar =
      opts?.programar ||
      (c.estado === 'CREADO' && !claseTieneHorario(c) && this.puedeGestionar());
    this.cargarDetalleClase(c._id, autoEditar);
  }

  cerrarModal() {
    this.modalAbierto.set(false);
    this.modalEditando.set(false);
    this.claseSel.set(null);
    this.inscripciones.set([]);
    this.formError.set(null);
  }

  cargarDetalleClase(id: string, autoEditar = false) {
    this.loadingDetalle.set(true);
    forkJoin({
      clase: this.svc.obtenerClase(id),
      ins: this.svc.listarInscripciones(id),
    }).subscribe({
      next: ({ clase, ins }) => {
        this.claseSel.set(clase);
        this.inscripciones.set(ins || []);
        this.loadingDetalle.set(false);
        if (autoEditar && this.puedeEditarClase(clase)) {
          this.abrirEditarModal();
        }
      },
      error: (e) => {
        this.loadingDetalle.set(false);
        this.flash(e?.error?.message || 'No se pudo cargar la clase', 'error');
      },
    });
  }

  abrirEditarModal() {
    const c = this.claseSel();
    if (!c || !this.puedeGestionar()) return;
    if (c.estado !== 'CREADO' && c.estado !== 'PROGRAMADA') return;

    this.formClase.set({
      idProg: c.idProg,
      tipoClase: c.tipoClase,
      fechaClase: ymdCalendario(c.fechaClase) || ymdLocalDate(),
      horaDesde: horaInicioEfectiva(c.horaDesde),
      horaHasta: c.horaHasta || '',
      duracionHoras:
        c.duracionHoras ??
        (c.tipoClase === 'practica'
          ? c.horasDescuento ?? this.duracionPracticaEfectiva()
          : undefined),
      idTema: c.idTema || '',
      idAula: c.idAula || '',
      idTaller: c.idTaller || '',
      idVehiculo: c.idVehiculo || '',
      idEmpleadoInstructor: c.idEmpleadoInstructor ?? undefined,
      cupoMaximo: c.cupoMaximo ?? (c.tipoClase === 'practica' ? 1 : 25),
      observaciones: c.observaciones || '',
    });

    if (c.tipoClase === 'practica') {
      this.cargarRecursos(c.idProg);
    } else if (!this.recursos()) {
      this.cargarRecursos();
    }
    if (c.idProg && (c.tipoClase === 'teoria' || c.tipoClase === 'taller')) {
      this.svc.listarTemas(c.idProg).subscribe({
        next: (t) => this.temasProg.set(t || []),
        error: () => this.temasProg.set([]),
      });
    }

    this.modalEditando.set(true);
    this.formError.set(null);
    this.conflictos.set([]);
    this.formClase.update((f) => {
      this.syncHoraFinForm(f);
      return { ...f };
    });
  }

  cancelarEdicion() {
    this.modalEditando.set(false);
    this.formError.set(null);
  }

  horaFinFormulario(): string {
    const f = this.formClase();
    const horas = this.horasSesionEnEdicion();
    if (f.horaDesde && horas > 0 && this.usaHoraFinCalculada()) {
      return calcularHoraHastaHHmm(f.horaDesde, horas);
    }
    return f.horaHasta || '';
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

  patchForm(p: Partial<CrearClaseCeaBody>) {
    this.formClase.update((f) => {
      const next = { ...f, ...p };
      this.syncHoraFinForm(next);
      return next;
    });
  }

  guardarClase() {
    const c = this.claseSel();
    if (!c?._id || !this.puedeGestionar()) return;

    const f = this.formClase();
    const horaDesde = horaInicioEfectiva(f.horaDesde);
    const horas = this.horasSesionEnEdicion();
    let horaHasta = f.horaHasta || '';
    if (horaDesde && horas > 0 && this.usaHoraFinCalculada()) {
      horaHasta = calcularHoraHastaHHmm(horaDesde, horas);
    } else if (!horaHasta && horaDesde) {
      horaHasta = this.horaFinFormulario();
    }
    const body: CrearClaseCeaBody = {
      ...f,
      horaDesde,
      horaHasta,
    };

    if (!body.fechaClase) {
      this.formError.set('Indique la fecha de la clase.');
      return;
    }
    if (!horaDesde) {
      this.formError.set('Indique la hora de inicio.');
      return;
    }
    if (body.tipoClase === 'practica' && !body.idVehiculo) {
      this.formError.set('Seleccione el vehículo.');
      return;
    }
    if (body.tipoClase === 'teoria' && !body.idAula) {
      this.formError.set('Seleccione el aula.');
      return;
    }
    if (body.tipoClase === 'taller' && !body.idTaller) {
      this.formError.set('Seleccione el taller.');
      return;
    }
    if (!body.idEmpleadoInstructor) {
      this.formError.set('Seleccione el instructor.');
      return;
    }

    this.savingClase.set(true);
    this.formError.set(null);
    this.conflictos.set([]);
    this.svc.actualizarClase(c._id, body).subscribe({
      next: (doc) => {
        this.savingClase.set(false);
        this.modalEditando.set(false);
        this.claseSel.set(doc);
        this.conflictos.set([]);
        this.flash('Clase actualizada', 'ok');
        this.cargarClasesAlumno();
        this.cargar();
        this.cargarDetalleClase(c._id);
      },
      error: (e) => {
        this.savingClase.set(false);
        const lista = (e?.error?.conflictos as ConflictoProgramacionCea[] | undefined) || [];
        this.conflictos.set(lista);
        const msg =
          e?.error?.message ||
          (lista.length ? lista.map((x) => x.mensaje).join(' ') : 'No se pudo guardar la clase');
        this.formError.set(msg);
      },
    });
  }

  chipClaseCal(c: ClaseProgramadaCeaDto): string {
    return chipClaseCalTexto(c, (x) => this.ubicacionClase(x));
  }

  ubicacionClase(c: ClaseProgramadaCeaDto): string {
    if (c.tipoClase === 'practica') return c.idVehiculo || 'Vehículo pendiente';
    if (c.tipoClase === 'taller') return c.tallerNombre || c.idTaller || '—';
    return c.aulaNombre || c.idAula || '—';
  }

  puedeEditarClase(c: ClaseProgramadaCeaDto | null): boolean {
    if (!c || !this.puedeGestionar()) return false;
    return c.estado === 'CREADO' || c.estado === 'PROGRAMADA';
  }

  puedeBorrarClase(c: ClaseProgramadaCeaDto | null): boolean {
    if (!c || !this.puedeGestionar()) return false;
    const e = String(c.estado || '').trim().toUpperCase();
    return e === 'PROGRAMADA' || e === 'CREADO' || e === 'CANCELADA';
  }

  esClaseGrupal(c: ClaseProgramadaCeaDto): boolean {
    return c.tipoClase === 'teoria' || c.tipoClase === 'taller';
  }

  /** En ficha alumno: teoría/taller solo quitan inscripción; práctica borra la clase entera. */
  accionLimpiezaClase(c: ClaseProgramadaCeaDto): 'quitar' | 'borrar' | null {
    if (!this.puedeBorrarClase(c)) return null;
    if (this.esClaseGrupal(c)) return 'quitar';
    if (c.tipoClase === 'practica') return 'borrar';
    return null;
  }

  private resumenClaseParaConfirm(c: ClaseProgramadaCeaDto): string {
    const tipo = labelTipoClaseCea(c.tipoClase);
    const fecha = ymdCalendario(c.fechaClase) || 'sin fecha';
    const hora = String(c.horaDesde || '').trim();
    const horario = hora ? ` a las ${hora}` : ' (sin horario)';
    const ubic = this.ubicacionClase(c);
    return `${tipo} del ${fecha}${horario} — ${ubic}`;
  }

  async borrarClaseSeleccionada(): Promise<void> {
    const c = this.claseSel();
    if (!c?._id || this.accionBorradoClase() !== 'borrar') return;
    const ok = await this.confirm.open({
      title: 'Borrar clase',
      message: `¿Eliminar permanentemente la clase de ${this.resumenClaseParaConfirm(c)}? Se quitarán también las inscripciones. Esta acción no se puede deshacer.`,
      variant: 'danger',
      confirmLabel: 'Sí, borrar',
    });
    if (!ok) return;
    await this.ejecutarEliminarClase(c._id, { cerrarModal: true });
  }

  async quitarAlumnoDeClase(): Promise<void> {
    const c = this.claseSel();
    const nd = this.store.numDoc();
    if (!c?._id || nd == null || this.accionBorradoClase() !== 'quitar') return;
    const ok = await this.confirm.open({
      title: 'Quitar inscripción',
      message: `¿Quitar la inscripción de este alumno en la clase de ${this.resumenClaseParaConfirm(c)}? La clase de ${labelTipoClaseCea(c.tipoClase)} se mantiene para otros alumnos inscritos.`,
      variant: 'danger',
      confirmLabel: 'Sí, quitar inscripción',
    });
    if (!ok) return;
    this.borrandoClase.set(true);
    try {
      await firstValueFrom(this.svc.quitarInscripcion(c._id, nd));
      this.flash('Inscripción eliminada', 'ok');
      this.cerrarModal();
      this.cargar();
    } catch (e: unknown) {
      const err = e as { error?: { message?: string } };
      this.flash(err?.error?.message || 'No se pudo quitar la inscripción', 'error');
    } finally {
      this.borrandoClase.set(false);
    }
  }

  async limpiarClasesSinProgramar(): Promise<void> {
    const lista = this.clasesFlotantesLimpiables().filter((c) => this.puedeBorrarClase(c));
    if (!lista.length || !this.puedeGestionar() || this.limpiandoFlotantes()) return;

    const ok = await this.confirm.open({
      title: 'Limpiar clases sin programar',
      message: `Se procesarán ${lista.length} clase(s) CREADO sin horario de este alumno. Las de práctica se borrarán; las de teoría y taller solo quitarán la inscripción del alumno (la clase grupal no se elimina). ¿Continuar?`,
      variant: 'danger',
      confirmLabel: 'Sí, limpiar',
    });
    if (!ok) return;

    this.limpiandoFlotantes.set(true);
    let quitados = 0;
    let borrados = 0;
    let errores = 0;

    for (const c of lista) {
      if (!c._id) continue;
      try {
        const accion = this.accionLimpiezaClase(c);
        if (accion === 'quitar') {
          const nd = this.store.numDoc();
          if (nd == null) continue;
          await firstValueFrom(this.svc.quitarInscripcion(c._id, nd));
          quitados++;
        } else if (accion === 'borrar') {
          await firstValueFrom(this.svc.eliminarClase(c._id));
          borrados++;
        }
      } catch {
        errores++;
      }
    }

    this.limpiandoFlotantes.set(false);
    this.cargar();
    if (errores > 0) {
      this.flash(
        `Limpieza parcial: ${borrados} borrada(s), ${quitados} inscripción(es) quitada(s), ${errores} error(es).`,
        'warn',
      );
    } else {
      this.flash(
        `Limpieza completada: ${borrados} clase(s) borrada(s), ${quitados} inscripción(es) quitada(s).`,
        'ok',
      );
    }
  }

  private async ejecutarEliminarClase(id: string, opts?: { cerrarModal?: boolean }): Promise<void> {
    this.borrandoClase.set(true);
    try {
      await firstValueFrom(this.svc.eliminarClase(id));
      this.flash('Clase eliminada', 'ok');
      if (opts?.cerrarModal) this.cerrarModal();
      this.cargar();
    } catch (e: unknown) {
      const err = e as { error?: { message?: string } };
      this.flash(err?.error?.message || 'No se pudo borrar la clase', 'error');
    } finally {
      this.borrandoClase.set(false);
    }
  }

  private flash(texto: string, tipo: 'ok' | 'error' | 'warn') {
    this.msg.set(texto);
    this.msgTipo.set(tipo);
  }
}
