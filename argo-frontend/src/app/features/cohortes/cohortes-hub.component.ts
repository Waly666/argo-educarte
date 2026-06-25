import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import {
  CohorteService,
  Cohorte,
  CatalogoMateria,
  CriterioNota,
  EsquemaNotasPrograma,
  InstructorCohorte,
  MateriaPlan,
  PlanPrograma,
  ProgramaCohorte,
  SemestrePlan,
  PreguntaBanco,
} from '../../core/services/cohorte.service';
import { PermisoService } from '../../core/services/permiso.service';
import {
  CatalogoEnumBuscarComponent,
  EnumBuscarOption,
} from '../../shared/catalogo-enum-buscar/catalogo-enum-buscar.component';

type Tab = 'plan' | 'cohortes' | 'banco' | 'catalogo' | 'esquema';

@Component({
  selector: 'argo-cohortes-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CatalogoEnumBuscarComponent],
  templateUrl: './cohortes-hub.component.html',
  styleUrls: ['./cohortes-hub.component.scss'],
})
export class CohortesHubComponent implements OnInit {
  private svc = inject(CohorteService);
  private permisoSvc = inject(PermisoService);
  private router = inject(Router);

  tab = signal<Tab>('plan');
  loading = signal(false);
  msg = signal<string | null>(null);
  msgError = signal<string | null>(null);

  programas = signal<ProgramaCohorte[]>([]);
  idProgSel = signal<string>('');

  plan = signal<PlanPrograma | null>(null);
  savingPlan = signal(false);

  // Esquema de notas (por programa)
  esquema = signal<EsquemaNotasPrograma | null>(null);
  savingEsquema = signal(false);

  // Cohortes
  cohortes = signal<Cohorte[]>([]);
  instructores = signal<InstructorCohorte[]>([]);
  nuevaCohorte = signal<{
    idProg: string;
    numSemestre: number;
    anio: number;
    periodo: number;
    nombre: string;
    cupoMaximo: number | null;
    modoConsumoHoras: string;
    idEmpleadoInstructor: number | null;
  }>({
    idProg: '',
    numSemestre: 1,
    anio: new Date().getFullYear(),
    periodo: 1,
    nombre: '',
    cupoMaximo: null,
    modoConsumoHoras: 'AL_ASISTIR',
    idEmpleadoInstructor: null,
  });

  // Catálogo (banco) de materias
  catalogoMaterias = signal<CatalogoMateria[]>([]);
  nuevaMateriaCat = signal<{ nombre: string; area: string; descripcion: string }>({
    nombre: '',
    area: '',
    descripcion: '',
  });

  // Banco de preguntas (por materia del catálogo)
  banco = signal<PreguntaBanco[]>([]);
  bancoMateriaCat = signal<string>('');
  /** null = creando; con id = editando esa pregunta */
  preguntaEditandoId = signal<string | null>(null);
  nuevaPregunta = signal<PreguntaBanco>({
    enunciado: '',
    tipo: 'UNICA',
    opciones: [
      { texto: '', correcta: false },
      { texto: '', correcta: false },
    ],
    dificultad: 1,
  });

  puedeGestionar = computed(() => this.permisoSvc.tiene('cohortes_academicas.gestionar'));

  /** Opciones del combobox de materias (catálogo global). */
  opcionesMateriaCatalogo = computed<EnumBuscarOption[]>(() =>
    this.catalogoMaterias().map((m) => ({ value: m._id, label: m.nombre, hint: m.area || undefined })),
  );

  sumaCriterios = computed(() =>
    (this.esquema()?.criterios || []).reduce((acc, c) => acc + (Number(c.pesoPct) || 0), 0),
  );

  esquemaValido = computed(() => {
    const e = this.esquema();
    if (!e?.criterios?.length) return false;
    if (this.sumaCriterios() !== 100) return false;
    const cfg = e.configEvaluaciones;
    return (Number(cfg.pesoParcialesPct) || 0) + (Number(cfg.pesoFinalPct) || 0) === 100;
  });

  ngOnInit(): void {
    this.cargarProgramas();
    this.cargarCohortes();
    this.cargarCatalogo();
    this.svc.instructores().subscribe({
      next: (rows) => this.instructores.set(rows),
      error: () => this.instructores.set([]),
    });
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    this.msg.set(null);
    this.msgError.set(null);
    if (t === 'banco') this.cargarBanco();
    if (t === 'catalogo') this.cargarCatalogo();
    if (t === 'esquema') this.cargarEsquema();
  }

  cargarProgramas(): void {
    this.svc.programas().subscribe({
      next: (rows) => {
        this.programas.set(rows);
        if (!this.idProgSel() && rows.length) {
          this.idProgSel.set(rows[0].idProg);
          this.cargarPlan();
        }
      },
      error: () => this.programas.set([]),
    });
  }

