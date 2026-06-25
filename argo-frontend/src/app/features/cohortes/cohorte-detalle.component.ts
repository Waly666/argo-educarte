import { CommonModule } from '@angular/common';
import { ArgoDateInputComponent } from '../../shared/argo-date-input/argo-date-input.component';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  CohorteService,
  CohorteDetalle,
  AsistenciaClase,
  AsistenciaAlumno,
  InstructorCohorte,
  EvaluacionResumen,
  EvaluacionDto,
  PreguntaBanco,
  PreguntaEval,
  MaterialCohorte,
  ResultadoEvaluacion,
  ElegibilidadCertificado,
  ActaNotas,
  ReporteAsistencia,
  CriteriosCertificado,
  MatrizNotasCriterio,
} from '../../core/services/cohorte.service';

type SeccionCohorte = 'operacion' | 'evaluaciones' | 'notas' | 'materiales' | 'certificado';
import { PermisoService } from '../../core/services/permiso.service';

@Component({
  selector: 'argo-cohorte-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink,
    ArgoDateInputComponent,
  ],
  templateUrl: './cohorte-detalle.component.html',
  styleUrls: ['./cohortes-hub.component.scss', './cohorte-detalle.component.scss'],
})
export class CohorteDetalleComponent implements OnInit {
  private svc = inject(CohorteService);
  private route = inject(ActivatedRoute);
  private permisoSvc = inject(PermisoService);

  id = '';
  cohorte = signal<CohorteDetalle | null>(null);
  loading = signal(false);
  msg = signal<string | null>(null);
  msgError = signal<string | null>(null);

  // Inscripción
  docInscribir = signal('');

  instructores = signal<InstructorCohorte[]>([]);

  // Clase manual
  nuevaClase = signal<{
    idMateria: string;
    fechaClase: string;
    horaDesde: string;
    horaHasta: string;
    urlMeet: string;
    idEmpleadoInstructor: number | null;
  }>({
    idMateria: '',
    fechaClase: '',
    horaDesde: '08:00',
    horaHasta: '10:00',
    urlMeet: '',
    idEmpleadoInstructor: null,
  });

  // Asistente de planificación
  planif = signal<{ fechaInicio: string; horaDesde: string; horaHasta: string; horasPorSesion: number }>({
    fechaInicio: '',
    horaDesde: '08:00',
    horaHasta: '10:00',
    horasPorSesion: 2,
  });

  // Asistencia
  asistenciaAbierta = signal<AsistenciaClase | null>(null);
  guardandoAsist = signal(false);

  // ----- Fase 2 -----
  seccion = signal<SeccionCohorte>('operacion');

  // Evaluaciones
  evaluaciones = signal<EvaluacionResumen[]>([]);
  bancoDisponible = signal<PreguntaBanco[]>([]);
  mostrarFormEval = signal(false);
  /** null = creando; con id = editando */
  evalEditandoId = signal<string | null>(null);
  evalEditandoEstado = signal<EvaluacionResumen['estado'] | null>(null);
  nuevaEval = signal<{
    idMateria: string;
    titulo: string;
    descripcion: string;
    modoPreguntas: 'MANUAL' | 'BANCO_ALEATORIO';
    tipoEvaluacion: 'PARCIAL' | 'FINAL' | 'GENERAL';
    numPreguntasBanco: number;
    notaAprobacion: number;
    pesoNota: number;
    intentosPermitidos: number;
    duracionMin: number;
    fechaApertura: string;
    fechaCierre: string;
  }>({
    idMateria: '',
    titulo: '',
    descripcion: '',
    modoPreguntas: 'BANCO_ALEATORIO',
    tipoEvaluacion: 'PARCIAL',
    numPreguntasBanco: 5,
    notaAprobacion: 60,
    pesoNota: 100,
    intentosPermitidos: 1,
    duracionMin: 0,
    fechaApertura: '',
    fechaCierre: '',
  });
  seleccionadasBanco = signal<Set<string>>(new Set());
  resultados = signal<ResultadoEvaluacion | null>(null);

  // Notas manuales por criterio
  notasMateriaSel = signal('');
  matrizNotas = signal<MatrizNotasCriterio | null>(null);
  cargandoMatriz = signal(false);
  guardandoNotas = signal(false);

  // Materiales
  materiales = signal<MaterialCohorte[]>([]);
  nuevoMaterial = signal<{ idMateria: string; titulo: string; tipo: MaterialCohorte['tipo']; url: string; descripcion: string }>({
    idMateria: '',
    titulo: '',
    tipo: 'ENLACE',
    url: '',
    descripcion: '',
  });

