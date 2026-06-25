import { CommonModule } from '@angular/common';
import { ArgoDateInputComponent } from '../../shared/argo-date-input/argo-date-input.component';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, switchMap } from 'rxjs';

import {
  CertificadoDatosRes,
  CertificadoListItem,
  CertificadoService,
} from '../../core/services/certificado.service';
import { ClienteService, Cliente } from '../../core/services/cliente.service';
import { nombreCompletoAlumno } from '../../core/utils/mensaje-plantilla.helpers';
import { TIPOS_CERTIFICADO, capEncabezadoCert, capTipoFormatoCert, labelTipoCert } from '../../core/constants/tipos-certificado';
import { coincideBusquedaDocumento, coincideBusquedaTexto } from '../../core/utils/busqueda-alumno.helpers';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { SupervisorAuthService } from '../../shared/supervisor-auth/supervisor-auth.service';
import { AuthService } from '../../core/services/auth.service';
import { FormModalComponent } from '../../shared/form-modal/form-modal.component';
import {
  CatalogoEnumBuscarComponent,
  EnumBuscarOption,
} from '../../shared/catalogo-enum-buscar/catalogo-enum-buscar.component';
import {
  TIPOS_ALUMNO_DEF,
  TIPO_ALUMNO_DEFAULT,
  TIPO_JORNADAS_CAPACITACION,
  TipoAlumno,
  normalizarTipoAlumno,
} from '../alumnos/catalogo.helpers';
import { esFechaHoy, ymdCalendario, ymdLocal } from '../jornadas/jornada-calendario.util';
import {
  capAlumnoNombre,
  capCertCodigo,
  capCodContrato,
  capDocAsis,
  capFechaJor,
  capUbicacionJornada,
  rowCertificadoHoyClass,
  ubicacionJornadaLabel,
} from '../jornadas/jornada-ui.util';

@Component({
  selector: 'argo-certificados-lista',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, FormModalComponent, CatalogoEnumBuscarComponent,
    ArgoDateInputComponent,
  ],
  templateUrl: './certificados-lista.component.html',
  styleUrls: ['./certificados-lista.component.scss', './certificados-shared.scss'],
})
export class CertificadosListaComponent implements OnInit, OnDestroy, AfterViewInit {
  private certSvc    = inject(CertificadoService);
  private clienteSvc = inject(ClienteService);
  private confirmSvc = inject(ConfirmDialogService);
  private supervisorAuth = inject(SupervisorAuthService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private readonly recargar$ = new Subject<void>();
  private recargarSub = this.recargar$
    .pipe(
      debounceTime(280),
      switchMap(() =>
        this.certSvc.listarGlobal({
          q: this.filtro().trim() || undefined,
          tipoFormatoCert: this.tipoFormato() || undefined,
          estado: this.estadoFiltro() || undefined,
          empresaId: this.empresaFiltroId() || undefined,
          desde: this.fechaDesde() || undefined,
          hasta: this.fechaHasta() || undefined,
          page: this.paginaActual(),
          limit: this.porPagina,
          cacheBust: Date.now(),
        }),
      ),
    )
    .subscribe({
      next: (res) => {
        this.certificados.set(res.items || []);
        this.totalRegistros.set(res.total || 0);
        this.totalPaginas.set(res.totalPages || 1);
        this.recalcEmitidosHoy();
        this.loading.set(false);
        this.reabrirEditarSiEnLista();
      },
      error: (e) => {
        this.loading.set(false);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'No se pudieron cargar los certificados.');
      },
    });

  readonly porPagina = 100;

  loading = signal(false);
  guardando = signal(false);
  filtro = signal('');
  tipoFormato = signal('');
  estadoFiltro = signal('');
  fechaDesde = signal('');
  fechaHasta = signal('');
  paginaActual = signal(1);
  totalRegistros = signal(0);
  totalPaginas = signal(1);

  // Filtro empresa
  empresaFiltroId    = signal<string | null>(null);
  empresaFiltroNombre = signal('');
  empresaSugerencias = signal<Cliente[]>([]);
  empresaDropdown    = signal(false);
  empresaCargando    = signal(false);

