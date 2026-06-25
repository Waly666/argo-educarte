import { CommonModule } from '@angular/common';
import { ArgoDateInputComponent } from '../../shared/argo-date-input/argo-date-input.component';
import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { PermisoService } from '../../core/services/permiso.service';
import {
  BloqueHorarioCea,
  ConfigProgramacionCea,
  FilaRastreoCea,
  PlanificacionCeaBody,
  PlanificacionCeaPreview,
  ClasePlanificadaFila,
  ProgramaCeaDto,
  ProgramacionCeaService,
  RecursosProgramacionCea,
  TemaProgramaCeaDto,
  labelOrigenHorasCea,
  labelTipoHorasCea,
  trackFilaRastreoCea,
} from '../../core/services/programacion-cea.service';

import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';

type TabCea = 'inicio' | 'config' | 'temas' | 'clases' | 'pendientes';
type BloqueConfig = 'vehiculo' | 'aula' | 'taller' | 'planificacion';

function ymdLocal(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rangoMesActual(): { fechaDesde: string; fechaHasta: string } {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const hasta = new Date(y, m + 1, 0);
  return { fechaDesde: ymdLocal(new Date(y, m, 1)), fechaHasta: ymdLocal(hasta) };
}

@Component({
  selector: 'argo-programacion-cea-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink,
    ArgoDateInputComponent,
  ],
  templateUrl: './programacion-cea-hub.component.html',
  styleUrls: ['./programacion-cea-hub.component.scss'],
})
export class ProgramacionCeaHubComponent implements OnInit {
  private svc = inject(ProgramacionCeaService);
  private permisos = inject(PermisoService);
  private confirm = inject(ConfirmDialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  tab = signal<TabCea>('inicio');
  bloqueConfig = signal<BloqueConfig>('vehiculo');
  loading = signal(true);
  saving = signal(false);
  msg = signal<string | null>(null);
  msgTipo = signal<'ok' | 'error' | 'info'>('info');

  programas = signal<ProgramaCeaDto[]>([]);
  config = signal<ConfigProgramacionCea | null>(null);
  festivosAnio = signal<number>(new Date().getFullYear());
  festivos = signal<string[]>([]);

  progTemasSel = signal('');
  temas = signal<TemaProgramaCeaDto[]>([]);
  formTema = signal<Partial<TemaProgramaCeaDto>>({ tipo: 'teoria', orden: 1, activo: true });
  editTemaId = signal<string | null>(null);

  rastreo = signal<FilaRastreoCea[]>([]);
  alertasPrograma = signal<{ idProg: string; programaLabel: string; mensaje: string }[]>([]);
  totalPendientes = signal(0);
  generandoPendientes = signal(false);

  recursosPlan = signal<RecursosProgramacionCea | null>(null);
  planPreview = signal<PlanificacionCeaPreview | null>(null);
  planGenerando = signal(false);
  planPreviewLoading = signal(false);
  planListadoGenerado = signal(false);
  @ViewChild('planResultado') planResultadoRef?: ElementRef<HTMLElement>;
  planForm = signal<PlanificacionCeaBody>({
    idProg: '',
    ...rangoMesActual(),
    programasPorPeriodo: 1,
    incluirTeoria: true,
    incluirTaller: true,
    idAula: '',
    idTaller: '',
  });

  puedeGestionar = computed(() => this.permisos.tiene('programacion_cea.gestionar'));

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((qp) => {
      const t = qp.get('tab') as TabCea | null;
      if (t && ['inicio', 'config', 'temas', 'clases', 'pendientes'].includes(t)) {
        this.tab.set(t);
        if (t === 'temas' && this.progTemasSel()) this.cargarTemas();
      }
    });
    this.cargarBase();
  }

