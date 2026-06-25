import { CommonModule } from '@angular/common';

import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';



import { CatalogoService } from '../../core/services/catalogo.service';

import {

  Programa,

  ProgramaDetalle,

  ProgramaDto,

  ProgramaService,

  ServicioPrograma,

} from '../../core/services/programa.service';

import { AuthService } from '../../core/services/auth.service';
import { PermisoService } from '../../core/services/permiso.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import {
  ConfigCertificado,
  ConfigCertificadoService,
  PlantillaCertificado,
} from '../../core/services/config-certificado.service';
import {
  TIPOS_CERTIFICADO,
  TipoCertificadoId,
  labelOrientacion,
  labelTipoCert,
} from '../../core/constants/tipos-certificado';

import {
  capCodigo,
  capEstado,
  capHoras,
  capMoneda,
  capTipoCapLabel,
} from '../../core/utils/capsule.util';
import { coerceProgramaNumeric } from '../../core/utils/programa-numeric.util';
import { readVistaLista, saveVistaLista, VistaLista } from '../../core/utils/vista-lista.helpers';
import { environment } from '../../../environments/environment';
import { AsistenteContextoService } from '../../core/services/asistente-contexto.service';
import { tipFormulario } from '../../core/utils/asistente-formulario.util';
import {
  etiquetasModalidad,
  MODALIDADES_PROGRAMA_OPTS,
  MODALIDAD_PRESENCIAL,
  programaAdmitePresencial,
  programaAdmiteVirtual,
} from './programa-modalidad.helpers';

type SortColPrograma =
  | 'codigo'
  | 'programa'
  | 'modalidades'
  | 'formatoCert'
  | 'tipo'
  | 'horas'
  | 'semestres'
  | 'matricula'
  | 'estado';
type SortDir = 'asc' | 'desc';

const SORT_STORAGE_KEY = 'argo-programas-sort';

const SORT_COLUMNS: ReadonlyArray<{ key: SortColPrograma; label: string }> = [
  { key: 'codigo', label: 'Código' },
  { key: 'programa', label: 'Programa' },
  { key: 'modalidades', label: 'Modalidades' },
  { key: 'formatoCert', label: 'Formato cert.' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'horas', label: 'Horas' },
  { key: 'semestres', label: 'Sem.' },
  { key: 'matricula', label: 'Matrícula' },
  { key: 'estado', label: 'Estado' },
];

function readSortPrefs(): { col: SortColPrograma; dir: SortDir } {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY);
    if (!raw) return { col: 'programa', dir: 'asc' };
    const parsed = JSON.parse(raw) as { col?: string; dir?: string };
    const colRaw = parsed.col === 'certificado' ? 'modalidades' : parsed.col;
    const col = SORT_COLUMNS.some((c) => c.key === colRaw) ? (colRaw as SortColPrograma) : 'programa';
    const dir: SortDir = parsed.dir === 'desc' ? 'desc' : 'asc';
    return { col, dir };
  } catch {
    return { col: 'programa', dir: 'asc' };
  }
}

function saveSortPrefs(col: SortColPrograma, dir: SortDir): void {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ col, dir }));
  } catch {
    /* ignore */
  }
}

function cmpStr(a: string, b: string): number {
  return a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true });
}

function cmpNum(a: number | null | undefined, b: number | null | undefined): number {
  const na = a == null || Number.isNaN(Number(a)) ? null : Number(a);
  const nb = b == null || Number.isNaN(Number(b)) ? null : Number(b);
  if (na == null && nb == null) return 0;
  if (na == null) return 1;
  if (nb == null) return -1;
  return na - nb;
}

import {
  CatalogoEnumBuscarComponent,
  EnumBuscarOption,
} from '../../shared/catalogo-enum-buscar/catalogo-enum-buscar.component';
interface AuditInfo {

  fechaAudi?: string;

  userAddReg?: string;

  userChangeRecord?: string;

  fechaMod?: string;

}



@Component({

  selector: 'argo-programas-admin',

  standalone: true,

  imports: [CommonModule, FormsModule, RouterLink, CatalogoEnumBuscarComponent],

  templateUrl: './programas-admin.component.html',

  styleUrls: ['./programas-admin.component.scss'],

})

export class ProgramasAdminComponent implements OnInit {

  private progSvc = inject(ProgramaService);

  private catSvc = inject(CatalogoService);

  private auth = inject(AuthService);
  private permisoSvc = inject(PermisoService);

  private cfgCertSvc = inject(ConfigCertificadoService);

  private confirm = inject(ConfirmDialogService);
  private asistente = inject(AsistenteContextoService);
  private route = inject(ActivatedRoute);

  @ViewChild('pageHead') pageHead?: ElementRef<HTMLElement>;
  @ViewChild('formPanel') formPanel?: ElementRef<HTMLElement>;

  constructor() {
    effect(() => {
      if (this.modalAbierto()) {
        this.asistente.setTipsPrepend([tipFormulario('Este formulario', this.modalSubtitulo(), 'prog-form-ctx')]);
        this.scrollAlFormulario();
      } else {
        this.asistente.clearTipsPrepend();
      }
    });
  }

  programas = signal<Programa[]>([]);

  sortColumns = SORT_COLUMNS;
  sortCol = signal<SortColPrograma>('programa');
  sortDir = signal<SortDir>('asc');