  buscarEmpresaFiltro(q: string) {
    this.empresaFiltroNombre.set(q);
    if (!q.trim()) {
      this.empresaSugerencias.set([]);
      this.empresaDropdown.set(false);
      if (!q) this.seleccionarEmpresaFiltro(null);
      return;
    }
    this.empresaCargando.set(true);
    this.clienteSvc.listar(q.trim()).subscribe({
      next: (rows) => { this.empresaSugerencias.set(rows.slice(0, 8)); this.empresaDropdown.set(rows.length > 0); this.empresaCargando.set(false); },
      error: () => this.empresaCargando.set(false),
    });
  }

  seleccionarEmpresaFiltro(c: Cliente | null) {
    if (!c) {
      this.empresaFiltroId.set(null);
      this.empresaFiltroNombre.set('');
      this.empresaSugerencias.set([]);
      this.empresaDropdown.set(false);
    } else {
      const nombre = c.razonSocial?.trim() || c.nombreComercial?.trim() || c.nombres?.trim() || c.identificacion || '';
      this.empresaFiltroId.set(c._id || null);
      this.empresaFiltroNombre.set(nombre);
      this.empresaSugerencias.set([]);
      this.empresaDropdown.set(false);
    }
    this.paginaActual.set(1);
    this.solicitarRecargaServidor();
  }

  onEmpresaFiltroBlur() { setTimeout(() => this.empresaDropdown.set(false), 200); }
  certificados = signal<CertificadoListItem[]>([]);
  emitidosHoy = signal(0);
  msg = signal<string | null>(null);
  msgError = signal(false);
  editMsg = signal<string | null>(null);
  editMsgError = signal(false);

  modalEditar = signal(false);
  modalTop = signal(80);
  cargandoEditar = signal(false);
  editando = signal<CertificadoListItem | null>(null);
  editId = signal('');
  editEncabezado = signal('');
  editTipoCertificado = signal<TipoAlumno>(TIPO_ALUMNO_DEFAULT);
  editNumActa = signal('');
  editNumFolio = signal('');
  editNumRunt = signal('');
  editObservaciones = signal('');
  editCodVerificacion = signal('');
  editFechaEmision = signal('');
  editFechaVencimiento = signal('');

  readonly tiposFormato = TIPOS_CERTIFICADO.filter((t) => t.id !== 'jornada_capacitacion');
  readonly estadosFiltro = [
    { value: '', label: 'Todos' },
    { value: 'vigente', label: 'Vigente' },
    { value: 'vencido', label: 'Vencido' },
    { value: 'anulado', label: 'Anulado' },
  ] as const;
  readonly tiposCertificadoCat = TIPOS_ALUMNO_DEF;
  readonly capEncabezadoCert = capEncabezadoCert;
  readonly capTipoFormatoCert = capTipoFormatoCert;
  readonly labelTipoCert = labelTipoCert;

  opcionesTipoCertificado = computed<EnumBuscarOption[]>(() =>
    this.tiposCertificadoCat
      .filter((t) => t !== TIPO_JORNADAS_CAPACITACION)
      .map((t) => ({ value: t, label: t })),
  );
  textoTipoCertificadoEdit = computed(() => this.editTipoCertificado() || '');

  @ViewChild('titleAnchor') titleAnchor?: ElementRef<HTMLElement>;
  @ViewChild('pageHead') pageHead?: ElementRef<HTMLElement>;

  private querySub = this.route.queryParamMap.subscribe((map) => {
    const id = map.get('editar')?.trim() || '';
    if (id) {
      if (!this.modalEditar() || this.editId() !== id) this.abrirEditar(id);
    } else if (this.modalEditar()) {
      this.cerrarEditar(false);
    }
  });

  /** Todos los filtros se aplican en el servidor — aquí se expone directamente. */
  filtrados = computed(() => this.certificados());