  /* ---------------- Plan ---------------- */

  onProgramaChange(id: string): void {
    this.idProgSel.set(id);
    this.cargarPlan();
    if (this.tab() === 'esquema') this.cargarEsquema();
  }

  cargarPlan(): void {
    const id = this.idProgSel();
    if (!id) return;
    this.loading.set(true);
    this.msg.set(null);
    this.msgError.set(null);
    this.svc.obtenerPlan(id).subscribe({
      next: (p) => {
        this.plan.set(p);
        this.loading.set(false);
      },
      error: (e) => {
        this.msgError.set(e?.error?.message || 'No se pudo cargar el plan');
        this.loading.set(false);
      },
    });
  }

  sumaMaterias(sem: SemestrePlan): number {
    return (sem.materias || []).reduce((acc, m) => acc + (Number(m.horas) || 0), 0);
  }

  semestreValido(sem: SemestrePlan): boolean {
    if (!sem.materias?.length) return true;
    return this.sumaMaterias(sem) === (Number(sem.horas) || 0);
  }

  /** Horas que faltan (+) o sobran (-) respecto al total del semestre. */
  diferenciaHoras(sem: SemestrePlan): number {
    return (Number(sem.horas) || 0) - this.sumaMaterias(sem);
  }

  estadoHoras(sem: SemestrePlan): 'exacto' | 'faltan' | 'sobran' | 'vacio' {
    if (!sem.materias?.length) return 'vacio';
    const dif = this.diferenciaHoras(sem);
    if (dif === 0) return 'exacto';
    return dif > 0 ? 'faltan' : 'sobran';
  }

  pctSemestre(sem: SemestrePlan): number {
    const total = Number(sem.horas) || 0;
    if (total <= 0) return 0;
    return Math.min(100, Math.round((this.sumaMaterias(sem) / total) * 100));
  }

  programaSel(): ProgramaCohorte | undefined {
    return this.programas().find((p) => p.idProg === this.idProgSel());
  }

  totalMaterias(): number {
    const p = this.plan();
    if (!p) return 0;
    return p.semestres.reduce((acc, s) => acc + (s.materias?.length || 0), 0);
  }

  planValido(): boolean {
    const p = this.plan();
    if (!p) return false;
    return p.semestres.every((s) => this.semestreValido(s));
  }

  agregarMateria(sem: SemestrePlan): void {
    sem.materias = [...(sem.materias || []), { idMateriaCatalogo: null, nombre: '', horas: 0, activo: true }];
    this.plan.set({ ...this.plan()! });
  }

  quitarMateria(sem: SemestrePlan, idx: number): void {
    sem.materias.splice(idx, 1);
    this.plan.set({ ...this.plan()! });
  }

  onMateriaPlanPick(m: MateriaPlan, opt: EnumBuscarOption): void {
    m.idMateriaCatalogo = String(opt.value);
    m.nombre = opt.label;
    this.plan.set({ ...this.plan()! });
  }

  onMateriaPlanLimpiar(m: MateriaPlan): void {
    m.idMateriaCatalogo = null;
    m.nombre = '';
    this.plan.set({ ...this.plan()! });
  }

  guardarPlan(): void {
    const p = this.plan();
    if (!p) return;
    if (!this.planValido()) {
      this.msgError.set('Las materias de cada semestre deben sumar exactamente las horas del semestre.');
      return;
    }
    this.savingPlan.set(true);
    this.msg.set(null);
    this.msgError.set(null);
    this.svc.guardarPlan(p.idProg, p.semestres).subscribe({
      next: (res) => {
        this.plan.set(res);
        this.savingPlan.set(false);
        this.msg.set('Plan guardado correctamente.');
      },
      error: (e) => {
        this.msgError.set(e?.error?.message || 'No se pudo guardar el plan');
        this.savingPlan.set(false);
      },
    });
  }

  /* ---------------- Esquema de notas ---------------- */

  cargarEsquema(): void {
    const id = this.idProgSel();
    if (!id) return;
    this.loading.set(true);
    this.msg.set(null);
    this.msgError.set(null);
    this.svc.obtenerEsquemaNotas(id).subscribe({
      next: (e) => {
        this.esquema.set(e);
        this.loading.set(false);
      },
      error: (err) => {
        this.msgError.set(err?.error?.message || 'No se pudo cargar el esquema de notas');
        this.loading.set(false);
      },
    });
  }

  patchEsquema(partial: Partial<EsquemaNotasPrograma>): void {
    const e = this.esquema();
    if (!e) return;
    this.esquema.set({ ...e, ...partial });
  }

  patchCriterioEsquema(idx: number, field: keyof CriterioNota, value: unknown): void {
    const e = this.esquema();
    if (!e) return;
    const criterios = [...e.criterios];
    criterios[idx] = { ...criterios[idx], [field]: value };
    this.esquema.set({ ...e, criterios });
  }