  programasOrdenados = computed(() => {
    const fm = this.filtroModalidad();
    let rows = [...this.programas()];
    if (fm === 'virtual') rows = rows.filter((p) => programaAdmiteVirtual(p));
    else if (fm === 'presencial') rows = rows.filter((p) => programaAdmitePresencial(p));
    const col = this.sortCol();
    const dir = this.sortDir();
    const mul = dir === 'asc' ? 1 : -1;

    rows.sort((a, b) => {
      let c = 0;
      switch (col) {
        case 'codigo':
          c = cmpStr(String(a.codigoProg || a.idPrograma || ''), String(b.codigoProg || b.idPrograma || ''));
          break;
        case 'programa':
          c = cmpStr(a.nombreProg || '', b.nombreProg || '');
          break;
        case 'modalidades':
          c = cmpStr(this.labelModalidadesPrograma(a), this.labelModalidadesPrograma(b));
          break;
        case 'formatoCert': {
          const fa = a.tipoCertificado ? labelTipoCert(a.tipoCertificado) : 'Automático';
          const fb = b.tipoCertificado ? labelTipoCert(b.tipoCertificado) : 'Automático';
          c = cmpStr(fa, fb);
          break;
        }
        case 'tipo':
          c = cmpStr(this.labelTipoPrograma(a), this.labelTipoPrograma(b));
          break;
        case 'horas':
          c = cmpNum(a.horas, b.horas);
          break;
        case 'semestres':
          c = cmpNum(a.semestres, b.semestres);
          break;
        case 'matricula':
          c = cmpNum(a.valorMatricula, b.valorMatricula);
          break;
        case 'estado':
          c = cmpStr(a.estado || '', b.estado || '');
          break;
      }
      if (c !== 0) return c * mul;
      return cmpStr(a.nombreProg || '', b.nombreProg || '') * mul;
    });

    return rows;
  });

  tiposCap = signal<{ id: string | number; label: string }[]>([]);

  tiposServ = signal<{ id: number; code: string; label: string }[]>([]);

  tiposCert = TIPOS_CERTIFICADO;

  configCert = signal<ConfigCertificado | null>(null);

  plantillasCert = signal<PlantillaCertificado[]>([]);

  loading = signal(false);

  saving = signal(false);

  msg = signal<string | null>(null);
  msgError = signal(false);

  busqueda = signal('');

  filtroModalidad = signal<'todos' | 'virtual' | 'presencial'>('todos');

  vista = signal<VistaLista>(readVistaLista('argo-programas-vista'));

  modalAbierto = signal(false);

  editando = signal<Programa | null>(null);

  servicioVinculado = signal<ServicioPrograma | null>(null);
  serviciosVinculados = signal<ServicioPrograma[]>([]);
  servicioHoraPractica = signal<ServicioPrograma | null>(null);

  auditPrograma = signal<AuditInfo | null>(null);

  auditServicio = signal<AuditInfo | null>(null);

  tiposCargando = signal(true);

  esAdmin = signal(false);

  puedeAgregarPrograma(): boolean {
    return this.permisoSvc.tiene(['programas.agregar', 'programas.gestionar']);
  }

  puedeGestionarPrograma(): boolean {
    return this.permisoSvc.tiene('programas.gestionar');
  }



  form = signal<ProgramaDto>(this.formVacio());
  portadaFile = signal<File | null>(null);
  portadaPreviewLocal = signal<string | null>(null);

  readonly opcionesModalidadPrograma = MODALIDADES_PROGRAMA_OPTS;

  formModalidades = computed(() => this.form().modalidades ?? [MODALIDAD_PRESENCIAL]);

  admiteModalidadVirtualForm = computed(() => this.formModalidades().includes('VIRTUAL'));

  admiteModalidadPresencialForm = computed(() =>
    this.formModalidades().some((m) => m === 'PRESENCIAL' || m === 'MIXTA'),
  );

  esSoloVirtualForm = computed(() => {
    const m = this.formModalidades();
    return m.length === 1 && m[0] === 'VIRTUAL';
  });

  esFormularioVirtual = computed(
    () => this.admiteModalidadVirtualForm() && this.num(this.form().tarifaVirtual) > 0,
  );

  portadaPreviewUrl = computed(() => {
    const local = this.portadaPreviewLocal();
    if (local) return local;
    const rel = String(this.form().urlPortadaVirtual || '').trim();
    if (!rel) return null;
    return `${environment.uploadsUrl}/${rel.replace(/^\/+/, '')}`;
  });

  opcionesTipoCertificado = computed<EnumBuscarOption[]>(() => [
    { value: '', label: 'Automático' },
    ...TIPOS_CERTIFICADO.map((t) => ({ value: t.id, label: t.label })),
  ]);

  textoTipoCertificado = computed(() => {
    const v = this.form().tipoCertificado;
    if (v == null || v === '') return 'Automático';
    return labelTipoCert(v);
  });

  opcionesTipoCap = computed<EnumBuscarOption[]>(() =>
    this.tiposCap().map((t) => ({ value: t.id, label: t.label })),
  );

  textoTipoCap = computed(() => {
    if (this.esProgramaJornadasCapForm()) {
      return this.etiquetaTipCapJornada();
    }
    return this.etiquetaTipCapForm(this.form().idTipCap);
  });

