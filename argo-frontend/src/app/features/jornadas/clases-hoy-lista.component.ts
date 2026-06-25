import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ClaseJornadaDto, JornadaCapDto, JornadaCapService } from '../../core/services/jornada-cap.service';
import { PermisoService } from '../../core/services/permiso.service';
import {
  CatalogoEnumBuscarComponent,
  EnumBuscarOption,
} from '../../shared/catalogo-enum-buscar/catalogo-enum-buscar.component';
import { FormModalComponent } from '../../shared/form-modal/form-modal.component';
import { fmtFechaCalendario, ymdLocal } from './jornada-calendario.util';
import {
  capCodContrato,
  capInstructor,
  capMunicipioJor,
  capUbicacionClase,
  estadoClaseLiveClass,
  isoAHoraInput,
  rowClaseClass,
} from './jornada-ui.util';

@Component({
  selector: 'argo-clases-hoy-lista',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, FormModalComponent, CatalogoEnumBuscarComponent],
  templateUrl: './clases-hoy-lista.component.html',
  styleUrls: ['./clases-hoy-lista.component.scss'],
})
export class ClasesHoyListaComponent implements OnInit, OnDestroy {
  private jornadaSvc = inject(JornadaCapService);
  private permisoSvc = inject(PermisoService);
  private router = inject(Router);

  loading = signal(false);
  clases = signal<ClaseJornadaDto[]>([]);
  query = signal('');
  msg = signal<string | null>(null);
  modalCrearOpen = signal(false);
  guardandoClase = signal(false);
  jornadasHoy = signal<JornadaCapDto[]>([]);
  jornadaCrearSel = signal('');
  programasJornada = signal<any[]>([]);
  nuevaClaseProg = signal('');
  nuevaClaseUbic = signal('Carpa');

  readonly ubicaciones = ['Carpa', 'Domo', 'Empresa', 'Colegio', 'Auditorio', 'Coliseo', 'Estadio', 'Otro'];
  readonly hoyKey = ymdLocal(new Date());

  jornadasOperablesHoy = computed(() =>
    this.jornadasHoy().filter((j) => String(j.estado || '').toUpperCase() === 'EN PROCESO'),
  );
  jornadaCrearActiva = computed(() =>
    this.jornadasHoy().find((j) => j._id === this.jornadaCrearSel()),
  );
  puedeCrearClaseHoy = computed(
    () => this.puedeOperar() && this.jornadasOperablesHoy().length > 0,
  );

  opcionesProgramasCrear = computed<EnumBuscarOption[]>(() =>
    this.programasJornada().map((p) => ({
      value: String(p.idPrograma || p._id || ''),
      label: String(p.nombreProg || p.codigoProg || ''),
    })),
  );
  textoProgramaCrear = computed(() => {
    const id = this.nuevaClaseProg();
    if (!id) return '';
    const p = this.programasJornada().find((x) => String(x.idPrograma || x._id) === String(id));
    return p ? String(p.nombreProg || p.codigoProg || id) : id;
  });
  opcionesUbicacionCrear = computed<EnumBuscarOption[]>(() =>
    this.ubicaciones.map((u) => ({ value: u, label: u })),
  );
  textoUbicacionCrear = computed(() => this.nuevaClaseUbic() || 'Carpa');

  hoyLabel = computed(() => fmtFechaCalendario(new Date()));
  enProcesoCount = computed(() => this.clases().filter((c) => c.estado === 'EN PROCESO').length);
  programadasCount = computed(() => this.clases().filter((c) => c.estado === 'PROGRAMADA').length);
  finalizadasCount = computed(() => this.clases().filter((c) => c.estado === 'FINALIZADO').length);

  puedeGestionar = computed(() => this.permisoSvc.tiene('jornadas.gestionar'));
  /** Instructor (operar sin gestionar): ve solo sus clases en esta pantalla. */
  esInstructorSolo = computed(
    () => this.permisoSvc.tiene('jornadas.operar') && !this.puedeGestionar(),
  );
  puedeOperar = computed(() => this.permisoSvc.tiene('jornadas.operar') || this.puedeGestionar());