  agregarCriterioEsquema(): void {
    const e = this.esquema();
    if (!e) return;
    const orden = (e.criterios?.length || 0) + 1;
    this.esquema.set({
      ...e,
      criterios: [...e.criterios, { nombre: '', pesoPct: 0, tipo: 'MANUAL', orden }],
    });
  }

  eliminarCriterioEsquema(idx: number): void {
    const e = this.esquema();
    if (!e || e.criterios.length <= 1) return;
    const criterios = e.criterios.filter((_, i) => i !== idx);
    this.esquema.set({ ...e, criterios });
  }

  patchConfigEval(field: keyof EsquemaNotasPrograma['configEvaluaciones'], value: unknown): void {
    const e = this.esquema();
    if (!e) return;
    this.esquema.set({
      ...e,
      configEvaluaciones: { ...e.configEvaluaciones, [field]: value },
    });
  }

  guardarEsquema(): void {
    const e = this.esquema();
    if (!e) return;
    if (!this.esquemaValido()) {
      this.msgError.set('Los criterios deben sumar 100% y parciales + final también 100%.');
      return;
    }
    this.savingEsquema.set(true);
    this.msg.set(null);
    this.msgError.set(null);
    this.svc.guardarEsquemaNotas(e.idProg, e).subscribe({
      next: (res) => {
        this.esquema.set(res);
        this.savingEsquema.set(false);
        this.msg.set('Esquema de notas guardado. Todas las cohortes de este programa lo heredan.');
      },
      error: (err) => {
        this.msgError.set(err?.error?.message || 'No se pudo guardar el esquema');
        this.savingEsquema.set(false);
      },
    });
  }

  /* ---------------- Cohortes ---------------- */

  cargarCohortes(): void {
    this.svc.listarCohortes().subscribe({
      next: (rows) => this.cohortes.set(rows),
      error: () => this.cohortes.set([]),
    });
  }

  patchNueva<K extends keyof ReturnType<typeof this.nuevaCohorte>>(
    k: K,
    v: ReturnType<typeof this.nuevaCohorte>[K],
  ): void {
    this.nuevaCohorte.update((n) => ({ ...n, [k]: v }));
  }

  semestresDisponibles(): number[] {
    const prog = this.programas().find((p) => p.idProg === this.nuevaCohorte().idProg);
    const n = prog?.semestres || 1;
    return Array.from({ length: n }, (_, i) => i + 1);
  }

  crearCohorte(): void {
    const n = this.nuevaCohorte();
    if (!n.idProg) {
      this.msgError.set('Seleccione un programa.');
      return;
    }
    this.msg.set(null);
    this.msgError.set(null);
    this.svc
      .crearCohorte({
        idProg: n.idProg,
        numSemestre: n.numSemestre,
        anio: n.anio,
        periodo: n.periodo,
        nombre: n.nombre,
        cupoMaximo: n.cupoMaximo,
        modoConsumoHoras: n.modoConsumoHoras,
        idEmpleadoInstructor: n.idEmpleadoInstructor,
      })
      .subscribe({
        next: () => {
          this.msg.set('Cohorte creada.');
          this.cargarCohortes();
          this.patchNueva('nombre', '');
        },
        error: (e) => this.msgError.set(e?.error?.message || 'No se pudo crear la cohorte'),
      });
  }

  abrirCohorte(c: Cohorte): void {
    this.router.navigate(['/app/cohortes', c._id]);
  }

  /* ---------------- Catálogo (banco) de materias ---------------- */

  cargarCatalogo(): void {
    this.svc.listarCatalogoMaterias().subscribe({
      next: (rows) => this.catalogoMaterias.set(rows),
      error: () => this.catalogoMaterias.set([]),
    });
  }

  patchNuevaMateriaCat<K extends keyof ReturnType<typeof this.nuevaMateriaCat>>(
    k: K,
    v: ReturnType<typeof this.nuevaMateriaCat>[K],
  ): void {
    this.nuevaMateriaCat.update((n) => ({ ...n, [k]: v }));
  }

  crearMateriaCatalogo(): void {
    const n = this.nuevaMateriaCat();
    if (!n.nombre.trim()) {
      this.msgError.set('Escribe el nombre de la materia.');
      return;
    }
    this.msg.set(null);
    this.msgError.set(null);
    this.svc.crearMateriaCatalogo({ nombre: n.nombre.trim(), area: n.area.trim(), descripcion: n.descripcion.trim() }).subscribe({
      next: () => {
        this.msg.set('Materia agregada al catálogo.');
        this.nuevaMateriaCat.set({ nombre: '', area: '', descripcion: '' });
        this.cargarCatalogo();
      },
      error: (e) => this.msgError.set(e?.error?.message || 'No se pudo crear la materia'),
    });
  }