  readonly capCertCodigo = capCertCodigo;
  readonly capAlumnoNombre = capAlumnoNombre;
  readonly capDocAsis = capDocAsis;
  readonly capCodContrato = capCodContrato;
  readonly capUbicacionJornada = capUbicacionJornada;
  readonly ubicacionJornadaLabel = ubicacionJornadaLabel;
  readonly capFechaJor = capFechaJor;
  readonly rowCertificadoHoyClass = rowCertificadoHoyClass;
  readonly esFechaHoy = esFechaHoy;

  ngOnInit() {
    this.cargar();
  }

  ngAfterViewInit() {
    if (this.modalEditar()) this.posicionarModal();
  }

  ngOnDestroy() {
    this.recargarSub.unsubscribe();
    this.querySub.unsubscribe();
  }

  inform(text: string, esError = false) {
    this.msg.set(text);
    this.msgError.set(esError);
  }

  informEdit(text: string, esError = false) {
    this.editMsg.set(text);
    this.editMsgError.set(esError);
  }

  modalTitulo(): string {
    const c = this.editando();
    return c?.codigoCert ? `Editar certificado ${c.codigoCert}` : 'Editar certificado';
  }

  modalSubtitulo(): string {
    const c = this.editando();
    if (!c) return 'Cargando datos del certificado…';
    const tipo = c.tipoFormatoCertLabel || labelTipoCert(c.tipoFormatoCert);
    const alumno = c.nombreCompleto || 'alumno';
    return `${alumno} · ${tipo || 'tipo no definido'}`;
  }

  onFiltroChange(val: string) {
    this.filtro.set(val);
    this.paginaActual.set(1);
    this.solicitarRecargaServidor();
  }

  onTipoFormatoChange(val: string) {
    this.tipoFormato.set(val);
    this.paginaActual.set(1);
    this.solicitarRecargaServidor();
  }

  onEstadoFiltroChange(val: string) {
    this.estadoFiltro.set(val);
    this.paginaActual.set(1);
    this.solicitarRecargaServidor();
  }

  onFechaDesdeChange(val: string) {
    this.fechaDesde.set(val);
    this.paginaActual.set(1);
    this.solicitarRecargaServidor();
  }

  onFechaHastaChange(val: string) {
    this.fechaHasta.set(val);
    this.paginaActual.set(1);
    this.solicitarRecargaServidor();
  }

  irPagina(p: number) {
    const total = this.totalPaginas();
    const pag = Math.max(1, Math.min(p, total));
    if (pag === this.paginaActual()) return;
    this.paginaActual.set(pag);
    this.solicitarRecargaServidor();
  }

  pagHasta(): number {
    return Math.min(this.paginaActual() * this.porPagina, this.totalRegistros());
  }

  paginasVisibles(): number[] {
    const total = this.totalPaginas();
    const actual = this.paginaActual();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [];
    const start = Math.max(2, actual - 2);
    const end   = Math.min(total - 1, actual + 2);
    pages.push(1);
    if (start > 2) pages.push(-1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < total - 1) pages.push(-1);
    pages.push(total);
    return pages;
  }

  private solicitarRecargaServidor() {
    this.recargar$.next();
  }

  cargar(silencioso = false) {
    if (!silencioso) this.loading.set(true);
    this.certSvc
      .listarGlobal({
        q: this.filtro().trim() || undefined,
        tipoFormatoCert: this.tipoFormato() || undefined,
        estado: this.estadoFiltro() || undefined,
        empresaId: this.empresaFiltroId() || undefined,
        desde: this.fechaDesde() || undefined,
        hasta: this.fechaHasta() || undefined,
        page: this.paginaActual(),
        limit: this.porPagina,
        cacheBust: Date.now(),
      })
      .subscribe({
        next: (res) => {
          this.certificados.set(res.items || []);
          this.totalRegistros.set(res.total || 0);
          this.totalPaginas.set(res.totalPages || 1);
          this.recalcEmitidosHoy();
          this.loading.set(false);
          this.reabrirEditarSiEnLista();
        },
        error: (e) => {
          this.loading.set(false);
          this.msgError.set(true);
          this.msg.set(e?.error?.message || 'No se pudieron cargar los certificados.');
        },
      });
  }