  opcionesEstado: EnumBuscarOption[] = [
    { value: 'ACTIVO', label: 'ACTIVO' },
    { value: 'INACTIVO', label: 'INACTIVO' },
  ];

  textoEstado = computed(() => this.form().estado || 'ACTIVO');

  opcionesTipoServ = computed<EnumBuscarOption[]>(() =>
    this.tiposServ().map((t) => ({
      value: t.code,
      label: `${t.label} (${t.code})`,
    })),
  );

  textoTipoServ = computed(() => {
    const code = String(this.form().tipoServ ?? '').trim();
    if (!code) return '';
    const t = this.tiposServ().find((x) => x.code === code);
    return t ? `${t.label} (${t.code})` : code;
  });

  opcionesFacturar: EnumBuscarOption[] = [
    { value: 'NO', label: 'NO' },
    { value: 'SI', label: 'SI' },
  ];

  textoFacturar = computed(() => this.form().facturar || 'NO');

  ngOnInit(): void {

    const sortPrefs = readSortPrefs();
    this.sortCol.set(sortPrefs.col);
    this.sortDir.set(sortPrefs.dir);

    const r = String(this.auth.user()?.rol || '').toLowerCase();

    this.esAdmin.set(r === 'admin' || r.includes('admin'));

    this.cargar();

    this.route.queryParamMap.subscribe((q) => {
      const editId = q.get('editar');
      if (editId) this.abrirEditarPorId(editId);
    });

    this.cfgCertSvc.obtener().subscribe({ next: (c) => this.configCert.set(c) });

    this.cfgCertSvc.listarPlantillasTodas().subscribe({

      next: (r) => this.plantillasCert.set(r || []),

    });

    this.catSvc.list('catTipoCapacitacion').subscribe({

      next: (rows) => {

        this.tiposCargando.set(false);

        const list: { id: string | number; label: string }[] = (rows || [])
          .map((t: { idTipCap?: string | number; id?: string | number; tipoCap?: string; descripcion?: string }) => {
            const idRaw = t.idTipCap ?? t.id;
            const label = String(t.tipoCap ?? t.descripcion ?? idRaw ?? '').trim();
            if (idRaw == null || idRaw === '') return null;
            return { id: idRaw, label: label || String(idRaw) };
          })
          .filter((x): x is { id: string | number; label: string } => !!x);

        this.tiposCap.set(list);

        if (!list.length) {

          this.inform('No hay tipos de capacitación en el catálogo. Ejecute el seed de catálogos.');

        }

      },

      error: () => {

        this.tiposCargando.set(false);

        this.inform('No se pudieron cargar los tipos de capacitación.', true);

      },

    });

    this.catSvc.list('catTipServicio').subscribe({

      next: (rows) => {

        const list = (rows || []).map(

          (t: { idTipoServ?: number; tipoServ?: string; descTipoServ?: string }) => ({

            id: Number(t.idTipoServ) || 0,

            code: String(t.tipoServ || '').trim(),

            label: String(t.descTipoServ || t.tipoServ || ''),

          }),

        );

        this.tiposServ.set(list.filter((x) => x.code));

      },

    });

  }



  private formVacio(): ProgramaDto {

    return {

      nombreProg: '',

      nomCert: '',

      idTipCap: '' as string | number,

      semestres: null,

      horas: null,

      horasTeoria: null,

      horasPractica: null,

      horasTaller: null,

      valorMatricula: 0,

      usaCohortes: false,

      tarifa1: 0,

      tarifa2: 0,

      tarifa3: 0,

      tarifaVirtual: 0,

      descripcionVirtual: '',

      urlPortadaVirtual: '',

      diasVencimiento: 365,

      admiteRevalidacion: false,

      aplicarTarifaRevalidacionAuto: false,

      tipoCertificado: null,

      estado: 'ACTIVO',

      descripcion: '',

      requistos: '',

      descrServicio: '',

      tipoServ: 'CUR',

      facturar: 'NO',

      iva: 0,

      tarifaHoraPractica: 0,

      modalidades: [MODALIDAD_PRESENCIAL],

    };

  }



  private auditDe(obj: Record<string, unknown> | null | undefined): AuditInfo | null {

    if (!obj) return null;

    return {

      fechaAudi: this.fmtFecha(obj['fechaAudi']),

      userAddReg: String(obj['userAddReg'] ?? '—'),

      userChangeRecord: String(obj['userChangeRecord'] ?? '—'),

      fechaMod: this.fmtFecha(obj['fechaMod']),

    };

  }



  cargar() {

    this.loading.set(true);

    const q = this.busqueda().trim();

    this.progSvc.listar({ q: q.length >= 2 ? q : undefined }).subscribe({

      next: (r) => {

        this.programas.set(r || []);

        this.loading.set(false);

      },

      error: (e) => {

        this.loading.set(false);

        this.inform(e?.error?.message || 'Error cargando programas', true);

      },

    });

  }

  setVista(v: VistaLista) {
    this.vista.set(v);
    saveVistaLista('argo-programas-vista', v);
  }