  filtradas = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.clases();
    return this.clases().filter((c) => {
      const campos = [
        c.codContrato,
        c.contratoLabel,
        c.programaNombre,
        c.instructorNombre,
        c.ubicacion,
        c.municipioJornada,
        c.direccionJornada,
        c.estado,
      ];
      return campos.some((v) => String(v || '').toLowerCase().includes(q));
    });
  });

  total = computed(() => this.clases().length);

  capCodContrato = capCodContrato;
  capInstructor = capInstructor;
  capMunicipioJor = capMunicipioJor;
  capUbicacionClase = capUbicacionClase;
  estadoClaseLiveClass = estadoClaseLiveClass;
  rowClaseClass = rowClaseClass;

  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.cargar();
    this.refreshTimer = setInterval(() => this.cargar(true), 15_000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  cargar(silencioso = false) {
    if (!silencioso) this.loading.set(true);
    this.jornadaSvc.listarClasesDelDia(ymdLocal(new Date())).subscribe({
      next: (rows) => {
        this.clases.set(rows || []);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.msg.set(e?.error?.message || 'No se pudieron cargar las clases de hoy.');
      },
    });
  }

  cerrarMsg() {
    this.msg.set(null);
  }

  labelInstructorClase(c: ClaseJornadaDto): string {
    return (c.instructorNombre || c.idinstructor || '—').trim() || '—';
  }

  fmtHora(iso?: string | null): string {
    const h = isoAHoraInput(iso);
    return h || '—';
  }

  gestionarJornada(c: ClaseJornadaDto) {
    if (!c.idContrato || !c.idJornada) return;
    void this.router.navigate(['/app/jornadas'], {
      queryParams: {
        contrato: c.idContrato,
        tab: 'jornadas',
        jornada: c.idJornada,
      },
    });
  }

  editarClase(c: ClaseJornadaDto) {
    if (!c.idContrato || !c.idJornada || !c._id) return;
    void this.router.navigate(['/app/jornadas'], {
      queryParams: {
        contrato: c.idContrato,
        tab: 'clases',
        jornada: c.idJornada,
        clase: c._id,
      },
    });
  }

  operarClase(c: ClaseJornadaDto) {
    void this.router.navigate(['/app/jornadas/instructor'], {
      queryParams: { clase: c._id, jornada: c.idJornada, fecha: ymdLocal(new Date()) },
    });
  }

  iniciarYOperar(c: ClaseJornadaDto) {
    if (!c._id) return;
    this.jornadaSvc.iniciarClase(c._id).subscribe({
      next: () => this.operarClase(c),
      error: (e) => this.msg.set(e?.error?.message || 'No se pudo iniciar la clase.'),
    });
  }

  abrirModalCrearClase() {
    if (!this.puedeOperar()) {
      this.msg.set('No tiene permiso para crear clases.');
      return;
    }
    this.nuevaClaseProg.set('');
    this.nuevaClaseUbic.set('Carpa');
    this.jornadaCrearSel.set('');
    this.modalCrearOpen.set(true);
    this.jornadaSvc.programasJornadaCap().subscribe({
      next: (p) => this.programasJornada.set(p || []),
      error: () => this.programasJornada.set([]),
    });
    this.jornadaSvc.jornadasDelDia(this.hoyKey).subscribe({
      next: (rows) => {
        this.jornadasHoy.set(rows || []);
        const operables = (rows || []).filter(
          (j) => String(j.estado || '').toUpperCase() === 'EN PROCESO',
        );
        if (operables.length === 1) {
          this.jornadaCrearSel.set(String(operables[0]._id));
        }
      },
      error: () => this.jornadasHoy.set([]),
    });
  }

  cerrarModalCrearClase() {
    if (this.guardandoClase()) return;
    this.modalCrearOpen.set(false);
  }

  onProgramaCrearPick(opt: EnumBuscarOption): void {
    this.nuevaClaseProg.set(String(opt.value));
  }

  onProgramaCrearLimpiar(): void {
    this.nuevaClaseProg.set('');
  }

  onUbicacionCrearPick(opt: EnumBuscarOption): void {
    this.nuevaClaseUbic.set(String(opt.value));
  }

  onUbicacionCrearLimpiar(): void {
    this.nuevaClaseUbic.set('Carpa');
  }

  labelJornadaCrear(j: JornadaCapDto): string {
    const contrato = j.contratoLabel || j.codContrato || '—';
    const mun = j.municipio ? ` · ${j.municipio}` : '';
    return `${contrato}${mun}`;
  }

  crearClaseHoy() {
    const idJ = this.jornadaCrearSel();
    const idP = this.nuevaClaseProg();
    if (!idJ || !idP) {
      this.msg.set('Seleccione la jornada del día y el programa de capacitación.');
      return;
    }
    if (this.jornadaCrearActiva()?.estado !== 'EN PROCESO') {
      this.msg.set('Solo puede crear clases en jornadas EN PROCESO (día de hoy).');
      return;
    }
    this.guardandoClase.set(true);
    this.jornadaSvc
      .crearClase({ idJornada: idJ, idPrograma: idP, ubicacion: this.nuevaClaseUbic() })
      .subscribe({
        next: (c) => {
          this.guardandoClase.set(false);
          this.modalCrearOpen.set(false);
          this.cargar(true);
          this.msg.set('Clase creada correctamente.');
          if (this.esInstructorSolo()) {
            this.operarClase(c);
          } else {
            this.editarClase(c);
          }
        },
        error: (e) => {
          this.guardandoClase.set(false);
          this.msg.set(e?.error?.message || 'No se pudo crear la clase.');
        },
      });
  }
}
