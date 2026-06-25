import { CommonModule } from '@angular/common';
import { ArgoDateInputComponent } from '../../shared/argo-date-input/argo-date-input.component';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, forkJoin, switchMap } from 'rxjs';

import { AlumnoListItem, AlumnoService } from '../../core/services/alumno.service';
import { AuthService } from '../../core/services/auth.service';
import { JornadaCapDto, JornadaCapService } from '../../core/services/jornada-cap.service';
import { PermisoService } from '../../core/services/permiso.service';
import { AlarmaService } from '../../core/services/alarma.service';
import { CatalogoService } from '../../core/services/catalogo.service';
import {
  ESTADOS_CIVIL_DEF,
  JORNADAS_DEF,
  buildCatalogoLabelMap,
  catalogoLabel,
  TIPO_JORNADAS_CAPACITACION,
} from './catalogo.helpers';
import { ModoAlumnos, rutasAlumnos } from './alumnos-rutas.helpers';
import { nombreCompletoAlumno } from '../../core/utils/mensaje-plantilla.helpers';
import {
  capCelular,
  capDoc,
  capEstadoCivil,
  capFecha,
  capJornada,
  capMunicipio,
} from '../../core/utils/capsule.util';
import { environment } from '../../../environments/environment';
import { formatNumDoc } from '../../core/utils/num-doc.helpers';
import { readVistaLista, saveVistaLista, VistaLista } from '../../core/utils/vista-lista.helpers';
import {
  CatalogoEnumBuscarComponent,
  EnumBuscarOption,
} from '../../shared/catalogo-enum-buscar/catalogo-enum-buscar.component';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { ComprobanteHoyImpresionService } from '../../core/services/comprobante-hoy-impresion.service';
import {
  partesEtiquetaComprobanteAlarma,
  tituloComprobanteAlarma,
} from '../../core/utils/comprobante-alarma.helpers';
import { ymdLocal } from '../jornadas/jornada-calendario.util';

type VistaAlumnos = VistaLista;
type SortColAlumnos =
  | 'fechaReg'
  | 'numDoc'
  | 'nombre'
  | 'fechaNac'
  | 'jornada'
  | 'estadoCivil'
  | 'correo'
  | 'celular'
  | 'direccion'
  | 'munOrigen';
type SortDir = 'asc' | 'desc';

const VISTA_STORAGE_KEY_GENERAL = 'argo-alumnos-vista';
const VISTA_STORAGE_KEY_JORNADA = 'argo-alumnos-jornada-vista';
const SORT_STORAGE_KEY_GENERAL = 'argo-alumnos-sort-v3';
const SORT_STORAGE_KEY_JORNADA = 'argo-alumnos-jornada-sort-v3';

const CERT_JORNADA_OPTS: EnumBuscarOption[] = [
  { value: '', label: 'Todos' },
  { value: 'con', label: 'Con certificado' },
  { value: 'sin', label: 'Sin certificado' },
];

const SORT_COLUMNS: ReadonlyArray<{ key: SortColAlumnos; label: string }> = [
  { key: 'fechaReg', label: 'Registro' },
  { key: 'numDoc', label: 'Documento' },
  { key: 'nombre', label: 'Nombre' },
  { key: 'fechaNac', label: 'Fecha nac.' },
  { key: 'jornada', label: 'Jornada' },
  { key: 'estadoCivil', label: 'Estado civil' },
  { key: 'correo', label: 'Correo' },
  { key: 'celular', label: 'Celular' },
  { key: 'direccion', label: 'Dirección' },
  { key: 'munOrigen', label: 'Mun. origen' },
];

function readSortPrefs(storageKey: string): { col: SortColAlumnos; dir: SortDir } {
  const defecto = { col: 'fechaReg' as SortColAlumnos, dir: 'desc' as SortDir };
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defecto;
    const parsed = JSON.parse(raw) as { col?: string; dir?: string };
    if (parsed.col === 'fechaReg') {
      return { col: 'fechaReg', dir: parsed.dir === 'asc' ? 'asc' : 'desc' };
    }
    const col = SORT_COLUMNS.some((c) => c.key === parsed.col) ? (parsed.col as SortColAlumnos) : defecto.col;
    const dir: SortDir = parsed.dir === 'desc' ? 'desc' : 'asc';
    return { col, dir };
  } catch {
    return defecto;
  }
}

function saveSortPrefs(storageKey: string, col: SortColAlumnos, dir: SortDir): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ col, dir }));
  } catch {
    /* ignore */
  }
}