  toggleSort(col: SortColPrograma) {
    if (this.sortCol() === col) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortCol.set(col);
      this.sortDir.set('asc');
    }
    saveSortPrefs(this.sortCol(), this.sortDir());
  }

  sortIcon(col: SortColPrograma): string {
    if (this.sortCol() !== col) return '↕';
    return this.sortDir() === 'asc' ? '▲' : '▼';
  }

  sortAria(col: SortColPrograma): 'ascending' | 'descending' | 'none' {
    if (this.sortCol() !== col) return 'none';
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }



  patch<K extends keyof ProgramaDto>(k: K, v: ProgramaDto[K]) {
    const coerced = coerceProgramaNumeric(k, v);
    this.form.update((f) => {
      const next = { ...f, [k]: coerced };
      if (k === 'valorMatricula' || k === 'tarifa1') {
        const v1 = Number(k === 'tarifa1' ? coerced : next.valorMatricula) || 0;
        next.tarifa1 = v1;
        next.valorMatricula = v1;
      }
      if (k === 'tarifaVirtual' && this.esSoloVirtualForm()) {
        next.valorMatricula = Number(coerced) || 0;
      }
      return next;
    });
  }

  toggleModalidadPrograma(codigo: string): void {
    const cur = [...(this.form().modalidades || [])];
    const idx = cur.indexOf(codigo);
    if (idx >= 0) {
      if (cur.length <= 1) return;
      cur.splice(idx, 1);
    } else {
      cur.push(codigo);
    }
    this.patch('modalidades', cur);
    if (cur.length === 1 && cur[0] === 'VIRTUAL') {
      this.patch('valorMatricula', this.num(this.form().tarifaVirtual));
    }
  }

  modalidadProgramaActiva(codigo: string): boolean {
    return (this.form().modalidades || []).includes(codigo);
  }

  onAdmiteRevalidacionChange(v: boolean): void {
    this.patch('admiteRevalidacion', v);
    if (!v) this.patch('aplicarTarifaRevalidacionAuto', false);
  }

  onDiasVencimientoChange(raw: unknown): void {
    const n = Math.max(0, Math.round(Number(raw) || 0));
    this.patch('diasVencimiento', n);
    if (n <= 0) {
      this.patch('admiteRevalidacion', false);
      this.patch('aplicarTarifaRevalidacionAuto', false);
    }
  }

  tieneVigenciaCertificado(): boolean {
    return (Number(this.form().diasVencimiento) || 0) > 0;
  }



  nuevo() {

    if (this.tiposCargando()) {

      this.inform('Espere a que carguen los tipos de capacitación.');

      return;

    }

    if (!this.tiposCap().length) {

      this.inform('Faltan tipos de capacitación. Contacte al administrador del sistema.');

      return;

    }

    this.editando.set(null);

    this.servicioVinculado.set(null);
    this.serviciosVinculados.set([]);
    this.servicioHoraPractica.set(null);

    this.auditPrograma.set(null);

    this.auditServicio.set(null);

    const t = this.tiposCap()[0]?.id ?? '';

    this.form.set({ ...this.formVacio(), idTipCap: t, tipoServ: this.inferirTipoServ(t) });

    this.resetPortadaLocal();
    this.modalAbierto.set(true);
    this.scrollAlFormulario();
    this.inform(null);

  }



  abrirEditarPorId(id: string) {
    const hit = this.programas().find(
      (p) => String(p._id) === id || String(p.idPrograma) === id,
    );
    if (hit) {
      this.editar(hit);
      return;
    }
    this.progSvc.obtener(id).subscribe({
      next: (det) => this.editar(det.programa),
      error: () => this.inform('No se encontró el programa para editar', true),
    });
  }

  fichaProgramaLink(p: Programa): string[] {
    return ['/app/programas', String(p.idPrograma ?? p._id ?? '')];
  }

  editar(p: Programa) {
    this.modalAbierto.set(false);
    this.progSvc.obtener(p.idPrograma).subscribe({
      next: (det) => {
        const prog = det.programa;
        const lista = det.servicios?.length ? det.servicios : det.servicio ? [det.servicio] : [];
        const horaP = lista.find((x) => this.esHoraPractica(x)) ?? null;
        const matricula = lista.filter((x) => !this.esHoraPractica(x));
        const s = matricula[0] ?? null;

        this.editando.set(prog);
        this.servicioVinculado.set(s);
        this.serviciosVinculados.set(matricula);
        this.servicioHoraPractica.set(horaP);
        this.auditPrograma.set(this.auditDe(prog as unknown as Record<string, unknown>));
        this.auditServicio.set(this.auditDe(s as unknown as Record<string, unknown>));
        this.form.set(this.formDesdeDetalle(prog, s, horaP));
        this.resetPortadaLocal();
        this.modalAbierto.set(true);
        this.scrollAlFormulario();
      },
      error: (e) => this.inform(e?.error?.message || 'No se pudo cargar el programa', true),
    });
  }

  /** Programa de jornadas según documento BD (tipoCertificado o idTipCap textual). */
  private esProgramaJornadasCapProg(prog: Programa): boolean {
    const tc = String(prog.tipoCertificado || '')
      .toLowerCase()
      .replace(/-/g, '_');
    if (tc === 'jornada_capacitacion') return true;
    return this.esTipCapJornadaLabel(String(prog.idTipCap ?? ''));
  }

  /**
   * idTipCap para el formulario: si el programa es jornada pero BD tiene idTipCap legacy
   * (p. ej. Técnico Laboral), usa el id del catálogo «Jornadas de Capacitación».
   */
  private idTipCapParaFormulario(prog: Programa): string | number | '' {
    if (this.esProgramaJornadasCapProg(prog)) {
      const jid = this.findTipCapJornadaId();
      if (jid != null && jid !== '') return jid;
    }
    return prog.idTipCap ?? '';
  }

  private formDesdeDetalle(
    prog: Programa,
    s: ServicioPrograma | null,
    horaP: ServicioPrograma | null,
  ): ProgramaDto {
    const idTipCap = this.idTipCapParaFormulario(prog);
    return {
      codigoProg: prog.codigoProg,
      nombreProg: prog.nombreProg ?? '',
      nomCert: prog.nomCert ?? '',
      idTipCap,
      semestres: prog.semestres ?? null,
      horas: prog.horas ?? null,
      horasTeoria: prog.horasTeoria ?? null,
      horasPractica: prog.horasPractica ?? null,
      horasTaller: prog.horasTaller ?? null,
      valorMatricula: this.num(
        prog.soloVirtual
          ? (s?.tarifaVirtual ?? prog.tarifaVirtual ?? prog.valorMatricula)
          : prog.valorMatricula,
      ),
      usaCohortes: prog.usaCohortes === true,
      tarifa1: this.num(s?.tarifa1 ?? prog.valorMatricula),
      tarifa2: this.num(s?.tarifa2),
      tarifa3: this.num(s?.tarifa3),
      tarifaVirtual: this.num(s?.tarifaVirtual),
      descripcionVirtual: prog.descripcionVirtual ?? '',
      urlPortadaVirtual: prog.urlPortadaVirtual ?? '',
      diasVencimiento: prog.diasVencimiento ?? 365,
      admiteRevalidacion:
        (Number(prog.diasVencimiento) || 0) > 0 && prog.admiteRevalidacion === true,
      aplicarTarifaRevalidacionAuto:
        (Number(prog.diasVencimiento) || 0) > 0 && prog.aplicarTarifaRevalidacionAuto === true,
      tipoCertificado: prog.tipoCertificado ?? null,
      estado: prog.estado || 'ACTIVO',
      descripcion: prog.descripcion ?? '',
      requistos: prog.requistos ?? '',
      descrServicio: s?.descrServicio ?? prog.nombreProg ?? '',
      tipoServ:
        s?.tipoServ != null && String(s.tipoServ).trim() !== ''
          ? s.tipoServ
          : this.inferirTipoServ(idTipCap),
      facturar: this.facturarStr(s?.facturar),
      iva: this.num(s?.iva),
      tarifaHoraPractica: this.num(horaP?.tarifa1),
      modalidades: prog.modalidades?.length ? [...prog.modalidades] : [MODALIDAD_PRESENCIAL],
    };
  }

  /** Etiqueta del tipo cap. para el formulario (fiel al id guardado en BD). */
  private etiquetaTipCapForm(id: string | number | '' | null | undefined): string {
    if (id == null || id === '') return '';
    const t = this.tiposCap().find((x) => this.idsTipCapCoinciden(x.id, id));
    if (t) return t.label;
    const s = String(id).trim();
    if (s && !/^\d+$/.test(s)) return s;
    return s;
  }



  cerrarModal() {

    this.modalAbierto.set(false);

    this.editando.set(null);
    this.resetPortadaLocal();

  }

  private resetPortadaLocal() {
    const prev = this.portadaPreviewLocal();
    if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
    this.portadaFile.set(null);
    this.portadaPreviewLocal.set(null);
  }

  onPortadaVirtualChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.inform('Seleccione una imagen (JPG, PNG o WebP).', true);
      input.value = '';
      return;
    }
    const prev = this.portadaPreviewLocal();
    if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
    this.portadaFile.set(file);
    this.portadaPreviewLocal.set(URL.createObjectURL(file));
    input.value = '';
  }

  quitarPortadaVirtual() {
    this.resetPortadaLocal();
    this.patch('urlPortadaVirtual', '');
  }



  guardar() {

    const f = this.form();

    if (!f.nombreProg?.trim()) {

      this.inform('El nombre del programa es obligatorio.');

      return;

    }

    if (f.idTipCap === '' || f.idTipCap == null) {

      this.inform('Seleccione el tipo de capacitación.');

      return;

    }

    if (!this.esProgramaJornadasCapForm() && (!f.modalidades || f.modalidades.length === 0)) {
      this.inform('Seleccione al menos una modalidad (Virtual, Presencial o Mixta).');
      return;
    }

    if (
      !this.esProgramaJornadasCapForm() &&
      this.admiteModalidadVirtualForm() &&
      (f.tarifaVirtual ?? 0) <= 0
    ) {
      this.inform('Con modalidad Virtual indique tarifa virtual mayor a 0.');
      return;
    }

    if (
      !this.esProgramaJornadasCapForm() &&
      this.admiteModalidadPresencialForm() &&
      (f.tarifa1 ?? f.valorMatricula ?? 0) <= 0
    ) {
      this.inform('Con modalidad Presencial o Mixta indique tarifa 1 / valor de matrícula.');
      return;
    }

    const esJorn = this.esProgramaJornadasCapForm();

    let idTipCap = this.resolverIdTipCap(f.idTipCap);
    if (esJorn) {
      const jid = this.findTipCapJornadaId();
      if (jid != null && jid !== '') idTipCap = jid;
    }

    const payload: ProgramaDto = {

      ...f,

      idTipCap,

      valorMatricula: esJorn
        ? 0
        : this.esSoloVirtualForm()
          ? (f.tarifaVirtual ?? 0)
          : (f.tarifa1 ?? f.valorMatricula ?? 0),

      tarifa1: esJorn ? 0 : this.esSoloVirtualForm() ? 0 : (f.tarifa1 ?? f.valorMatricula ?? 0),

      tipoCertificado: f.tipoCertificado ?? null,

      descrServicio: (f.descrServicio || f.nombreProg).trim(),

      nomCert: (f.nomCert || f.nombreProg).trim(),

    };

    this.saving.set(true);

    this.inform(null);

    const eraEdicion = !!this.editando();

    const idEdicion = this.editando()?.idPrograma;

    const req = eraEdicion

      ? this.progSvc.actualizar(idEdicion!, payload)

      : this.progSvc.crear(payload);

    req.subscribe({

      next: (r) => {

        const extra = r as ProgramaDetalle & {
          message?: string;
        };
        const idProg = extra.programa?.idPrograma ?? idEdicion;
        const portada = this.portadaFile();
        const finalizar = (msg?: string) => {
          this.saving.set(false);
          this.modalAbierto.set(false);
          this.editando.set(null);
          this.resetPortadaLocal();
          this.catSvc.invalidate('programas');
          this.catSvc.invalidate('servicios');
          if (extra.programa?.idPrograma != null) {
            const id = extra.programa.idPrograma;
            this.programas.update((list) =>
              list.map((p) =>
                String(p.idPrograma) === String(id) ? { ...p, ...extra.programa } : p,
              ),
            );
          }
          this.inform(msg || extra.message || (eraEdicion ? 'Programa actualizado.' : 'Programa creado.'));
          this.cargar();
        };

        if (portada && idProg != null) {
          this.progSvc.subirPortadaVirtual(idProg, portada).subscribe({
            next: (up) => {
              finalizar(up.message || extra.message);
            },
            error: (e) => {
              this.saving.set(false);
              this.inform(
                e?.error?.message ||
                  'Programa guardado, pero no se pudo subir la portada. Edite el programa e intente de nuevo.',
                true,
              );
              this.cargar();
            },
          });
          return;
        }

        finalizar();

      },

      error: (e) => {

        this.saving.set(false);

        const m = e?.error?.message || 'Error al guardar';

        this.inform(e?.status === 403 ? `${m} — Verifique su rol de usuario.` : m, true);

      },

    });

  }



  async eliminar(p: Programa) {

    if (!this.puedeGestionarPrograma()) {
      this.inform('Solo quien administra programas puede eliminar.');

      return;

    }

    const ok = await this.confirm.open({

      title: 'Eliminar programa',

      message: `¿Eliminar permanentemente «${p.nombreProg}» y su servicio de matrícula?`,

      confirmLabel: 'Eliminar',

      variant: 'danger',

    });

    if (!ok) return;

    this.progSvc.eliminar(p.idPrograma).subscribe({

      next: (r) => {

        this.catSvc.invalidate('programas');

        this.catSvc.invalidate('servicios');

        this.inform(r.message || 'Programa eliminado.');

        this.cargar();

      },

      error: (e) => this.inform(e?.error?.message || 'Error al eliminar', true),

    });

  }



  num(v: unknown): number {

    if (v == null) return 0;

    if (typeof v === 'number') return v;

    return Number(v) || 0;

  }



  facturarStr(v: unknown): string {

    if (v === true || v === 'SI' || v === 'si') return 'SI';

    return 'NO';

  }



  fmtFecha(v: unknown): string {

    if (v == null || v === '') return '—';

    const d = v instanceof Date ? v : new Date(String(v));

    if (Number.isNaN(d.getTime())) return String(v);

    return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });

  }



  labelTipoPrograma(p: Programa): string {
    if (this.esProgramaJornadasCapList(p)) {
      return this.etiquetaTipCapJornada();
    }
    return this.labelTipo(p.idTipCap);
  }

  labelTipo(id: string | number | undefined): string {
    if (id == null || id === '') return '—';
    if (this.esTipCapJornadaLabel(String(id))) {
      return this.etiquetaTipCapJornada();
    }
    const canon = this.resolverIdTipCap(id);
    if (this.esTipCapJornadaLabel(String(canon))) {
      return this.etiquetaTipCapJornada();
    }
    const t = this.tiposCap().find((x) => this.idsTipCapCoinciden(x.id, canon));
    if (t) {
      if (this.esTipCapJornadaLabel(t.label)) return this.etiquetaTipCapJornada();
      return t.label;
    }
    const norm = this.normTipoCap(String(id));
    const porEtiqueta = this.tiposCap().find((x) => this.normTipoCap(x.label) === norm);
    if (porEtiqueta) {
      if (this.esTipCapJornadaLabel(porEtiqueta.label)) return this.etiquetaTipCapJornada();
      return porEtiqueta.label;
    }
    return String(id);
  }

  esProgramaJornadasCapList(p: Programa): boolean {
    const tc = String(p.tipoCertificado || '')
      .toLowerCase()
      .replace(/-/g, '_');
    if (tc === 'jornada_capacitacion') return true;
    return (
      this.esTipCapJornadaLabel(String(p.idTipCap ?? '')) ||
      this.esTipCapJornadaLabel(this.labelTipo(p.idTipCap))
    );
  }

  labelModalidadesPrograma(p: Programa): string {
    if (this.esProgramaJornadasCapList(p)) return 'Jornada';
    const labels = p.modalidadLabels?.length ? p.modalidadLabels : etiquetasModalidad(p);
    return labels.length ? labels.join(' · ') : '—';
  }

  private etiquetaTipCapJornada(): string {
    return this.findTipCapJornadaRow()?.label ?? 'Jornadas de Capacitación';
  }

  private findTipCapJornadaRow(): { id: string | number; label: string } | undefined {
    return this.tiposCap().find((t) => this.esTipCapJornadaLabel(t.label));
  }

  private findTipCapJornadaId(): string | number | null {
    const row = this.findTipCapJornadaRow();
    return row?.id ?? null;
  }

  private esTipCapJornadaLabel(text: string): boolean {
    const t = this.normTipoCap(text);
    if (!t) return false;
    return (
      /jornadas? de capacitacion/.test(t) ||
      /jornada capacitacion/.test(t) ||
      /cap jornada/.test(t) ||
      (t.includes('jornada') && t.includes('capacitacion'))
    );
  }

  private normTipoCap(s: string): string {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private idsTipCapCoinciden(a: string | number, b: string | number): boolean {
    if (String(a) === String(b)) return true;
    const na = String(a).match(/^(\d+)/)?.[1];
    const nb = String(b).match(/^(\d+)/)?.[1];
    return !!(na && nb && na === nb);
  }

  private resolverIdTipCap(raw: string | number | '' | null | undefined): string | number {
    if (raw == null || raw === '') return '';
    const sid = String(raw).trim();
    if (this.esTipCapJornadaLabel(sid)) {
      const jid = this.findTipCapJornadaId();
      if (jid != null && jid !== '') return jid;
    }
    const porId = this.tiposCap().find((x) => this.idsTipCapCoinciden(x.id, sid));
    if (porId) {
      if (this.esTipCapJornadaLabel(porId.label)) {
        const jid = this.findTipCapJornadaId();
        if (jid != null && jid !== '') return jid;
      }
      return porId.id;
    }
    const norm = this.normTipoCap(sid);
    const porLabel = this.tiposCap().find(
      (x) => this.normTipoCap(x.label) === norm || this.normTipoCap(String(x.id)) === norm,
    );
    if (porLabel) {
      if (this.esTipCapJornadaLabel(porLabel.label)) {
        const jid = this.findTipCapJornadaId();
        if (jid != null && jid !== '') return jid;
      }
      return porLabel.id;
    }
    const pref = sid.match(/^(\d+)/);
    if (pref) {
      const porNum = this.tiposCap().find((x) => String(x.id) === pref[1]);
      if (porNum) return porNum.id;
    }
    return raw;
  }



  inferirTipoServ(idTipCap: string | number | undefined): string {

    const label = this.labelTipo(idTipCap).toLowerCase();

    if (/licencia|conduccion/.test(label)) return 'CEA';

    if (/diplomado/.test(label)) return 'DIP';

    if (/tecnico|competenc/.test(label)) return 'TEC';

    return 'CUR';

  }

  esLicenciaConduccionForm(): boolean {
    const label = this.labelTipo(this.form().idTipCap).toLowerCase();
    return label.includes('licencia') && label.includes('conduccion');
  }

  previewDescrHoraPractica(): string {
    const f = this.form();
    const nombre = (f.nomCert || f.nombreProg || '').trim();
    const m =
      nombre.match(/\b([ABC]\s*\d?)\b/i) ||
      String(f.codigoProg || '').match(/\b([ABC]\d?)\b/i);
    if (m) {
      const cat = String(m[1]).replace(/\s+/g, '').toUpperCase();
      return `HORA CLASE PRACTICA LICENCIA ${cat}`;
    }
    if (/licencia/i.test(nombre)) return `HORA CLASE PRACTICA ${nombre}`.toUpperCase();
    return nombre ? `HORA CLASE PRACTICA ${nombre}`.toUpperCase() : 'HORA CLASE PRACTICA LICENCIA';
  }

  private esHoraPractica(s: ServicioPrograma | null | undefined): boolean {
    if (!s) return false;
    if (s.rolServicio === 'hora_practica') return true;
    return /\bhora\b.*\bpractica\b/i.test(String(s.descrServicio || ''));
  }

  usaSemestresEnForm(): boolean {
    const s = Number(this.form().semestres);
    return Number.isFinite(s) && s >= 1;
  }

  valorPorSemestrePreview(): number {
    const n = Number(this.form().semestres);
    const total = this.num(this.form().tarifa1 ?? this.form().valorMatricula);
    if (!Number.isFinite(n) || n < 1 || total <= 0) return 0;
    return Math.floor(total / n);
  }

  inferirTipoCert(idTipCap: string | number | undefined, nombreProg?: string): TipoCertificadoId | null {

    const blob = [nombreProg, this.labelTipo(idTipCap)].join(' ').toLowerCase();

    if (/mercanc[ií]as\s*peligrosas|peligrosas\s*clase|transporte\s*de\s*mercanc/.test(blob)) {

      return 'mercancias_peligrosas';

    }

    const label = this.labelTipo(idTipCap).toLowerCase();

    if (/jornadas?\s*de\s*capacitaci[oó]n|cap\s*jornada\s*capacitacion|jornada\s*capacitacion/.test(label)) {
      return 'jornada_capacitacion';
    }

    if (label.includes('competenc')) return 'competencias';

    if (label.includes('diplomado')) return 'diplomado';

    if (label.includes('tecnico')) return 'tecnico';

    if (label.includes('licencia') || label.includes('conduccion')) return 'licencia';

    if (label.includes('curso')) return 'curso';

    return 'curso';

  }

  formatoCertHint(tipo?: string | null): string {

    if (!tipo) {

      return 'Opcional. Independiente del tipo de capacitación; al emitir certificados se usará la plantilla configurada para este formato.';

    }

    const cfg = this.configCert();

    const slot = cfg?.plantillaPorTipo?.[tipo as TipoCertificadoId];

    if (!slot?.id) {

      return `«${labelTipoCert(tipo)}»: asigne la plantilla en Config. Certificados.`;

    }

    const pl = this.plantillasCert().find((p) => p._id === slot.id);

    const ori = labelOrientacion(slot.orientacion);

    return pl ? `Plantilla: ${pl.nombre} (${ori})` : `Plantilla configurada (${ori})`;

  }

  labelTipoCert = labelTipoCert;



  esProgramaJornadasCapForm(): boolean {
    return this.esTipCapJornadaLabel(this.labelTipo(this.form().idTipCap));
  }

  onTipoCapChange(id: string | number) {
    const canon = this.resolverIdTipCap(id);
    this.patch('idTipCap', canon);
    this.patch('tipoServ', this.inferirTipoServ(canon));
    if (this.esTipCapJornadaLabel(this.labelTipo(canon))) {
      this.patch('valorMatricula', 0);
      this.patch('tarifa1', 0);
      this.patch('tarifa2', 0);
      this.patch('tarifa3', 0);
      this.patch('tarifaVirtual', 0);
      this.patch('semestres', null);
    }
  }

  onTipoCertPick(opt: EnumBuscarOption): void {
    const v = String(opt.value);
    this.patch('tipoCertificado', v === '' ? null : (v as TipoCertificadoId));
  }

  onTipoCertLimpiar(): void {
    this.patch('tipoCertificado', null);
  }

  onTipoCapPick(opt: EnumBuscarOption): void {
    if (this.esTipCapJornadaLabel(String(opt.label || ''))) {
      const jid = this.findTipCapJornadaId();
      if (jid != null && jid !== '') {
        this.onTipoCapChange(jid);
        return;
      }
    }
    this.onTipoCapChange(opt.value);
  }

  onTipoCapLimpiar(): void {
    this.patch('idTipCap', '');
  }

  onEstadoPick(opt: EnumBuscarOption): void {
    this.patch('estado', String(opt.value));
  }

  onEstadoLimpiar(): void {
    this.patch('estado', 'ACTIVO');
  }

  onTipoServPick(opt: EnumBuscarOption): void {
    this.patch('tipoServ', String(opt.value));
  }

  onTipoServLimpiar(): void {
    this.patch('tipoServ', '');
  }

  onFacturarPick(opt: EnumBuscarOption): void {
    this.patch('facturar', String(opt.value));
  }

  onFacturarLimpiar(): void {
    this.patch('facturar', 'NO');
  }



  modalTitulo(): string {

    return this.editando() ? `Editar programa #${this.editando()!.idPrograma}` : 'Nuevo programa';

  }

  modalSubtitulo(): string {
    if (this.esProgramaJornadasCapForm()) {
      return 'Jornadas de capacitación: no genera servicio de matrícula (sin cobro al alumno).';
    }
    return this.editando()
      ? 'Datos del programa y servicio de matrícula.'
      : 'El código se asigna si lo deja vacío. El servicio se crea al guardar.';
  }

  private scrollAlFormulario() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = this.formPanel?.nativeElement ?? this.pageHead?.nativeElement;
        el?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    });
  }

  private inform(text: string | null, isErr?: boolean): void {
    this.msg.set(text);
    let err = !!isErr;
    if (!err && text) {
      const t = text.toLowerCase();
      err =
        t.includes('error') ||
        t.includes('no se') ||
        t.includes('inválid') ||
        t.includes('obligator') ||
        t.includes('indique') ||
        t.includes('seleccione') ||
        t.includes('ingrese') ||
        t.includes('solo puede') ||
        t.includes('espere') ||
        t.includes('faltan') ||
        t.includes('contacte') ||
        t.includes('verifique');
    }
    this.msgError.set(err);
  }

  capCodigo = capCodigo;
  capEstado = capEstado;
  capHoras = capHoras;
  capMoneda = capMoneda;
  capTipoCap = capTipoCapLabel;
}