  aplicarFiltrosServidor() {
    this.paginaActual.set(1);
    this.cargar(true);
  }

  limpiarFiltros() {
    this.filtro.set('');
    this.tipoFormato.set('');
    this.estadoFiltro.set('');
    this.empresaFiltroId.set(null);
    this.empresaFiltroNombre.set('');
    this.empresaSugerencias.set([]);
    this.empresaDropdown.set(false);
    this.fechaDesde.set('');
    this.fechaHasta.set('');
    this.paginaActual.set(1);
    this.cargar();
  }

  filtrarSoloHoy() {
    const hoy = ymdLocal(new Date());
    this.fechaDesde.set(hoy);
    this.fechaHasta.set(hoy);
    this.paginaActual.set(1);
    this.cargar();
  }

  onTipoCertPick(opt: EnumBuscarOption): void {
    this.editTipoCertificado.set(normalizarTipoAlumno(String(opt.value)) as TipoAlumno);
  }

  onTipoCertLimpiar(): void {
    this.editTipoCertificado.set(TIPO_ALUMNO_DEFAULT);
  }

  abrirAlumno(c: CertificadoListItem) {
    if (!c.alumnoId) return;
    void this.router.navigate(['/app/alumnos', c.alumnoId], { queryParams: { tab: 'certificados' } });
  }

  abrirEditar(id: string) {
    const idNorm = String(id).trim();
    if (!idNorm) return;
    if (this.cargandoEditar()) return;
    if (this.modalEditar() && this.editId() === idNorm) return;

    const enLista = this.certificados().find((x) => x._id === idNorm);
    if (enLista) {
      this.abrirEditarConItem(enLista);
      return;
    }

    this.editId.set(idNorm);
    this.editando.set(null);
    this.modalEditar.set(true);
    this.cargandoEditar.set(true);
    this.posicionarModal();
    this.certSvc.obtenerDatos(idNorm).subscribe({
      next: (data) => {
        this.cargandoEditar.set(false);
        this.abrirEditarConItem(this.mapDatosAItem(data));
      },
      error: (e) => {
        this.cargandoEditar.set(false);
        this.cerrarEditar();
        this.inform(e?.error?.message || 'No se encontró el certificado.', true);
      },
    });
  }