  setTab(t: TabCea) {
    this.tab.set(t);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab: t }, queryParamsHandling: 'merge' });
    if (t === 'pendientes') this.cargarRastreo(true);
    if (t === 'temas' && this.progTemasSel()) this.cargarTemas();
    if (t === 'clases') this.cargarRastreo(true);
    if (t === 'config') this.cargarRecursosPlan();
  }

  labelTipo = labelTipoHorasCea;
  labelOrigen = labelOrigenHorasCea;
  trackRastreo = trackFilaRastreoCea;
  subHorarios: Array<'normal' | 'sabado' | 'domingo' | 'festivo'> = ['normal', 'sabado', 'domingo', 'festivo'];

  horarioSub(b: BloqueHorarioCea | undefined, sub: 'normal' | 'sabado' | 'domingo' | 'festivo') {
    if (!b) return { horaDesde: '', horaHasta: '' };
    const row = b[sub];
    if (row && typeof row === 'object') return row as { horaDesde?: string; horaHasta?: string };
    return { horaDesde: '', horaHasta: '' };
  }

  private cargarBase() {
    this.loading.set(true);
    this.svc.programas().subscribe({
      next: (p) => {
        this.programas.set(p);
        if (!this.progTemasSel() && p.length) this.progTemasSel.set(p[0].idProg);
        if (this.tab() === 'temas' && this.progTemasSel()) this.cargarTemas();
        const cfg = this.config();
        if (cfg) this.initPlanFormDesdeConfig(cfg);
        else if (p.length) {
          this.planForm.update((f) => ({ ...f, idProg: f.idProg || p[0].idProg }));
        }
      },
      error: () => this.flash('No se pudieron cargar los programas CEA', 'error'),
    });
    this.svc.obtenerConfig().subscribe({
      next: (c) => {
        this.config.set(c);
        this.initPlanFormDesdeConfig(c);
      },
      error: () => this.flash('No se pudo cargar la configuración', 'error'),
    });
    this.cargarFestivos();
    this.cargarRastreo(true);
    this.loading.set(false);
  }

  cargarFestivos() {
    this.svc.festivos(this.festivosAnio()).subscribe({
      next: (r) => {
        this.festivosAnio.set(r.anio);
        this.festivos.set(r.fechas || []);
      },
      error: () => undefined,
    });
  }

  cargarRastreo(soloPendientes = false) {
    this.svc.rastreoGlobal(soloPendientes).subscribe({
      next: (r) => {
        this.rastreo.set(r.filas || []);
        this.alertasPrograma.set(r.alertasPrograma || []);
        this.totalPendientes.set(r.totalPendientes ?? 0);
      },
      error: () => undefined,
    });
  }

  generarClasesPendientes(): void {
    if (!this.puedeGestionar() || this.generandoPendientes()) return;

    this.generandoPendientes.set(true);
    this.msg.set(null);

    this.svc.generarClasesPendientesGlobales().subscribe({
      next: (r) => {
        this.generandoPendientes.set(false);
        const tipo = r.clasesGeneradas > 0 ? 'ok' : 'info';
        this.flash(r.message, tipo);
        this.cargarRastreo(true);
      },
      error: (e) => {
        this.generandoPendientes.set(false);
        this.flash(e?.error?.message || 'No se pudieron generar las clases pendientes.', 'error');
      },
    });
  }

  cargarTemas() {
    const id = this.progTemasSel();
    if (!id) return;
    this.svc.listarTemas(id).subscribe({
      next: (rows) => this.temas.set(rows),
      error: () => this.flash('No se pudieron cargar los temas', 'error'),
    });
  }

  onProgTemasChange(id: string) {
    this.progTemasSel.set(id);
    this.cancelarEdicionTema();
    this.cargarTemas();
  }

  patchConfigBloque(campo: string, valor: unknown) {
    const bloque = this.bloqueConfig();
    const cfg = this.config();
    if (!cfg) return;
    const next = structuredClone(cfg);
    (next[bloque] as Record<string, unknown>)[campo] = valor;
    this.config.set(next);
  }

  patchConfigSub(bloque: BloqueConfig, sub: string, campo: string, valor: string) {
    const cfg = this.config();
    if (!cfg) return;
    const next = structuredClone(cfg);
    const b = next[bloque] as Record<string, Record<string, string>>;
    b[sub] = { ...(b[sub] || {}), [campo]: valor };
    this.config.set(next);
  }

  toggleDuracion(h: number) {
    const cfg = this.config();
    if (!cfg) return;
    const next = structuredClone(cfg);
    const list = [...(next.vehiculo.duracionesPermitidas || [])];
    const idx = list.indexOf(h);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(h);
    list.sort((a, b) => a - b);
    next.vehiculo.duracionesPermitidas = list.length ? list : [1];
    this.config.set(next);
  }

  duracionActiva(h: number): boolean {
    return (this.config()?.vehiculo?.duracionesPermitidas || []).includes(h);
  }

  patchPlanificacionConfig(campo: 'diasInicioDesdeGeneracion', valor: number) {
    const cfg = this.config();
    if (!cfg) return;
    const next = structuredClone(cfg);
    next.planificacion = { ...(next.planificacion || {}), [campo]: valor };
    this.config.set(next);
  }

  private initPlanFormDesdeConfig(cfg: ConfigProgramacionCea) {
    const progs = this.programas();
    const idProg = this.planForm().idProg || progs[0]?.idProg || '';
    const map = cfg.planificacion?.programasPorPeriodo || {};
    const n = Number(map[idProg]);
    this.planForm.update((f) => ({
      ...f,
      idProg: idProg || f.idProg,
      programasPorPeriodo: Number.isFinite(n) && n >= 1 ? n : f.programasPorPeriodo ?? 1,
    }));
  }

  onPlanProgChange(idProg: string) {
    const cfg = this.config();
    const map = cfg?.planificacion?.programasPorPeriodo || {};
    const n = Number(map[idProg]);
    this.planForm.update((f) => ({
      ...f,
      idProg,
      programasPorPeriodo: Number.isFinite(n) && n >= 1 ? n : 1,
    }));
    this.planPreview.set(null);
    this.cargarRecursosPlan();
  }

  patchPlanForm(campo: keyof PlanificacionCeaBody, valor: unknown) {
    this.planForm.update((f) => ({ ...f, [campo]: valor }));
    this.planPreview.set(null);
    this.planListadoGenerado.set(false);
  }

  onPlanProgramasPorPeriodoChange(val: number) {
    const idProg = this.planForm().idProg;
    this.patchPlanForm('programasPorPeriodo', Math.max(1, Number(val) || 1));
    const cfg = this.config();
    if (!cfg || !idProg) return;
    const next = structuredClone(cfg);
    next.planificacion = {
      ...(next.planificacion || {}),
      programasPorPeriodo: {
        ...(next.planificacion?.programasPorPeriodo || {}),
        [idProg]: Math.max(1, Number(val) || 1),
      },
    };
    this.config.set(next);
  }

  cargarRecursosPlan() {
    const idProg = this.planForm().idProg || this.programas()[0]?.idProg;
    if (!idProg) return;
    this.svc.recursos({ idProg }).subscribe({
      next: (r) => {
        this.recursosPlan.set(r);
        if (!this.planForm().idTaller && r.talleres[0]?.id) {
          this.planForm.update((p) => ({ ...p, idTaller: r.talleres[0].id }));
        }
      },
      error: () => undefined,
    });
  }

  bodyPlanificacion(): PlanificacionCeaBody {
    const f = this.planForm();
    const cfg = this.config();
    return {
      ...f,
      diasInicioDesdeGeneracion: cfg?.planificacion?.diasInicioDesdeGeneracion ?? 5,
    };
  }

  planClasesLista(prev: PlanificacionCeaPreview): ClasePlanificadaFila[] {
    return prev.clases?.length ? prev.clases : prev.muestra ?? [];
  }

  nombreRecursoPlan(id: string | undefined, tipo: 'aula' | 'taller'): string {
    if (!id) return '—';
    const rec = this.recursosPlan();
    if (tipo === 'aula') {
      return rec?.aulas.find((a) => a.id === id)?.nombre || id;
    }
    return rec?.talleres.find((t) => t.id === id)?.nombre || id;
  }

  labelTipoClasePlan(tipo: string): string {
    if (tipo === 'teoria') return 'Teoría';
    if (tipo === 'taller') return 'Taller';
    return tipo;
  }

  previewPlanificacion() {
    if (!this.puedeGestionar()) return;
    this.planListadoGenerado.set(false);
    this.planPreviewLoading.set(true);
    this.svc.previewPlanificacion(this.bodyPlanificacion()).subscribe({
      next: (r) => {
        this.planPreview.set(r);
        this.planPreviewLoading.set(false);
      },
      error: (e) => {
        this.planPreviewLoading.set(false);
        this.flash(e?.error?.message || 'No se pudo calcular la vista previa', 'error');
      },
    });
  }

  generarPlanificacion() {
    if (!this.puedeGestionar() || this.planGenerando()) return;
    this.planGenerando.set(true);
    this.svc.generarPlanificacion(this.bodyPlanificacion()).subscribe({
      next: (r) => {
        this.planGenerando.set(false);
        this.planPreview.set(r);
        this.planListadoGenerado.set(true);
        this.flash(r.message || `Se generaron ${r.clasesGeneradas ?? 0} clase(s).`, r.clasesGeneradas ? 'ok' : 'info');
        setTimeout(() => this.planResultadoRef?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
      },
      error: (e) => {
        this.planGenerando.set(false);
        this.flash(e?.error?.message || 'Error al generar clases', 'error');
      },
    });
  }

  guardarConfig() {
    const cfg = this.config();
    if (!cfg || !this.puedeGestionar()) return;
    this.saving.set(true);
    this.svc.guardarConfig(cfg).subscribe({
      next: (c) => {
        this.config.set(c);
        this.flash('Configuración guardada', 'ok');
        this.saving.set(false);
      },
      error: (e) => {
        this.flash(e?.error?.message || 'Error al guardar', 'error');
        this.saving.set(false);
      },
    });
  }

  patchTema(campo: keyof TemaProgramaCeaDto, valor: unknown) {
    this.formTema.update((f) => ({ ...f, [campo]: valor }));
  }

  editarTema(t: TemaProgramaCeaDto) {
    this.editTemaId.set(t._id || null);
    this.formTema.set({ ...t });
  }

  cancelarEdicionTema() {
    this.editTemaId.set(null);
    this.formTema.set({ tipo: 'teoria', orden: 1, activo: true });
  }

  guardarTema() {
    if (!this.puedeGestionar()) {
      this.flash('No tiene permiso para gestionar temas del programa', 'error');
      return;
    }
    const idProg = this.progTemasSel();
    const f = this.formTema();
    if (!idProg) {
      this.flash('Seleccione un programa CEA', 'error');
      return;
    }
    if (!f.nombre?.trim()) {
      this.flash('Indique el nombre del tema', 'error');
      return;
    }
    let horasTema: number | null = null;
    if (f.horasTema != null && `${f.horasTema}`.trim() !== '') {
      const h = Number(f.horasTema);
      if (Number.isFinite(h) && h >= 0) horasTema = h;
    }
    const tipo = f.tipo === 'taller' ? 'taller' : 'teoria';
    const errHoras = this.validarHorasTemaEnFormulario(tipo, horasTema);
    if (errHoras) {
      this.flash(errHoras, 'error');
      return;
    }
    const payload: Partial<TemaProgramaCeaDto> = {
      tipo,
      nombre: f.nombre.trim(),
      orden: Number(f.orden) > 0 ? Number(f.orden) : 1,
      horasTema,
      activo: f.activo !== false,
    };
    this.saving.set(true);
    const editId = this.editTemaId();
    const req = editId
      ? this.svc.actualizarTema(editId, payload)
      : this.svc.crearTema(idProg, payload);
    req.subscribe({
      next: () => {
        this.cancelarEdicionTema();
        this.cargarTemas();
        this.flash(editId ? 'Tema actualizado' : 'Tema creado', 'ok');
        this.saving.set(false);
      },
      error: (e) => {
        this.flash(e?.error?.message || 'Error al guardar tema', 'error');
        this.saving.set(false);
      },
    });
  }

  async eliminarTema(t: TemaProgramaCeaDto) {
    if (!t._id) return;
    const ok = await this.confirm.open({
      title: 'Eliminar tema',
      message: `¿Eliminar «${t.nombre}»?`,
      variant: 'danger',
    });
    if (!ok) return;
    this.svc.eliminarTema(t._id).subscribe({
      next: () => {
        this.cargarTemas();
        this.flash('Tema eliminado', 'ok');
      },
      error: (e) => this.flash(e?.error?.message || 'No se pudo eliminar', 'error'),
    });
  }

  irAlumno(f: FilaRastreoCea) {
    void this.router.navigate(['/app/alumnos', f.numDoc]);
  }

  temasTeoria = computed(() => this.temas().filter((t) => t.tipo === 'teoria'));
  temasTaller = computed(() => this.temas().filter((t) => t.tipo === 'taller'));

  progSelInfo = computed(() => this.programas().find((p) => p.idProg === this.progTemasSel()));

  resumenHorasTeoria = computed(() => this.buildResumenHoras('teoria'));
  resumenHorasTaller = computed(() => this.buildResumenHoras('taller'));

  excedeHorasFormulario = computed(() => {
    const resumen = this.formTema().tipo === 'taller' ? this.resumenHorasTaller() : this.resumenHorasTeoria();
    return resumen.excede;
  });

  maxHorasFormulario = computed(() => {
    const resumen = this.formTema().tipo === 'taller' ? this.resumenHorasTaller() : this.resumenHorasTeoria();
    if (resumen.limite <= 0) return null;
    return Math.max(0, resumen.limite - resumen.usado);
  });

  private buildResumenHoras(tipo: 'teoria' | 'taller') {
    const prog = this.progSelInfo();
    const limite = tipo === 'taller' ? Number(prog?.horasTaller) || 0 : Number(prog?.horasTeoria) || 0;
    const usado = this.sumHorasTemas(tipo, this.editTemaId());
    const form = this.formTema();
    const borrador = form.tipo === tipo ? this.parseHorasTema(form.horasTema) : 0;
    const proyectado = usado + borrador;
    const restante = Math.max(0, limite - proyectado);
    const pct = limite > 0 ? Math.min(100, Math.round((proyectado / limite) * 100)) : 0;
    return {
      limite,
      usado,
      borrador,
      proyectado,
      restante,
      pct,
      excede: limite > 0 && proyectado > limite + 0.001,
      completo: limite > 0 && proyectado >= limite - 0.001 && !this.excedeHorasEnResumen(limite, proyectado),
    };
  }

  private excedeHorasEnResumen(limite: number, proyectado: number): boolean {
    return limite > 0 && proyectado > limite + 0.001;
  }

  private sumHorasTemas(tipo: 'teoria' | 'taller', excludeId: string | null = null): number {
    return this.temas()
      .filter((t) => t.tipo === tipo && t.activo !== false && String(t._id || '') !== String(excludeId || ''))
      .reduce((acc, t) => acc + (Number(t.horasTema) || 0), 0);
  }

  private parseHorasTema(val: unknown): number {
    if (val == null || `${val}`.trim() === '') return 0;
    const h = Number(val);
    return Number.isFinite(h) && h > 0 ? h : 0;
  }

  fmtHoras(n: number): string {
    if (!Number.isFinite(n)) return '0';
    return Math.abs(n - Math.round(n)) < 0.001 ? String(Math.round(n)) : n.toFixed(1);
  }

  private validarHorasTemaEnFormulario(tipo: 'teoria' | 'taller', horasTema: number | null): string | null {
    const resumen = tipo === 'taller' ? this.resumenHorasTaller() : this.resumenHorasTeoria();
    if (resumen.limite <= 0) return null;
    if (horasTema == null || horasTema <= 0) {
      return `Indique las horas del tema (tope del programa: ${this.fmtHoras(resumen.limite)} h de ${tipo === 'taller' ? 'taller' : 'teoría'})`;
    }
    if (resumen.excede) {
      return `Supera el tope de ${tipo === 'taller' ? 'taller' : 'teoría'}: ${this.fmtHoras(resumen.proyectado)} h de ${this.fmtHoras(resumen.limite)} h`;
    }
    return null;
  }

  private flash(texto: string, tipo: 'ok' | 'error' | 'info') {
    this.msg.set(texto);
    this.msgTipo.set(tipo);
    window.setTimeout(() => this.msg.set(null), 5000);
  }
}