  // Certificado / actas
  criterios = signal<CriteriosCertificado>({
    minAsistenciaPct: 80,
    minNotaPromedio: 60,
    requiereTodasMaterias: true,
    requiereEvaluaciones: false,
  });
  guardandoCriterios = signal(false);
  elegibilidad = signal<ElegibilidadCertificado | null>(null);
  acta = signal<ActaNotas | null>(null);
  reporteAsis = signal<ReporteAsistencia | null>(null);
  vistaCert = signal<'criterios' | 'elegibilidad' | 'acta' | 'asistencia'>('criterios');

  puedeGestionar = computed(() => this.permisoSvc.tiene('cohortes_academicas.gestionar'));
  puedeOperar = computed(() => this.permisoSvc.tiene(['cohortes_academicas.operar', 'cohortes_academicas.gestionar']));
  /** Publicada: solo fechas, título y criterios (las preguntas ya están fijadas). */
  evalEdicionLimitada = computed(() => this.evalEditandoEstado() === 'PUBLICADA');
  evalEsEdicion = computed(() => !!this.evalEditandoId());

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.cargar();
    this.svc.instructores().subscribe({
      next: (rows) => this.instructores.set(rows),
      error: () => this.instructores.set([]),
    });
  }

  cargar(): void {
    this.loading.set(true);
    this.svc.detalle(this.id).subscribe({
      next: (c) => {
        this.cohorte.set(c);
        if (this.nuevaClase().idEmpleadoInstructor == null && c.idEmpleadoInstructor != null) {
          this.patchClase('idEmpleadoInstructor', c.idEmpleadoInstructor);
        }
        if (c.criteriosCertificado) this.criterios.set({ ...this.criterios(), ...c.criteriosCertificado });
        this.loading.set(false);
      },
      error: (e) => {
        this.msgError.set(e?.error?.message || 'No se pudo cargar la cohorte');
        this.loading.set(false);
      },
    });
  }

  private flash(ok?: string, err?: string): void {
    this.msg.set(ok || null);
    this.msgError.set(err || null);
  }

  /* -------- Inscripción -------- */
  inscribir(): void {
    const doc = this.docInscribir().trim();
    if (!doc) return;
    this.svc.inscribir(this.id, doc).subscribe({
      next: (r) => {
        this.flash(`Inscrito: ${r.nombreCompleto}`);
        this.docInscribir.set('');
        this.cargar();
      },
      error: (e) => this.flash(undefined, e?.error?.message || 'No se pudo inscribir'),
    });
  }

  /* -------- Clase manual -------- */
  patchClase<K extends keyof ReturnType<typeof this.nuevaClase>>(k: K, v: ReturnType<typeof this.nuevaClase>[K]): void {
    this.nuevaClase.update((n) => ({ ...n, [k]: v }));
  }

  crearClase(): void {
    const n = this.nuevaClase();
    if (!n.idMateria || !n.fechaClase) {
      this.flash(undefined, 'Seleccione materia y fecha.');
      return;
    }
    this.svc
      .crearClase(this.id, {
        idMateria: n.idMateria,
        fechaClase: n.fechaClase,
        horaDesde: n.horaDesde,
        horaHasta: n.horaHasta,
        urlMeet: n.urlMeet,
        idEmpleadoInstructor: n.idEmpleadoInstructor,
      })
      .subscribe({
        next: () => {
          this.flash('Clase programada.');
          this.patchClase('urlMeet', '');
          this.cargar();
        },
        error: (e) => this.flash(undefined, e?.error?.message || 'No se pudo crear la clase'),
      });
  }

  cambiarInstructorClase(idClase: string, valor: string): void {
    const idEmpleadoInstructor = valor ? Number(valor) : null;
    this.svc.actualizarClase(idClase, { idEmpleadoInstructor }).subscribe({
      next: () => {
        this.flash('Instructor actualizado.');
        this.cargar();
      },
      error: (e) => this.flash(undefined, e?.error?.message || 'No se pudo cambiar el instructor'),
    });
  }

  /* -------- Asistente -------- */
  patchPlanif<K extends keyof ReturnType<typeof this.planif>>(k: K, v: ReturnType<typeof this.planif>[K]): void {
    this.planif.update((n) => ({ ...n, [k]: v }));
  }

  planificar(): void {
    const p = this.planif();
    this.svc
      .planificar(this.id, {
        fechaInicio: p.fechaInicio || undefined,
        horaDesde: p.horaDesde,
        horaHasta: p.horaHasta,
        horasPorSesion: p.horasPorSesion,
      })
      .subscribe({
        next: (r) => {
          this.flash(`Se generaron ${r.clasesGeneradas} clases.`);
          this.cargar();
        },
        error: (e) => this.flash(undefined, e?.error?.message || 'No se pudo planificar'),
      });
  }

  /* -------- Asistencia -------- */
  abrirAsistencia(idClase: string): void {
    this.svc.asistencia(idClase).subscribe({
      next: (a) => this.asistenciaAbierta.set(a),
      error: (e) => this.flash(undefined, e?.error?.message || 'No se pudo abrir asistencia'),
    });
  }

  cerrarAsistencia(): void {
    this.asistenciaAbierta.set(null);
  }

  setEstadoAlumno(al: AsistenciaAlumno, estado: string): void {
    al.estado = estado;
    this.asistenciaAbierta.set({ ...this.asistenciaAbierta()! });
  }

  marcarTodos(estado: string): void {
    const a = this.asistenciaAbierta();
    if (!a) return;
    a.alumnos.forEach((al) => (al.estado = estado));
    this.asistenciaAbierta.set({ ...a });
  }

  contarPresentes(): number {
    return (this.asistenciaAbierta()?.alumnos || []).filter((a) => a.estado === 'PRESENTE').length;
  }

  // Estado de los pasos guiados
  hayInscritos(): boolean {
    return (this.cohorte()?.inscripciones?.length || 0) > 0;
  }
  hayMaterias(): boolean {
    return (this.cohorte()?.materias?.length || 0) > 0;
  }
  hayClases(): boolean {
    return (this.cohorte()?.clases?.length || 0) > 0;
  }

  guardarAsistencia(): void {
    const a = this.asistenciaAbierta();
    if (!a) return;
    this.guardandoAsist.set(true);
    this.svc
      .registrarAsistencia(
        a.idClase,
        a.alumnos.map((al) => ({ numDoc: al.numDoc, estado: al.estado, nota: al.nota ?? null })),
      )
      .subscribe({
        next: () => {
          this.guardandoAsist.set(false);
          this.flash('Asistencia guardada.');
          this.cerrarAsistencia();
          this.cargar();
        },
        error: (e) => {
          this.guardandoAsist.set(false);
          this.flash(undefined, e?.error?.message || 'No se pudo guardar la asistencia');
        },
      });
  }

  /* ================= Fase 2 ================= */

  irSeccion(s: SeccionCohorte): void {
    this.seccion.set(s);
    this.flash();
    if (s === 'evaluaciones') this.cargarEvaluaciones();
    if (s === 'materiales') this.cargarMateriales();
    if (s === 'notas') this.prepararNotasManuales();
  }

  private prepararNotasManuales(): void {
    const mats = this.cohorte()?.materias || [];
    if (!this.notasMateriaSel() && mats.length) {
      this.notasMateriaSel.set(mats[0]._id || '');
    }
    if (this.notasMateriaSel()) this.cargarMatrizNotas();
  }

  onNotasMateriaChange(idMateria: string): void {
    this.notasMateriaSel.set(idMateria);
    this.cargarMatrizNotas();
  }

  cargarMatrizNotas(): void {
    const idMat = this.notasMateriaSel();
    if (!idMat) {
      this.matrizNotas.set(null);
      return;
    }
    this.cargandoMatriz.set(true);
    this.svc.matrizNotasCriterio(this.id, idMat).subscribe({
      next: (m) => {
        this.matrizNotas.set(m);
        this.cargandoMatriz.set(false);
      },
      error: (e) => {
        this.flash(undefined, e?.error?.message || 'No se pudo cargar la matriz de notas');
        this.matrizNotas.set(null);
        this.cargandoMatriz.set(false);
      },
    });
  }

  esquemaNotasSinGuardar(): boolean {
    return (this.matrizNotas()?.criterios || []).some((c) => String(c._id || '').startsWith('default-'));
  }

  guardarNotasManuales(): void {
    const m = this.matrizNotas();
    const idMat = this.notasMateriaSel();
    if (!m || !idMat) return;
    if (this.esquemaNotasSinGuardar()) {
      this.flash(undefined, 'Primero guarde el esquema de notas del programa en Cohortes → Esquema de notas.');
      return;
    }
    const notas: { numDoc: number; idCriterio: string; nota: number | null; observacion?: string }[] = [];
    for (const fila of m.filas) {
      for (const cel of fila.celdas) {
        notas.push({
          numDoc: fila.numDoc,
          idCriterio: cel.idCriterio,
          nota: cel.nota != null && cel.nota !== ('' as unknown as number) ? Number(cel.nota) : null,
          observacion: cel.observacion,
        });
      }
    }
    this.guardandoNotas.set(true);
    this.svc.guardarNotasCriterio(this.id, { idMateria: idMat, notas }).subscribe({
      next: (r) => {
        this.guardandoNotas.set(false);
        this.flash(`Notas guardadas (${r.guardadas} celdas). Se recalculó la aprobación de materia.`);
        this.cargarMatrizNotas();
      },
      error: (e) => {
        this.guardandoNotas.set(false);
        this.flash(undefined, e?.error?.message || 'No se pudieron guardar las notas');
      },
    });
  }

  private ctxProg(): { idProg: string; numSemestre: number } | null {
    const c = this.cohorte();
    return c ? { idProg: c.idProg, numSemestre: c.numSemestre } : null;
  }

  /* ---- Evaluaciones ---- */
  cargarEvaluaciones(): void {
    this.svc.listarEvaluaciones(this.id).subscribe({
      next: (rows) => this.evaluaciones.set(rows),
      error: () => this.evaluaciones.set([]),
    });
  }

  patchEval<K extends keyof ReturnType<typeof this.nuevaEval>>(k: K, v: ReturnType<typeof this.nuevaEval>[K]): void {
    this.nuevaEval.update((n) => ({ ...n, [k]: v }));
  }

  private evalFormDefaults() {
    return {
      idMateria: '',
      titulo: '',
      descripcion: '',
      modoPreguntas: 'BANCO_ALEATORIO' as const,
      tipoEvaluacion: 'PARCIAL' as const,
      numPreguntasBanco: 5,
      notaAprobacion: 60,
      pesoNota: 100,
      intentosPermitidos: 1,
      duracionMin: 0,
      fechaApertura: '',
      fechaCierre: '',
    };
  }

  private toDatetimeLocal(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  abrirFormEval(): void {
    this.evalEditandoId.set(null);
    this.evalEditandoEstado.set(null);
    this.nuevaEval.set(this.evalFormDefaults());
    this.mostrarFormEval.set(true);
    this.seleccionadasBanco.set(new Set());
    this.bancoDisponible.set([]);
  }

  abrirEditarEval(ev: EvaluacionResumen): void {
    if (ev.estado === 'CERRADA') return;
    this.svc.obtenerEvaluacion(ev._id).subscribe({
      next: (e) => {
        this.evalEditandoId.set(e._id);
        this.evalEditandoEstado.set(e.estado);
        this.nuevaEval.set({
          idMateria: e.idMateria || '',
          titulo: e.titulo,
          descripcion: e.descripcion || '',
          modoPreguntas: e.modoPreguntas,
          tipoEvaluacion: e.tipoEvaluacion || 'PARCIAL',
          numPreguntasBanco: e.numPreguntasBanco || 5,
          notaAprobacion: e.notaAprobacion,
          pesoNota: e.pesoNota,
          intentosPermitidos: e.intentosPermitidos ?? 1,
          duracionMin: e.duracionMin ?? 0,
          fechaApertura: this.toDatetimeLocal(e.fechaApertura),
          fechaCierre: this.toDatetimeLocal(e.fechaCierre),
        });
        const sel = new Set<string>();
        if (e.modoPreguntas === 'MANUAL' && e.estado === 'BORRADOR') {
          (e.preguntas || []).forEach((p) => {
            if (p.idBanco) sel.add(String(p.idBanco));
          });
        }
        this.seleccionadasBanco.set(sel);
        this.mostrarFormEval.set(true);
        this.cargarBancoDeMateria(e.idMateria || '');
      },
      error: (err) => this.flash(undefined, err?.error?.message || 'No se pudo cargar la evaluación'),
    });
  }

  cerrarFormEval(): void {
    this.mostrarFormEval.set(false);
    this.evalEditandoId.set(null);
    this.evalEditandoEstado.set(null);
  }

  onEvalMateriaChange(idMateria: string): void {
    this.patchEval('idMateria', idMateria);
    this.seleccionadasBanco.set(new Set());
    this.cargarBancoDeMateria(idMateria);
  }

  /** Carga el banco de la materia del catálogo asociada a la materia de la cohorte. */
  private cargarBancoDeMateria(idMateria: string): void {
    const mat = (this.cohorte()?.materias || []).find((m) => m._id === idMateria);
    const idCat = mat?.idMateriaCatalogo || '';
    if (!idCat) {
      this.bancoDisponible.set([]);
      return;
    }
    this.svc.listarBanco({ idMateriaCatalogo: idCat }).subscribe({
      next: (rows) => this.bancoDisponible.set(rows.filter((p) => p.activo !== false)),
      error: () => this.bancoDisponible.set([]),
    });
  }

  bancoFiltradoPorMateria(): PreguntaBanco[] {
    return this.bancoDisponible();
  }

  toggleBancoSel(id: string): void {
    const s = new Set(this.seleccionadasBanco());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.seleccionadasBanco.set(s);
  }

  guardarEvaluacion(): void {
    const n = this.nuevaEval();
    const editId = this.evalEditandoId();
    const limitada = this.evalEdicionLimitada();
    if (!n.titulo.trim()) {
      this.flash(undefined, 'Escriba el título de la evaluación.');
      return;
    }

    const dtoBase: EvaluacionDto = {
      titulo: n.titulo,
      descripcion: n.descripcion,
      notaAprobacion: n.notaAprobacion,
      pesoNota: n.pesoNota,
      tipoEvaluacion: n.tipoEvaluacion,
      intentosPermitidos: n.intentosPermitidos,
      duracionMin: n.duracionMin,
      fechaApertura: n.fechaApertura || null,
      fechaCierre: n.fechaCierre || null,
    };

    let preguntas: PreguntaEval[] | undefined;
    if (!limitada && n.modoPreguntas === 'MANUAL') {
      const sel = this.seleccionadasBanco();
      preguntas = this.bancoDisponible()
        .filter((p) => p._id && sel.has(p._id))
        .map((p) => ({ idBanco: p._id, enunciado: p.enunciado, tipo: p.tipo, opciones: p.opciones, puntos: 1 }));
      if (!preguntas.length) {
        this.flash(undefined, 'Seleccione al menos una pregunta del banco.');
        return;
      }
    }

    const dtoCompleto: EvaluacionDto = limitada
      ? dtoBase
      : {
          ...dtoBase,
          idMateria: n.idMateria || null,
          modoPreguntas: n.modoPreguntas,
          numPreguntasBanco: n.numPreguntasBanco,
          preguntas,
        };

    const req = editId
      ? this.svc.actualizarEvaluacion(editId, dtoCompleto)
      : this.svc.crearEvaluacion(this.id, dtoCompleto);

    req.subscribe({
      next: () => {
        this.flash(editId ? 'Evaluación actualizada.' : 'Evaluación creada (en borrador). Publícala para que los alumnos la vean.');
        this.cerrarFormEval();
        this.nuevaEval.set(this.evalFormDefaults());
        this.cargarEvaluaciones();
      },
      error: (e) => this.flash(undefined, e?.error?.message || 'No se pudo guardar la evaluación'),
    });
  }

  publicarEval(ev: EvaluacionResumen): void {
    this.svc.publicarEvaluacion(ev._id).subscribe({
      next: () => {
        this.flash('Evaluación publicada.');
        this.cargarEvaluaciones();
      },
      error: (e) => this.flash(undefined, e?.error?.message || 'No se pudo publicar'),
    });
  }

  cerrarEval(ev: EvaluacionResumen): void {
    this.svc.cerrarEvaluacion(ev._id).subscribe({
      next: () => {
        this.flash('Evaluación cerrada.');
        this.cargarEvaluaciones();
      },
      error: (e) => this.flash(undefined, e?.error?.message || 'No se pudo cerrar'),
    });
  }

  eliminarEval(ev: EvaluacionResumen): void {
    this.svc.eliminarEvaluacion(ev._id).subscribe({
      next: () => {
        this.flash('Evaluación eliminada.');
        this.cargarEvaluaciones();
      },
      error: (e) => this.flash(undefined, e?.error?.message || 'No se pudo eliminar'),
    });
  }

  verResultados(ev: EvaluacionResumen): void {
    this.svc.resultadosEvaluacion(ev._id).subscribe({
      next: (r) => this.resultados.set(r),
      error: (e) => this.flash(undefined, e?.error?.message || 'No se pudieron cargar los resultados'),
    });
  }

  cerrarResultados(): void {
    this.resultados.set(null);
  }

  /* ---- Materiales ---- */
  cargarMateriales(): void {
    const ctx = this.ctxProg();
    if (!ctx) return;
    this.svc.listarMateriales({ idProg: ctx.idProg, numSemestre: ctx.numSemestre }).subscribe({
      next: (rows) => this.materiales.set(rows),
      error: () => this.materiales.set([]),
    });
  }

  patchMaterial<K extends keyof ReturnType<typeof this.nuevoMaterial>>(k: K, v: ReturnType<typeof this.nuevoMaterial>[K]): void {
    this.nuevoMaterial.update((n) => ({ ...n, [k]: v }));
  }

  crearMaterial(): void {
    const n = this.nuevoMaterial();
    if (!n.idMateria) {
      this.flash(undefined, 'Seleccione la materia.');
      return;
    }
    if (!n.titulo.trim()) {
      this.flash(undefined, 'Escriba el título del material.');
      return;
    }
    this.svc
      .crearMaterial({
        idMateria: n.idMateria,
        titulo: n.titulo,
        tipo: n.tipo,
        url: n.url,
        descripcion: n.descripcion,
        idCohorte: this.id,
      })
      .subscribe({
        next: () => {
          this.flash('Material agregado.');
          this.patchMaterial('titulo', '');
          this.patchMaterial('url', '');
          this.patchMaterial('descripcion', '');
          this.cargarMateriales();
        },
        error: (e) => this.flash(undefined, e?.error?.message || 'No se pudo agregar el material'),
      });
  }

  eliminarMaterial(m: MaterialCohorte): void {
    if (!m._id) return;
    this.svc.eliminarMaterial(m._id).subscribe({
      next: () => {
        this.flash('Material eliminado.');
        this.cargarMateriales();
      },
      error: (e) => this.flash(undefined, e?.error?.message || 'No se pudo eliminar'),
    });
  }

  /* ---- Certificado / actas / reportes ---- */
  patchCriterio<K extends keyof CriteriosCertificado>(k: K, v: CriteriosCertificado[K]): void {
    this.criterios.update((c) => ({ ...c, [k]: v }));
  }

  guardarCriterios(): void {
    this.guardandoCriterios.set(true);
    this.svc.actualizarCohorte(this.id, { criteriosCertificado: this.criterios() }).subscribe({
      next: () => {
        this.guardandoCriterios.set(false);
        this.flash('Criterios guardados.');
      },
      error: (e) => {
        this.guardandoCriterios.set(false);
        this.flash(undefined, e?.error?.message || 'No se pudieron guardar los criterios');
      },
    });
  }

  verCert(v: 'criterios' | 'elegibilidad' | 'acta' | 'asistencia'): void {
    this.vistaCert.set(v);
    if (v === 'elegibilidad' && !this.elegibilidad()) this.cargarElegibilidad();
    if (v === 'acta' && !this.acta()) this.cargarActa();
    if (v === 'asistencia' && !this.reporteAsis()) this.cargarReporteAsis();
  }

  cargarElegibilidad(): void {
    this.svc.elegibilidadCertificado(this.id).subscribe({
      next: (r) => this.elegibilidad.set(r),
      error: (e) => this.flash(undefined, e?.error?.message || 'No se pudo calcular la elegibilidad'),
    });
  }

  cargarActa(): void {
    this.svc.actaNotas(this.id).subscribe({
      next: (r) => this.acta.set(r),
      error: (e) => this.flash(undefined, e?.error?.message || 'No se pudo cargar el acta'),
    });
  }

  cargarReporteAsis(): void {
    this.svc.reporteAsistencia(this.id).subscribe({
      next: (r) => this.reporteAsis.set(r),
      error: (e) => this.flash(undefined, e?.error?.message || 'No se pudo cargar el reporte'),
    });
  }

  finalizarAptos(): void {
    this.svc.finalizarAptos(this.id).subscribe({
      next: (r) => {
        this.flash(`${r.finalizados} de ${r.totalInscritos} alumno(s) finalizados como aptos.`);
        this.elegibilidad.set(null);
        this.cargarElegibilidad();
        this.cargar();
      },
      error: (e) => this.flash(undefined, e?.error?.message || 'No se pudo finalizar'),
    });
  }

  notaCelda(fila: ActaNotas['filas'][number], idMateria: string): { nota: number | null; aprobada: boolean } {
    return fila.celdas.find((c) => c.idMateria === idMateria) || { nota: null, aprobada: false };
  }

  asisCelda(fila: ReporteAsistencia['filas'][number], idClase: string): string {
    return fila.celdas.find((c) => c.idClase === idClase)?.estado || 'PENDIENTE';
  }
}