  private abrirEditarConItem(c: CertificadoListItem) {
    this.editMsg.set(null);
    this.editMsgError.set(false);
    this.editId.set(c._id);
    this.editando.set(c);
    this.editEncabezado.set(c.encabezado || '');
    this.editTipoCertificado.set(normalizarTipoAlumno(c.tipoCertificado));
    this.editNumActa.set(c.numActa || '');
    this.editNumFolio.set(c.numFolio || '');
    this.editNumRunt.set(c.numRunt || '');
    this.editObservaciones.set(c.observaciones || '');
    this.editCodVerificacion.set(c.codVerificacion || '');
    this.editFechaEmision.set(this.fechaInputLocal(c.fechaEmision));
    this.editFechaVencimiento.set(this.fechaInputLocal(c.fechaVencimiento || undefined));
    this.modalEditar.set(true);
    this.posicionarModal();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { editar: c._id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  cerrarEditar(actualizarUrl = true) {
    this.modalEditar.set(false);
    this.editId.set('');
    this.editando.set(null);
    this.editMsg.set(null);
    this.editMsgError.set(false);
    if (actualizarUrl) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { editar: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  guardarEditar() {
    const id = this.editId();
    if (!id) return;
    if (!this.editFechaEmision()) {
      this.informEdit('La fecha de emisión es obligatoria.', true);
      return;
    }
    this.guardando.set(true);
    this.editMsg.set(null);
    const idStr = String(id);
    const prev = this.certificados().find((x) => String(x._id) === idStr);
    const estabaEnLista = !!prev;
    this.certSvc
      .actualizar(idStr, {
        encabezado: this.editEncabezado().trim(),
        tipoCertificado: this.editTipoCertificado(),
        numActa: this.editNumActa().trim(),
        numFolio: this.editNumFolio().trim(),
        numRunt: this.editNumRunt().trim(),
        codVerificacion: this.editCodVerificacion().trim() || null,
        observaciones: this.editObservaciones().trim(),
        fechaEmision: this.editFechaEmision(),
        fechaVencimiento: this.editFechaVencimiento() || null,
      })
      .subscribe({
        next: (c) => {
          this.guardando.set(false);
          if (estabaEnLista) {
            this.certificados.update((list) =>
              list.map((x) =>
                String(x._id) === idStr ? this.fusionarCertActualizado(x, c, prev) : x,
              ),
            );
            this.recalcEmitidosHoy();
          } else {
            this.cargar(true);
          }
          this.inform('Certificado actualizado.');
          this.cerrarEditar();
        },
        error: (e) => {
          this.guardando.set(false);
          this.informEdit(e?.error?.message || 'No se pudo guardar.', true);
        },
      });
  }

  async eliminar(c: CertificadoListItem) {
    const ok = await this.confirmSvc.open({
      title: 'Anular certificado',
      message: `¿Anular el certificado ${c.codigoCert || c._id} de ${c.nombreCompleto || 'el alumno'}? Pasará a estado anulado y conservará su consecutivo.`,
      confirmLabel: 'Anular',
      variant: 'danger',
    });
    if (!ok) return;
    let auth: { autorizadoUsername?: string; autorizadoPassword?: string } | undefined;
    if (!this.auth.isAdmin()) {
      const cred = await this.supervisorAuth.solicitar({
        title: 'Autorización para anular certificado',
        message: `Anular el certificado ${c.codigoCert || c._id} requiere autorización de un administrador.`,
        confirmLabel: 'Autorizar y anular',
      });
      if (!cred) return;
      auth = cred;
    }
    this.certSvc.eliminar(c._id, auth).subscribe({
      next: () => {
        this.certificados.update((list) => list.filter((x) => x._id !== c._id));
        this.msgError.set(false);
        this.msg.set('Certificado eliminado.');
        this.cargar();
      },
      error: (e) => {
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'No se pudo eliminar.');
      },
    });
  }

  imprimir(c: CertificadoListItem) {
    this.certSvc.abrirHtml(c._id, (m) => this.inform(m, true));
  }

  fmtFecha(f?: string | null) {
    if (!f) return '—';
    return new Date(f).toLocaleDateString('es-CO');
  }

  esAnulado(c: CertificadoListItem): boolean {
    return String(c.estado || '').trim().toLowerCase() === 'anulado';
  }

  estadoVigencia(c: CertificadoListItem): 'vigente' | 'vencido' | 'anulado' {
    if (this.esAnulado(c)) return 'anulado';
    if (this.esVencido(c)) return 'vencido';
    return 'vigente';
  }

  esVencido(c: CertificadoListItem): boolean {
    if (this.esAnulado(c)) return false;
    // Confía en el campo estado de BD si ya está marcado como vencido
    if (String(c.estado || '').trim().toLowerCase() === 'vencido') return true;
    // Cálculo en tiempo real: vence hoy (<=) o ya venció (<)
    const fv = this.inicioDia(c.fechaVencimiento);
    const hoy = this.inicioDia(new Date());
    if (!fv || !hoy) return false;
    return fv.getTime() <= hoy.getTime();
  }

  labelEstadoVigencia(c: CertificadoListItem): string {
    if (this.esAnulado(c)) return 'Anulado';
    if (this.esVencido(c)) return 'Vencido';
    return 'Vigente';
  }

  claseEstadoVigencia(c: CertificadoListItem): string {
    if (this.esAnulado(c)) return 'estado-cert-anulado';
    if (this.esVencido(c)) return 'estado-cert-vencido';
    return 'estado-cert-vigente';
  }

  tituloEstadoVigencia(c: CertificadoListItem): string {
    if (this.esAnulado(c)) return 'Certificado anulado';
    if (this.esVencido(c)) {
      return `Certificado vencido · venció ${this.fmtFecha(c.fechaVencimiento)} — contacte al cliente para revalidar`;
    }
    if (c.fechaVencimiento) {
      return `Certificado vigente · vence ${this.fmtFecha(c.fechaVencimiento)}`;
    }
    return 'Certificado vigente · sin fecha de vencimiento registrada';
  }

  private inicioDia(iso?: string | Date | null): Date | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private fechaInputLocal(d?: string | Date | null): string {
    if (!d) return '';
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
    return ymdLocal(new Date(d));
  }

  private fusionarCertActualizado(
    prev: CertificadoListItem,
    actualizado: Partial<CertificadoListItem>,
    fallback?: CertificadoListItem,
  ): CertificadoListItem {
    const base = fallback || prev;
    return {
      ...prev,
      encabezado: actualizado.encabezado ?? prev.encabezado,
      tipoCertificado: actualizado.tipoCertificado ?? prev.tipoCertificado,
      numActa: actualizado.numActa ?? prev.numActa,
      numFolio: actualizado.numFolio ?? prev.numFolio,
      numRunt: actualizado.numRunt ?? prev.numRunt,
      observaciones: actualizado.observaciones ?? prev.observaciones,
      codVerificacion:
        actualizado.codVerificacion !== undefined ? actualizado.codVerificacion : prev.codVerificacion,
      fechaEmision: actualizado.fechaEmision ?? prev.fechaEmision,
      fechaVencimiento:
        actualizado.fechaVencimiento !== undefined
          ? actualizado.fechaVencimiento
          : prev.fechaVencimiento,
      tipoFormatoCert: actualizado.tipoFormatoCert ?? prev.tipoFormatoCert,
      tipoFormatoCertLabel:
        actualizado.tipoFormatoCertLabel ||
        labelTipoCert(actualizado.tipoFormatoCert || prev.tipoFormatoCert) ||
        prev.tipoFormatoCertLabel,
      alumnoId: base.alumnoId,
      nombreCompleto: base.nombreCompleto,
      codContrato: base.codContrato,
      ubicacionJornada: base.ubicacionJornada,
      _id: String(actualizado._id || prev._id),
    };
  }

  private recalcEmitidosHoy() {
    this.emitidosHoy.set(this.certificados().filter((c) => esFechaHoy(c.fechaEmision)).length);
  }

  private posicionarModal() {
    requestAnimationFrame(() => {
      const title = this.titleAnchor?.nativeElement ?? this.pageHead?.nativeElement;
      if (!title) return;
      const rect = title.getBoundingClientRect();
      const bottom = rect.bottom + window.scrollY;
      this.modalTop.set(Math.max(8, Math.round(bottom + 6)));
    });
  }

  /** Si el modal está abierto por URL y el ítem ya cargó en lista, enriquece datos de fila. */
  private reabrirEditarSiEnLista() {
    const id = this.editId();
    if (!id || !this.modalEditar()) return;
    const enLista = this.certificados().find((x) => x._id === id);
    if (enLista) this.editando.set(enLista);
  }

  private mapDatosAItem(data: CertificadoDatosRes): CertificadoListItem {
    const c = data.certificado;
    const al = data.alumno;
    const prog = data.programa;
    const tipoFmt = data.tipoFormatoCert || c.tipoFormatoCert;
    return {
      _id: String(c._id),
      codigoCert: c.codigoCert,
      codVerificacion: (c.codVerificacion as string | null | undefined) ?? null,
      numDoc: c.numDoc,
      alumnoId: al?._id ? String(al._id) : null,
      nombreCompleto: nombreCompletoAlumno(al || {}),
      encabezado: c.encabezado,
      tipoFormatoCert: tipoFmt,
      tipoFormatoCertLabel: labelTipoCert(tipoFmt),
      tipoCertificado: c.tipoCertificado,
      fechaEmision: c.fechaEmision,
      fechaVencimiento: c.fechaVencimiento,
      estado: c.estado,
      numActa: c.numActa,
      numFolio: c.numFolio,
      numRunt: c.numRunt,
      observaciones: c.observaciones,
      programaDescr: prog?.descripcion || prog?.nombreProg || null,
      nomCert: prog?.nomCert || null,
    };
  }
}
