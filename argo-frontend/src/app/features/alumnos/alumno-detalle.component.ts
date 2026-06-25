import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import {
  AlumnoService,
  FacturaAlarmaHoy,
  MovimientoAlarmaHoy,
} from '../../core/services/alumno.service';
import { AlarmaService } from '../../core/services/alarma.service';
import { AlumnoStore } from '../../core/services/alumno-store.service';
import { LiquidacionItem, LiquidacionService } from '../../core/services/liquidacion.service';
import type { DocumentoPendienteRes } from '../../core/services/config-requisitos-documentos.service';
import { DatosPrincipalesComponent } from './tabs/datos-principales.component';
import { ServiciosComponent } from './tabs/servicios.component';
import { PagosComponent } from './tabs/pagos.component';
import { CertificadosComponent } from './tabs/certificados.component';
import { DocumentosComponent } from './tabs/documentos.component';
import { AlumnoProgramacionCeaComponent } from './tabs/programacion-cea.component';
import { PermisoService } from '../../core/services/permiso.service';
import { ProgramacionCeaService } from '../../core/services/programacion-cea.service';
import { environment } from '../../../environments/environment';
import { etiquetaSaldoCorta, tituloSaldoItem } from '../../core/utils/saldo-alerta.helpers';
import { esLiquidacionVirtual, normalizarTipoAlumno, TIPO_VIRTUAL } from './catalogo.helpers';
import { ModoAlumnos, rutasAlumnos } from './alumnos-rutas.helpers';
import { MigracionHistoricaComponent } from './tabs/migracion-historica.component';
import { MigracionMovimientosService } from '../../core/services/migracion-movimientos.service';
import { ComprobanteHoyImpresionService } from '../../core/services/comprobante-hoy-impresion.service';
import {
  partesEtiquetaComprobanteAlarma,
  tituloComprobanteAlarma,
} from '../../core/utils/comprobante-alarma.helpers';

type TabKey = 'datos' | 'servicios' | 'pagos' | 'certificados' | 'documentos' | 'programacion' | 'migracion';

interface AlertaClaseCeaCreada {
  programaLabel: string;
  cantidad: number;
}