@Component({
  selector: 'argo-alumnos-lista',
  standalone: true,
  imports: [CommonModule, FormsModule, CatalogoEnumBuscarComponent,
    ArgoDateInputComponent,
  ],
  templateUrl: './alumnos-lista.component.html',
  styleUrls: ['./alumnos-lista.component.scss'],
})
export class AlumnosListaComponent implements OnInit {
  private alumnoSvc = inject(AlumnoService);
  private jornadaCapSvc = inject(JornadaCapService);
  private catSvc = inject(CatalogoService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private permisos = inject(PermisoService);
  private auth = inject(AuthService);
  private confirmSvc = inject(ConfirmDialogService);
  private comprobanteImpresion = inject(ComprobanteHoyImpresionService);
  readonly alarmas = inject(AlarmaService);

  /** general = menú Alumnos; jornadas = solo tipo Jornadas de Capacitación */
  modo = signal<ModoAlumnos>('general');
  rutas = computed(() => rutasAlumnos(this.modo()));
  esJornadas = computed(() => this.modo() === 'jornadas');

  uploads = environment.uploadsUrl;

  private jornadaLabels = buildCatalogoLabelMap([], JORNADAS_DEF, ['idJornada', 'id', 'codigo']);
  private estadoCivilLabels = buildCatalogoLabelMap([], ESTADOS_CIVIL_DEF, ['idEstadoCivil', 'id', 'codigo']);
  catalogosReady = signal(0);

  query = signal('');
  page = signal(0);
  pageSize = 25;
  vista = signal<VistaAlumnos>('lista');
  sortCol = signal<SortColAlumnos>('fechaReg');
  sortDir = signal<SortDir>('desc');

  loading = signal(false);
  items = signal<AlumnoListItem[]>([]);
  total = signal(0);
  msg = signal<string | null>(null);
  msgEsError = signal(false);
  eliminandoId = signal<string | null>(null);

  esAdmin = computed(() => this.auth.isAdmin());
  /** Borrar alumno: solo administradores en listado general (/app/alumnos). */
  puedeEliminar = computed(() => this.esAdmin() && !this.esJornadas());

  /** Filtros solo en modo jornadas de capacitación */
  fechaJornadaCap = signal('');
  idJornadaCap = signal('');
  certJornadaFiltro = signal<'' | 'con' | 'sin'>('');
  jornadasCap = signal<JornadaCapDto[]>([]);
  cargandoJornadasCap = signal(false);
  jornadaFiltroMsg = signal('');

  readonly opcionesCertJornada = CERT_JORNADA_OPTS;

  opcionesJornadasCap = computed<EnumBuscarOption[]>(() =>
    this.jornadasCap().map((j) => ({
      value: j._id,
      label: this.labelJornadaCap(j),
      hint: j.contratoLabel || j.codContrato || undefined,
    })),
  );

  textoJornadaCapSel = computed(() => {
    const id = this.idJornadaCap();
    if (!id) return '';
    const j = this.jornadasCap().find((x) => x._id === id);
    return j ? this.labelJornadaCap(j) : '';
  });

  textoCertJornadaSel = computed(() => {
    const v = this.certJornadaFiltro();
    return CERT_JORNADA_OPTS.find((o) => o.value === v)?.label || '';
  });

  filtroJornadaActivo = computed(() => !!(this.fechaJornadaCap().trim() || this.idJornadaCap().trim()));

  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  pageLabel = computed(() => {
    const t = this.total();
    if (t === 0) return '0 registros';
    const from = this.page() * this.pageSize + 1;
    const to = Math.min((this.page() + 1) * this.pageSize, t);
    return `${from}–${to} de ${t}`;
  });

  private load$ = new Subject<{
    q: string;
    page: number;
    sort: SortColAlumnos;
    dir: SortDir;
    fechaJornada: string;
    idJornada: string;
    certJornada: '' | 'con' | 'sin';
  }>();

  ngOnInit(): void {
    const modo: ModoAlumnos =
      this.route.snapshot.data['modoAlumnos'] === 'jornadas' ? 'jornadas' : 'general';
    this.modo.set(modo);
    const vistaKey = modo === 'jornadas' ? VISTA_STORAGE_KEY_JORNADA : VISTA_STORAGE_KEY_GENERAL;
    const sortKey = modo === 'jornadas' ? SORT_STORAGE_KEY_JORNADA : SORT_STORAGE_KEY_GENERAL;
    this.vista.set(readVistaLista(vistaKey));
    const sortPrefs = readSortPrefs(sortKey);
    this.sortCol.set(sortPrefs.col);
    this.sortDir.set(sortPrefs.dir);

    forkJoin({
      jornada: this.catSvc.list<Record<string, unknown>>('jornada'),
      estadoCivil: this.catSvc.list<Record<string, unknown>>('estadoCivil'),
    }).subscribe({
      next: ({ jornada, estadoCivil }) => {
        this.jornadaLabels = buildCatalogoLabelMap(jornada, JORNADAS_DEF, ['idJornada', 'id', 'codigo']);
        this.estadoCivilLabels = buildCatalogoLabelMap(estadoCivil, ESTADOS_CIVIL_DEF, [
          'idEstadoCivil',
          'id',
          'codigo',
        ]);
        this.catalogosReady.update((n) => n + 1);
      },
      error: () => {
        this.jornadaLabels = buildCatalogoLabelMap([], JORNADAS_DEF, ['idJornada', 'id', 'codigo']);
        this.estadoCivilLabels = buildCatalogoLabelMap([], ESTADOS_CIVIL_DEF, ['idEstadoCivil', 'id', 'codigo']);
        this.catalogosReady.update((n) => n + 1);
      },
    });

    this.load$
      .pipe(
        debounceTime(280),
        switchMap(({ q, page, sort, dir, fechaJornada, idJornada, certJornada }) => {
          this.loading.set(true);
          const opts: {
            q: string;
            limit: number;
            skip: number;
            tipoAlumno?: string;
            sort: SortColAlumnos;
            dir: SortDir;
            idJornada?: string;
            fechaJornada?: string;
            certJornada?: '' | 'con' | 'sin';
          } = {
            q,
            limit: this.pageSize,
            skip: page * this.pageSize,
            sort,
            dir,
          };
          if (this.modo() === 'jornadas') {
            opts.tipoAlumno = TIPO_JORNADAS_CAPACITACION;
            if (idJornada) opts.idJornada = idJornada;
            else if (fechaJornada) opts.fechaJornada = fechaJornada;
            if (certJornada) opts.certJornada = certJornada;
          }
          return this.alumnoSvc.listar(opts);
        }),
      )
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.items.set(res.items || []);
          this.total.set(res.total ?? 0);
          this.jornadaFiltroMsg.set(res.jornadaFiltro?.mensaje || '');
        },
        error: () => {
          this.loading.set(false);
          this.items.set([]);
          this.total.set(0);
          this.jornadaFiltroMsg.set('');
        },
      });

    if (modo === 'jornadas') {
      this.cargarJornadasCapOpciones();
    }

    this.cargar();
  }

  private cargarJornadasCapOpciones() {
    const fecha = this.fechaJornadaCap().trim();
    let desde: string;
    let hasta: string;
    if (fecha) {
      desde = fecha;
      hasta = fecha;
    } else {
      const hoy = new Date();
      const ini = new Date(hoy);
      ini.setDate(ini.getDate() - 90);
      desde = ymdLocal(ini);
      hasta = ymdLocal(hoy);
    }
    this.cargandoJornadasCap.set(true);
    this.jornadaCapSvc.listarJornadas({ desde, hasta }).subscribe({
      next: (rows) => {
        this.cargandoJornadasCap.set(false);
        this.jornadasCap.set(rows || []);
        const id = this.idJornadaCap();
        if (id && !(rows || []).some((j) => j._id === id)) {
          this.idJornadaCap.set('');
        }
      },
      error: () => {
        this.cargandoJornadasCap.set(false);
        this.jornadasCap.set([]);
      },
    });
  }

  onFechaJornadaCap(fecha: string) {
    this.fechaJornadaCap.set(fecha || '');
    this.idJornadaCap.set('');
    this.page.set(0);
    this.cargarJornadasCapOpciones();
    this.cargar();
  }

  onJornadaCapPick(opt: EnumBuscarOption) {
    const id = String(opt?.value || '').trim();
    if (!id) return;
    this.idJornadaCap.set(id);
    const j = this.jornadasCap().find((x) => x._id === id);
    if (j?.fechaProgramacion) {
      this.fechaJornadaCap.set(ymdLocal(j.fechaProgramacion));
    }
    this.page.set(0);
    this.cargar();
  }

  onJornadaCapLimpiar() {
    this.idJornadaCap.set('');
    this.page.set(0);
    this.cargar();
  }

  onCertJornadaPick(opt: EnumBuscarOption) {
    const v = String(opt?.value ?? '') as '' | 'con' | 'sin';
    this.certJornadaFiltro.set(v === 'con' || v === 'sin' ? v : '');
    this.page.set(0);
    this.cargar();
  }

  onCertJornadaLimpiar() {
    this.certJornadaFiltro.set('');
    this.page.set(0);
    this.cargar();
  }

  limpiarFiltrosJornada() {
    this.fechaJornadaCap.set('');
    this.idJornadaCap.set('');
    this.certJornadaFiltro.set('');
    this.page.set(0);
    this.cargarJornadasCapOpciones();
    this.cargar();
  }

  labelJornadaCap(j: JornadaCapDto): string {
    const f = this.formatFecha(j.fechaProgramacion);
    const idx = j.indiceEnDia && j.indiceEnDia > 1 ? ` #${j.indiceEnDia}` : '';
    const m = j.municipio ? ` · ${j.municipio}` : '';
    const cod = (j.codContrato || j.contratoLabel || '').trim();
    return `${cod ? cod + ' · ' : ''}${f}${idx}${m}`;
  }

  tituloCertJornada(r: AlumnoListItem): string {
    const c = r.certificadoJornada;
    if (!c?.generado) return 'Sin certificado generado para la jornada filtrada';
    const parts = ['Certificado generado'];
    if (c.codigoCert) parts.push(c.codigoCert);
    if (c.fechaEmision) parts.push(this.formatFecha(c.fechaEmision));
    return parts.join(' · ');
  }

  etiquetaCertJornada(r: AlumnoListItem): string {
    const c = r.certificadoJornada;
    if (!this.filtroJornadaActivo()) return '—';
    if (!c) return '—';
    if (!c.generado) return 'Sin cert.';
    return c.codigoCert || 'Generado';
  }

  claseCertJornada(r: AlumnoListItem): string {
    if (!this.filtroJornadaActivo()) return 'dim';
    const c = r.certificadoJornada;
    if (!c?.generado) return 'cap cap-slate cap-sm cap-text';
    return 'cap cap-emerald cap-sm cap-text';
  }

  cargar() {
    this.load$.next({
      q: this.query().trim(),
      page: this.page(),
      sort: this.sortCol(),
      dir: this.sortDir(),
      fechaJornada: this.fechaJornadaCap().trim(),
      idJornada: this.idJornadaCap().trim(),
      certJornada: this.certJornadaFiltro(),
    });
  }

  toggleSort(col: SortColAlumnos) {
    if (this.sortCol() === col) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortCol.set(col);
      this.sortDir.set(col === 'fechaReg' ? 'desc' : 'asc');
    }
    const sortKey =
      this.modo() === 'jornadas' ? SORT_STORAGE_KEY_JORNADA : SORT_STORAGE_KEY_GENERAL;
    saveSortPrefs(sortKey, this.sortCol(), this.sortDir());
    this.page.set(0);
    this.cargar();
  }

  sortIcon(col: SortColAlumnos): string {
    if (this.sortCol() !== col) return '↕';
    return this.sortDir() === 'asc' ? '▲' : '▼';
  }

  sortAria(col: SortColAlumnos): string | null {
    if (this.sortCol() !== col) return null;
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  onBuscar(v: string) {
    this.query.set(v);
    this.page.set(0);
    this.cargar();
  }

  setVista(v: VistaAlumnos) {
    this.vista.set(v);
    const vistaKey =
      this.modo() === 'jornadas' ? VISTA_STORAGE_KEY_JORNADA : VISTA_STORAGE_KEY_GENERAL;
    saveVistaLista(vistaKey, v);
  }

  iniciales(r: AlumnoListItem): string {
    const a = (r.nombre1 || r.nombres || '?').charAt(0);
    const b = (r.apellido1 || r.apellidos || '').charAt(0);
    return `${a}${b}`.toUpperCase();
  }

  paginaAnterior() {
    if (this.page() <= 0) return;
    this.page.update((p) => p - 1);
    this.cargar();
  }

  paginaSiguiente() {
    if (this.page() >= this.totalPages() - 1) return;
    this.page.update((p) => p + 1);
    this.cargar();
  }

  nuevo() {
    void this.router.navigate([this.rutas().nuevo]);
  }

  abrir(item: AlumnoListItem) {
    const id = item?._id ? String(item._id) : '';
    if (!id) return;
    void this.router.navigate([this.rutas().ficha(id)]);
  }

  async eliminar(item: AlumnoListItem, ev?: Event) {
    ev?.stopPropagation();
    if (!this.puedeEliminar()) {
      this.mostrarMsg('Solo un administrador puede eliminar alumnos.', true);
      return;
    }
    const id = item?._id ? String(item._id) : '';
    if (!id) return;
    const nombre = this.nombreCompleto(item);
    const doc = this.formatNumDoc(item.numDoc);
    const ok = await this.confirmSvc.open({
      title: 'Eliminar alumno',
      message: `¿Eliminar permanentemente a ${nombre} (${doc})? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    this.eliminandoId.set(id);
    this.alumnoSvc.eliminar(id).subscribe({
      next: () => {
        this.eliminandoId.set(null);
        this.mostrarMsg('Alumno eliminado.');
        this.cargar();
      },
      error: (e) => {
        this.eliminandoId.set(null);
        this.mostrarMsg(e?.error?.message || 'No se pudo eliminar el alumno.', true);
      },
    });
  }

  mostrarMsg(texto: string, error = false) {
    this.msg.set(texto);
    this.msgEsError.set(error);
    setTimeout(() => {
      if (this.msg() === texto) this.msg.set(null);
    }, 6000);
  }

  cerrarMsg() {
    this.msg.set(null);
  }

  abrirTab(item: AlumnoListItem, tab: 'documentos' | 'pagos' | 'programacion', ev: Event) {
    ev.stopPropagation();
    const id = item?._id ? String(item._id) : '';
    if (!id) return;
    void this.router.navigate([this.rutas().ficha(id)], { queryParams: { tab } });
  }

  irHubJornadas() {
    void this.router.navigate([this.rutas().hubJornadas]);
  }

  tieneAlarmas(r: AlumnoListItem): boolean {
    const i = r.indicadores;
    return !!(
      i &&
      (i.docsPendientes > 0 ||
        i.saldosPendientes > 0 ||
        this.tieneClasesCeaCreado(r) ||
        this.tieneComprobanteIngresoHoy(r) ||
        this.tieneComprobanteEgresoHoy(r) ||
        this.tieneFacturaHoy(r))
    );
  }

  tieneComprobanteIngresoHoy(r: AlumnoListItem): boolean {
    if (!this.alarmas.tiene('alarmas.alumnos.comprobante_ingreso')) return false;
    return !!r.indicadores?.comprobanteIngresoHoy?.id;
  }

  tieneComprobanteEgresoHoy(r: AlumnoListItem): boolean {
    if (!this.alarmas.tiene('alarmas.alumnos.comprobante_egreso')) return false;
    return !!r.indicadores?.comprobanteEgresoHoy?.id;
  }

  tieneFacturaHoy(r: AlumnoListItem): boolean {
    if (!this.alarmas.tiene('alarmas.alumnos.factura')) return false;
    return !!r.indicadores?.facturaHoy?.id;
  }

  tituloComprobanteIngreso(r: AlumnoListItem): string {
    const m = r.indicadores?.comprobanteIngresoHoy;
    if (!m) return '';
    return tituloComprobanteAlarma(m, 'ingreso', (n) => this.fmtSaldo(n));
  }

  etiquetaComprobanteIngreso(r: AlumnoListItem): string {
    const m = r.indicadores?.comprobanteIngresoHoy;
    if (!m) return 'Ingreso';
    return partesEtiquetaComprobanteAlarma(m, 'ingreso', (n) => this.fmtSaldo(n)).join(' · ');
  }

  tituloComprobanteEgreso(r: AlumnoListItem): string {
    const m = r.indicadores?.comprobanteEgresoHoy;
    if (!m) return '';
    return tituloComprobanteAlarma(m, 'egreso', (n) => this.fmtSaldo(n));
  }

  etiquetaComprobanteEgreso(r: AlumnoListItem): string {
    const m = r.indicadores?.comprobanteEgresoHoy;
    if (!m) return 'Egreso';
    return partesEtiquetaComprobanteAlarma(m, 'egreso', (n) => this.fmtSaldo(n)).join(' · ');
  }

  tituloFacturaHoy(r: AlumnoListItem): string {
    const m = r.indicadores?.facturaHoy;
    if (!m) return '';
    const ref = m.numeroFactura ? ` ${m.numeroFactura}` : '';
    return `Factura electrónica hoy${ref} · ${this.fmtSaldo(m.valor)}`;
  }

  etiquetaFacturaHoy(r: AlumnoListItem): string {
    const m = r.indicadores?.facturaHoy;
    return m?.numeroFactura || 'Factura';
  }

  abrirComprobanteIngreso(r: AlumnoListItem, ev: Event) {
    ev.preventDefault();
    ev.stopPropagation();
    const id = r.indicadores?.comprobanteIngresoHoy?.id;
    if (!id) return;
    this.comprobanteImpresion.abrirIngreso(id);
  }

  abrirComprobanteEgreso(r: AlumnoListItem, ev: Event) {
    ev.preventDefault();
    ev.stopPropagation();
    const id = r.indicadores?.comprobanteEgresoHoy?.id;
    if (!id) return;
    this.comprobanteImpresion.abrirEgreso(id);
  }

  abrirFacturaHoy(r: AlumnoListItem, ev: Event) {
    ev.preventDefault();
    ev.stopPropagation();
    const id = r.indicadores?.facturaHoy?.id;
    if (!id) return;
    this.comprobanteImpresion.abrirFactura(id);
  }

  puedeVerAlertaCea = computed(() =>
    this.permisos.tiene(['programacion_cea.ver', 'programacion_cea.gestionar', 'programacion_cea.operar']),
  );

  tieneClasesCeaCreado(r: AlumnoListItem): boolean {
    if (!this.puedeVerAlertaCea()) return false;
    if (!this.alarmas.tiene('alarmas.alumnos.clases_cea_creado')) return false;
    return (r.indicadores?.clasesCeaCreado ?? 0) > 0;
  }

  tituloClasesCea(r: AlumnoListItem): string {
    const progs = r.indicadores?.programasCeaCreado || [];
    const nombre = this.nombreCompleto(r);
    if (!progs.length) {
      const n = r.indicadores?.clasesCeaCreado ?? 0;
      return n
        ? `Pendiente programar clase licencia — ${nombre} (${n} clase${n > 1 ? 's' : ''})`
        : '';
    }
    const detalle = progs
      .map((p) => {
        const suf = p.cantidad > 1 ? ` (${p.cantidad} clases)` : '';
        return `${p.programaLabel}${suf}`;
      })
      .join(', ');
    return `Pendiente programar clase licencia ${detalle} — ${nombre}`;
  }

  etiquetaClasesCea(r: AlumnoListItem): string {
    const n = r.indicadores?.clasesCeaCreado ?? 0;
    return n > 1 ? `${n} CEA` : 'CEA';
  }

  tituloDocs(r: AlumnoListItem): string {
    const n = r.indicadores?.docsPendientes ?? 0;
    return n ? `${n} documento(s) pendiente(s)` : '';
  }

  tituloSaldo(r: AlumnoListItem): string {
    const i = r.indicadores;
    if (!i?.saldosPendientes) return '';
    return `${i.saldosPendientes} saldo(s) pendiente(s) · ${this.fmtSaldo(i.saldoTotal)}`;
  }

  fmtSaldo(v: number): string {
    return (v || 0).toLocaleString('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    });
  }

  fotoUrl(f?: string): string | null {
    if (!f) return null;
    if (f.startsWith('http')) return f;
    return `${this.uploads}/${f}`;
  }

  capDoc = capDoc;
  formatNumDoc = formatNumDoc;
  capCelular = capCelular;
  capMunicipio = capMunicipio;
  capJornada = capJornada;
  capEstadoCivil = capEstadoCivil;
  capFecha = capFecha;

  nombreCompleto(r: AlumnoListItem): string {
    return nombreCompletoAlumno(r);
  }

  formatFecha(v?: string | Date | null): string {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  textoMunicipio(r: AlumnoListItem): string {
    if (r.munOrigenLabel) return r.munOrigenLabel;
    const cod = r.codMunicipio || r.munOrigen;
    return cod ? String(cod) : '—';
  }

  labelJornada(r: AlumnoListItem): string {
    this.catalogosReady();
    if (r.jornadaLabel) return r.jornadaLabel;
    const t = catalogoLabel(this.jornadaLabels, r.jornada);
    return t || '—';
  }

  labelEstadoCivil(r: AlumnoListItem): string {
    this.catalogosReady();
    if (r.estadoCivilLabel) return r.estadoCivilLabel;
    const t = catalogoLabel(this.estadoCivilLabels, r.estadoCivil);
    return t || '—';
  }
}