  eliminarMateriaCatalogo(m: CatalogoMateria): void {
    if (!confirm(`¿Eliminar "${m.nombre}" del catálogo? Si está en uso solo se desactivará.`)) return;
    this.svc.eliminarMateriaCatalogo(m._id).subscribe({
      next: (r) => {
        this.msg.set(r.desactivada ? 'Materia desactivada (estaba en uso).' : 'Materia eliminada.');
        this.cargarCatalogo();
      },
      error: (e) => this.msgError.set(e?.error?.message || 'No se pudo eliminar'),
    });
  }

  /* ---------------- Banco de preguntas ---------------- */

  cargarBanco(): void {
    const idMat = this.bancoMateriaCat();
    if (!idMat) {
      this.banco.set([]);
      return;
    }
    this.svc.listarBanco({ idMateriaCatalogo: idMat }).subscribe({
      next: (rows) => this.banco.set(rows),
      error: () => this.banco.set([]),
    });
  }

  onBancoFiltroChange(): void {
    this.cargarBanco();
  }

  patchPregunta<K extends keyof PreguntaBanco>(k: K, v: PreguntaBanco[K]): void {
    this.nuevaPregunta.update((p) => ({ ...p, [k]: v }));
  }

  agregarOpcion(): void {
    this.nuevaPregunta.update((p) => ({ ...p, opciones: [...p.opciones, { texto: '', correcta: false }] }));
  }

  quitarOpcion(idx: number): void {
    this.nuevaPregunta.update((p) => {
      const opciones = [...p.opciones];
      opciones.splice(idx, 1);
      return { ...p, opciones };
    });
  }

  marcarCorrecta(idx: number): void {
    this.nuevaPregunta.update((p) => {
      const unica = p.tipo !== 'MULTIPLE';
      const opciones = p.opciones.map((o, i) => ({
        ...o,
        correcta: unica ? i === idx : i === idx ? !o.correcta : o.correcta,
      }));
      return { ...p, opciones };
    });
  }

  private resetFormPregunta(): void {
    this.preguntaEditandoId.set(null);
    this.nuevaPregunta.set({
      enunciado: '',
      tipo: 'UNICA',
      opciones: [
        { texto: '', correcta: false },
        { texto: '', correcta: false },
      ],
      dificultad: 1,
    });
  }

  editarPregunta(q: PreguntaBanco): void {
    if (!q._id) return;
    this.preguntaEditandoId.set(q._id);
    this.nuevaPregunta.set({
      enunciado: q.enunciado,
      tipo: q.tipo,
      opciones: (q.opciones || []).map((o) => ({ ...o })),
      dificultad: q.dificultad ?? 1,
    });
    this.msg.set(null);
    this.msgError.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicionPregunta(): void {
    this.resetFormPregunta();
  }

  guardarPregunta(): void {
    const idMat = this.bancoMateriaCat();
    const p = this.nuevaPregunta();
    const editId = this.preguntaEditandoId();
    if (!idMat) {
      this.msgError.set('Selecciona una materia del catálogo.');
      return;
    }
    if (!p.enunciado.trim()) {
      this.msgError.set('Escribe el enunciado.');
      return;
    }
    const opciones = p.opciones.filter((o) => o.texto.trim());
    if (opciones.length < 2) {
      this.msgError.set('Agrega al menos dos opciones.');
      return;
    }
    if (!opciones.some((o) => o.correcta)) {
      this.msgError.set('Marca al menos una opción correcta.');
      return;
    }
    this.msg.set(null);
    this.msgError.set(null);
    const dto = {
      idMateriaCatalogo: idMat,
      enunciado: p.enunciado,
      tipo: p.tipo,
      opciones,
      dificultad: p.dificultad,
    };
    const req = editId
      ? this.svc.actualizarPregunta(editId, dto)
      : this.svc.crearPregunta(dto);
    req.subscribe({
      next: () => {
        this.msg.set(editId ? 'Pregunta actualizada.' : 'Pregunta agregada al banco.');
        this.resetFormPregunta();
        this.cargarBanco();
      },
      error: (e) => this.msgError.set(e?.error?.message || 'No se pudo guardar la pregunta'),
    });
  }

  eliminarPregunta(p: PreguntaBanco): void {
    if (!p._id) return;
    if (!confirm('¿Eliminar esta pregunta del banco?')) return;
    this.svc.eliminarPregunta(p._id).subscribe({
      next: () => {
        this.msg.set('Pregunta eliminada.');
        if (this.preguntaEditandoId() === p._id) this.resetFormPregunta();
        this.cargarBanco();
      },
      error: (e) => this.msgError.set(e?.error?.message || 'No se pudo eliminar'),
    });
  }
}