@Component({
  selector: 'argo-alumno-detalle',
  standalone: true,
  imports: [
    CommonModule,
    DatosPrincipalesComponent,
    ServiciosComponent,
    PagosComponent,
    CertificadosComponent,
    DocumentosComponent,
    AlumnoProgramacionCeaComponent,
    MigracionHistoricaComponent,
  ],
  templateUrl: './alumno-detalle.component.html',
  styleUrls: ['./alumno-detalle.component.scss'],
})
export class AlumnoDetalleComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private alumnoSvc = inject(AlumnoService);
  private liqSvc = inject(LiquidacionService);
  private permisos = inject(PermisoService);
  private ceaSvc = inject(ProgramacionCeaService);
  readonly alarmas = inject(AlarmaService);
  private comprobanteImpresion = inject(ComprobanteHoyImpresionService);
  private migMovSvc = inject(MigracionMovimientosService);
  store = inject(AlumnoStore);

  tab = signal<TabKey>('datos');
  loading = signal(false);
  esNuevo = signal(false);
  modo = signal<ModoAlumnos>('general');
  uploads = environment.uploadsUrl;

  rutas = computed(() => rutasAlumnos(this.modo()));
  esJornadas = computed(() => this.modo() === 'jornadas');

  alumno = computed(() => this.store.alumno());
  nombreCompleto = computed(() => this.store.nombreCompleto());
  tituloPagina = computed(() => {
    if (this.esNuevo()) {
      return this.esJornadas() ? 'Nuevo alumno (Jornadas de Capacitación)' : 'Nuevo alumno';
    }
    const n = this.nombreCompleto();
    return n || 'Ficha del alumno';
  });
  etiquetaVolver = computed(() =>
    this.esJornadas() ? '← Lista alumnos jornada' : '← Lista',
  );

  migracionMovimientos = signal(false);

  tabsBase: { key: TabKey; label: string }[] = [
    { key: 'datos',        label: 'Datos Principales' },
    { key: 'servicios',    label: 'Servicios' },
    { key: 'pagos',        label: 'Pagos' },
    { key: 'certificados', label: 'Certificados' },
    { key: 'documentos',   label: 'Documentos' },
    { key: 'migracion',    label: 'Migración histórica' },
    { key: 'programacion', label: 'Programación CEA' },
  ];

  tabs = computed(() => {
    let list = [...this.tabsBase];
    if (!this.migracionMovimientos()) {
      list = list.filter((t) => t.key !== 'migracion');
    }
    if (!this.permisos.tiene(['programacion_cea.ver', 'programacion_cea.gestionar', 'programacion_cea.operar'])) {
      list = list.filter((t) => t.key !== 'programacion');
    }
    return list;
  });

  docsPendientes = signal<DocumentoPendienteRes[]>([]);

  docsPendientesCount = computed(() => this.docsPendientes().length);

  docsPendientesTitulo = computed(() => {
    const list = this.docsPendientes();
    if (!list.length) return '';
    return `Documentos pendientes: ${list.map((p) => p.nombre).join(', ')}`;
  });

  saldosPendientes = signal<LiquidacionItem[]>([]);

  saldosPendientesCount = computed(() => this.saldosPendientes().length);

  saldoTotalPendiente = computed(() =>
    this.saldosPendientes().reduce((acc, it) => acc + this.num(it.saldo), 0),
  );

  saldosPendientesTitulo = computed(() => {
    const list = this.saldosPendientes();
    if (!list.length) return '';
    return list
      .map((it) => tituloSaldoItem(it.descripcion, this.fmtSaldo(it.saldo)))
      .join(' · ');
  });

  clasesCeaCreadoAlertas = signal<AlertaClaseCeaCreada[]>([]);

  comprobanteIngresoHoy = signal<MovimientoAlarmaHoy | null>(null);
  comprobanteEgresoHoy = signal<MovimientoAlarmaHoy | null>(null);
  facturaHoy = signal<FacturaAlarmaHoy | null>(null);

  clasesCeaCreadoCount = computed(() =>
    this.clasesCeaCreadoAlertas().reduce((acc, a) => acc + a.cantidad, 0),
  );

  puedeVerAlertaCea = computed(() =>
    this.permisos.tiene(['programacion_cea.ver', 'programacion_cea.gestionar', 'programacion_cea.operar']),
  );

  tituloClaseCeaCreada(prog: AlertaClaseCeaCreada): string {
    const nombre = this.nombreCompleto() || 'Alumno';
    const suf = prog.cantidad > 1 ? ` (${prog.cantidad} clases)` : '';
    return `Pendiente programar clase licencia ${prog.programaLabel}${suf} — ${nombre}`;
  }

  etiquetaSaldo = etiquetaSaldoCorta;
  tituloSaldoItem = tituloSaldoItem;
  esVirtual = esLiquidacionVirtual;
  esAlumnoVirtual = computed(
    () => normalizarTipoAlumno(this.alumno()?.tipoAlumno) === TIPO_VIRTUAL,
  );

  constructor() {
    effect(() => {
      const id = this.store.alumno()?._id;
      const _docTouch = this.store.alumno()?.fechaMod;
      const _liqTouch = this.store.liqTick();
      if (this.esNuevo() || !id) {
        this.docsPendientes.set([]);
        return;
      }
      void _liqTouch;
      this.revisarDocumentosPendientes(id);
    });

    effect(() => {
      const nd = this.store.numDoc();
      const _liqTouch = this.store.liqTick();
      if (this.esNuevo() || nd == null) {
        this.saldosPendientes.set([]);
        return;
      }
      this.revisarSaldosPendientes(nd);
    });

    effect(() => {
      const nd = this.store.numDoc();
      const _liqTouch = this.store.liqTick();
      if (this.esNuevo() || nd == null || !this.puedeVerAlertaCea()) {
        this.clasesCeaCreadoAlertas.set([]);
        return;
      }
      void _liqTouch;
      this.revisarClasesCeaCreado(nd);
    });

    effect(() => {
      const id = this.store.alumno()?._id;
      const _liqTouch = this.store.liqTick();
      if (this.esNuevo() || !id) {
        this.comprobanteIngresoHoy.set(null);
        this.comprobanteEgresoHoy.set(null);
        this.facturaHoy.set(null);
        return;
      }
      void _liqTouch;
      this.revisarMovimientosHoy(id);
    });
  }

  ngOnInit(): void {
    this.migMovSvc.estado().subscribe({
      next: (st) => this.migracionMovimientos.set(!!st.puedeUsar),
      error: () => this.migracionMovimientos.set(false),
    });

    const modo: ModoAlumnos =
      this.route.snapshot.data['modoAlumnos'] === 'jornadas' ? 'jornadas' : 'general';
    this.modo.set(modo);

    this.route.queryParamMap.subscribe((q) => {
      const t = q.get('tab') as TabKey | null;
      if (t && this.tabs().some((x) => x.key === t) && (!this.esNuevo() || t === 'datos')) {
        this.tab.set(t);
      }
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (!id || id === 'nuevo') {
        this.esNuevo.set(true);
        this.store.clear();
        this.tab.set('datos');
        return;
      }
      this.esNuevo.set(false);
      this.cargarAlumno(id);
    });
  }

  errorMsg = signal<string | null>(null);

  ngOnDestroy(): void {
    this.store.clear();
  }

  revisarDocumentosPendientes(alumnoId: string) {
    this.alumnoSvc.validarDocumentos(alumnoId).subscribe({
      next: (v) => this.docsPendientes.set(v.ok ? [] : v.pendientes || []),
      error: () => this.docsPendientes.set([]),
    });
  }

  irDocumentos() {
    this.setTab('documentos');
  }

  irPagos() {
    this.setTab('pagos');
  }

  irProgramacion() {
    this.setTab('programacion');
  }

  tieneComprobanteIngresoHoy(): boolean {
    return this.alarmas.tiene('alarmas.alumnos.comprobante_ingreso') && !!this.comprobanteIngresoHoy()?.id;
  }

  tieneComprobanteEgresoHoy(): boolean {
    return this.alarmas.tiene('alarmas.alumnos.comprobante_egreso') && !!this.comprobanteEgresoHoy()?.id;
  }

  tieneFacturaHoy(): boolean {
    return this.alarmas.tiene('alarmas.alumnos.factura') && !!this.facturaHoy()?.id;
  }

  tituloComprobanteIngresoHoy(): string {
    const m = this.comprobanteIngresoHoy();
    if (!m) return '';
    return tituloComprobanteAlarma(m, 'ingreso', (n) => this.fmtSaldo(n));
  }

  etiquetaComprobanteIngresoHoy(): string {
    const m = this.comprobanteIngresoHoy();
    if (!m) return 'Ingreso';
    return partesEtiquetaComprobanteAlarma(m, 'ingreso', (n) => this.fmtSaldo(n)).join(' · ');
  }

  tituloComprobanteEgresoHoy(): string {
    const m = this.comprobanteEgresoHoy();
    if (!m) return '';
    return tituloComprobanteAlarma(m, 'egreso', (n) => this.fmtSaldo(n));
  }

  etiquetaComprobanteEgresoHoy(): string {
    const m = this.comprobanteEgresoHoy();
    if (!m) return 'Egreso';
    return partesEtiquetaComprobanteAlarma(m, 'egreso', (n) => this.fmtSaldo(n)).join(' · ');
  }

  tituloFacturaHoy(): string {
    const m = this.facturaHoy();
    if (!m) return '';
    const ref = m.numeroFactura ? ` ${m.numeroFactura}` : '';
    return `Factura electrónica hoy${ref} · ${this.fmtSaldo(m.valor)}`;
  }

  etiquetaFacturaHoy(): string {
    return this.facturaHoy()?.numeroFactura || 'Factura';
  }

  irComprobanteIngresoHoy(ev?: Event) {
    ev?.preventDefault();
    ev?.stopPropagation();
    const id = this.comprobanteIngresoHoy()?.id;
    if (!id) return;
    this.comprobanteImpresion.abrirIngreso(id);
  }

  irComprobanteEgresoHoy(ev?: Event) {
    ev?.preventDefault();
    ev?.stopPropagation();
    const id = this.comprobanteEgresoHoy()?.id;
    if (!id) return;
    this.comprobanteImpresion.abrirEgreso(id);
  }

  irFacturaHoy(ev?: Event) {
    ev?.preventDefault();
    ev?.stopPropagation();
    const id = this.facturaHoy()?.id;
    if (!id) return;
    this.comprobanteImpresion.abrirFactura(id);
  }

  revisarMovimientosHoy(alumnoId: string) {
    this.alumnoSvc.indicadoresMovimientosHoy(alumnoId).subscribe({
      next: (r) => {
        this.comprobanteIngresoHoy.set(r.comprobanteIngresoHoy || null);
        this.comprobanteEgresoHoy.set(r.comprobanteEgresoHoy || null);
        this.facturaHoy.set(r.facturaHoy || null);
      },
      error: () => {
        this.comprobanteIngresoHoy.set(null);
        this.comprobanteEgresoHoy.set(null);
        this.facturaHoy.set(null);
      },
    });
  }

  revisarClasesCeaCreado(numDoc: number | string) {
    if (!this.alarmas.tiene('alarmas.alumnos.clases_cea_creado')) {
      this.clasesCeaCreadoAlertas.set([]);
      return;
    }
    this.ceaSvc.clasesAlumno(numDoc).subscribe({
      next: (rows) => {
        const map = new Map<string, number>();
        for (const c of rows || []) {
          if (c.estado !== 'CREADO') continue;
          const label = c.programaLabel || c.idProg || 'Licencia';
          map.set(label, (map.get(label) || 0) + 1);
        }
        const alertas = [...map.entries()]
          .map(([programaLabel, cantidad]) => ({ programaLabel, cantidad }))
          .sort((a, b) => a.programaLabel.localeCompare(b.programaLabel, 'es'));
        this.clasesCeaCreadoAlertas.set(alertas);
      },
      error: () => this.clasesCeaCreadoAlertas.set([]),
    });
  }

  revisarSaldosPendientes(numDoc: number | string) {
    this.liqSvc.listarPorAlumno(numDoc).subscribe({
      next: (r) => {
        const pendientes = (r.items || [])
          .filter((it) => this.num(it.saldo) > 0.0001)
          .sort((a, b) =>
            String(a.descripcion || '').localeCompare(String(b.descripcion || ''), 'es'),
          );
        this.saldosPendientes.set(pendientes);
      },
      error: () => this.saldosPendientes.set([]),
    });
  }

  num(v: unknown): number {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return Number(v) || 0;
    if (typeof v === 'object' && v !== null && '$numberDecimal' in v) {
      return Number((v as { $numberDecimal: string }).$numberDecimal) || 0;
    }
    return Number(v) || 0;
  }

  fmtSaldo(v: unknown): string {
    return this.num(v).toLocaleString('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    });
  }

  cargarAlumno(id: string) {
    const idNorm = String(id || '').trim();
    if (!idNorm) {
      this.errorMsg.set('Identificador de alumno inválido.');
      return;
    }
    this.loading.set(true);
    this.errorMsg.set(null);
    this.docsPendientes.set([]);
    this.saldosPendientes.set([]);
    this.clasesCeaCreadoAlertas.set([]);
    this.comprobanteIngresoHoy.set(null);
    this.comprobanteEgresoHoy.set(null);
    this.facturaHoy.set(null);
    this.alumnoSvc
      .porId(idNorm)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (a) => {
          this.store.setAlumno(a);
          this.tab.set('datos');
        },
        error: (err) => {
          this.store.clear();
          this.errorMsg.set(err?.error?.message || 'No se pudo cargar el alumno.');
        },
      });
  }

  setTab(t: TabKey) {
    if (this.esNuevo() && t !== 'datos') {
      this.store.pulseSaveAlarm();
      return;
    }
    if (t !== 'datos' && this.store.datosSinGuardar()) {
      this.store.pulseSaveAlarm();
      this.tab.set('datos');
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab: 'datos' },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
      return;
    }
    this.tab.set(t);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: t },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  volver() {
    void this.router.navigate([this.rutas().lista]);
  }

  irHubJornadas() {
    void this.router.navigate([this.rutas().hubJornadas]);
  }

  fotoUrl(): string | null {
    const a = this.alumno() as Record<string, unknown> | null;
    const f = (a?.['urlFoto'] || a?.['foto']) as string | undefined;
    if (!f) return null;
    if (f.startsWith('http')) return f;
    return `${this.uploads}/${f}`;
  }
}
