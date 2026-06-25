import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { fromEvent, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

import { AlumnoStore } from '../../../core/services/alumno-store.service';
import { AlumnoService } from '../../../core/services/alumno.service';
import type { DocumentoPendienteRes } from '../../../core/services/config-requisitos-documentos.service';
import { IngresoService } from '../../../core/services/ingreso.service';
import { LiquidacionItem, LiquidacionResumen, LiquidacionService } from '../../../core/services/liquidacion.service';
import { MatriculaService, RevalidacionPreview, CuotasSemestreInfo } from '../../../core/services/matricula.service';
import { ProgramaService } from '../../../core/services/programa.service';
import { ReciboService, idIngreso } from '../../../core/services/recibo.service';
import { ServicioCatalogoService } from '../../../core/services/servicio-catalogo.service';
import { ConfirmDialogService } from '../../../shared/confirm-dialog/confirm-dialog.service';
import { ConfigService } from '../../../core/services/config.service';
import {
  CatalogoEnumBuscarComponent,
  EnumBuscarOption,
} from '../../../shared/catalogo-enum-buscar/catalogo-enum-buscar.component';
import { etiquetaSaldoCorta, tituloSaldoItem } from '../../../core/utils/saldo-alerta.helpers';
import { esLiquidacionVirtual, esTarifaVirtualMatricula, TARIFA_VIRTUAL } from '../catalogo.helpers';
import {
  esProgramaSoloVirtual,
  tarifasPermitidasPrograma,
  etiquetasModalidad,
} from '../../programas/programa-modalidad.helpers';
import { ComboService, ComboPrevista, ComboAplicarRes, Combo } from '../../../core/services/combo.service';
import {
  ConfigServiciosAdicionalesService,
  PreviewServicioAdicionalItem,
} from '../../../core/services/config-servicios-adicionales.service';

@Component({
  selector: 'argo-servicios',
  standalone: true,
  imports: [CommonModule, FormsModule, CatalogoEnumBuscarComponent],
  templateUrl: './servicios.component.html',
  styleUrls: ['./servicios.component.scss'],
})
export class ServiciosComponent implements OnInit {
  store = inject(AlumnoStore);
  private router = inject(Router);
  private alumnoSvc = inject(AlumnoService);
  private progSvc = inject(ProgramaService);
  private servCatSvc = inject(ServicioCatalogoService);
  private matSvc = inject(MatriculaService);
  private liqSvc = inject(LiquidacionService);
  private ingSvc = inject(IngresoService);
  private reciboSvc = inject(ReciboService);
  private confirmSvc = inject(ConfirmDialogService);
  private comboSvc = inject(ComboService);
  private cfgSvc = inject(ConfigService);
  private servAdicCfgSvc = inject(ConfigServiciosAdicionalesService);

  /** Config global: rebaja de valor en matrícula (default true hasta cargar). */
  permitirAjusteValorMatricula = signal(true);
  /** Config global: cuotas personalizadas por semestre. */
  permitirAjusteCuotasSemestre = signal(false);
  /** Preview servicios adicionales al matricular (desde Config). */
  extrasMatriculaPreview = signal<PreviewServicioAdicionalItem[]>([]);

  // --- Combos ---
  combos = signal<Combo[]>([]);
  comboIdSeleccionado = signal<string>('');
  comboPrevista = signal<ComboPrevista | null>(null);
  comboResultado = signal<ComboAplicarRes | null>(null);
  aplicandoCombo = signal(false);

  /** Detalle del programa elegido (búsqueda remota). */
  programaDetalle = signal<any | null>(null);
  serviciosMatriculaProg = signal<any[]>([]);
  textoProgramaLabel = signal('');

  /** Detalle del servicio adicional elegido (búsqueda remota). */
  servicioAdicionalDetalle = signal<any | null>(null);
  textoServicioLabel = signal('');

  opcionesCombos = computed<EnumBuscarOption[]>(() =>
    this.combos().map((c) => ({ value: c.id, label: c.nombre })),
  );

  // form matrícula
  idProg = signal<string>('');
  tarifa = signal<1 | 2 | 3 | 4>(1);
  tarifaManual = signal(false);
  revalidacionPreview = signal<RevalidacionPreview | null>(null);
  matriculaCrearPortal = true;
  matriculaEmailPortal = '';
  matriculaPasswordPortal = '';
  matriculaCredenciales = signal<{ email: string; password: string } | null>(null);
  ajustarValorMat = false;
  valorAcordadoMat: number | null = null;
  motivoAjusteMat = '';

  /** Cuotas por semestre al crear matrícula (enteros COP; null = campo vacío mientras edita). */
  ajustarCuotasSemestre = false;
  valoresCuotasSemestre = signal<(number | null)[]>([]);
  motivoAjusteCuotas = '';

  /** Editor de cuotas en matrículas existentes. */
  cuotasEditorId = signal<string | null>(null);
  cuotasEditorData = signal<CuotasSemestreInfo | null>(null);
  cuotasEditorDraft = signal<(number | null)[]>([]);
  cuotasEditorMotivo = '';
  cuotasEditorLoading = signal(false);
  cuotasEditorSaving = signal(false);
  matriculasAlumno = signal<any[]>([]);

  // form servicio adicional
  idServ = signal<string>('');
  servDescripcion = signal<string>('');
  servValor = signal<number>(0);
  servCantidad = signal<number>(1);

  liquidacion = signal<LiquidacionResumen>({ items: [], totales: { valor: 0, abonado: 0, saldo: 0 } });
  comprobantes = signal<any[]>([]);
  itemRecibosAbierto = signal<string | null>(null);
  loading = signal(false);
  msg = signal<string | null>(null);
  msgEsError = signal(false);
  docsPendientesMat = signal<DocumentoPendienteRes[]>([]);

  private lastRecargaNumDoc: string | number | null = null;

  itemsConSaldo = computed(() =>
    this.liquidacion()
      .items.filter((i) => this.num(i.saldo) > 0.0001)
      .sort((a, b) =>
        String(a.descripcion || '').localeCompare(String(b.descripcion || ''), 'es'),
      ),
  );

  tieneVirtualConSaldo = computed(() =>
    this.itemsConSaldo().some((it) => this.esVirtual(it)),
  );

  etiquetaSaldo = etiquetaSaldoCorta;
  tituloSaldoItem = tituloSaldoItem;

  comprobantesPorItem = (idLiq: string) =>
    this.comprobantes().filter((p) => {
      if (String(p.idLiquidacion) === String(idLiq)) return true;
      return Array.isArray(p.detalle) && p.detalle.some((d: { idLiquidacion?: string }) => String(d.idLiquidacion) === String(idLiq));
    });

  descrComprobante(p: { idLiquidacion?: string; liquidacionDescr?: string }): string {
    if (p.liquidacionDescr) return p.liquidacionDescr;
    const it = this.liquidacion().items.find((i) => String(i._id) === String(p.idLiquidacion));
    return it?.descripcion || '—';
  }

  tipoAbonoLabel(p: { tipoAbono?: string; tipoAbonoDescr?: string }): string {
    if (p.tipoAbonoDescr) return p.tipoAbonoDescr;
    if (p.tipoAbono === 'total') return 'Total';
    if (p.tipoAbono === 'abono') return 'Abono';
    return '—';
  }

  tipoAbonoClass(p: { tipoAbono?: string }): string {
    if (p.tipoAbono === 'total') return 'ok';
    if (p.tipoAbono === 'abono') return 'warn';
    return '';
  }

  programaSel = computed(() => {
    const id = this.idProg();
    const det = this.programaDetalle();
    if (!id || !det) return null;
    const detId = String(det.idPrograma ?? det.idProg ?? det._id);
    return detId === id ? det : null;
  });

  serviciosPrograma = computed(() =>
    this.serviciosMatriculaProg().filter((s) => !this.esHoraPractica(s)),
  );

  programaTieneTarifaVirtual = computed(() =>
    tarifasPermitidasPrograma(this.programaSel(), this.serviciosPrograma()).includes(TARIFA_VIRTUAL),
  );

  programaSoloVirtual = computed(() =>
    esProgramaSoloVirtual(this.programaSel(), this.serviciosPrograma()),
  );

  modalidadProgramaLabel = computed(() => {
    const p = this.programaSel();
    if (!p) return '';
    const labels = p.modalidadLabels?.length ? p.modalidadLabels : etiquetasModalidad(p);
    return labels.join(' · ');
  });

  tarifasPermitidasMat = computed(() =>
    tarifasPermitidasPrograma(this.programaSel(), this.serviciosPrograma()),
  );

  esTarifaVirtualSeleccionada = computed(() => esTarifaVirtualMatricula(this.tarifa()));

  puedeAjustarValorMat = computed(() => {
    if (!this.permitirAjusteValorMatricula()) return false;
    if (!this.idProg() || this.esTarifaVirtualSeleccionada()) return false;
    if (this.ajustarCuotasSemestre) return false;
    return this.valorMatriculaBase() > 0;
  });

  puedeAjustarCuotasSemestre = computed(() => {
    if (!this.permitirAjusteCuotasSemestre()) return false;
    if (!this.idProg() || this.esTarifaVirtualSeleccionada()) return false;
    return this.cuotasSemestreCatalogo().length >= 2;
  });

  numCuotasSemestre = computed(() => this.cuotasSemestreCatalogo().length);

  cuotasSemestreCatalogo = computed(() => {
    const t = this.tarifa();
    return this.serviciosPrograma().map((s) => {
      const v = s[`tarifa${t}`];
      if (v != null && v !== '') return this.num(v);
      return this.num(s.tarifa1);
    });
  });

  totalCuotasSemestre = computed((): number =>
    this.valoresCuotasSemestre().reduce<number>((acc, v) => acc + (v ?? 0), 0),
  );

  totalCuotasEditor = computed((): number =>
    this.cuotasEditorDraft().reduce<number>((acc, v) => acc + (v ?? 0), 0),
  );

  matriculasCuotasEditables = computed(() => {
    if (!this.permitirAjusteCuotasSemestre()) return [];
    const mats = this.matriculasAlumno();
    const items = this.liquidacion().items;
    return mats.filter((m) => {
      const tarifa = Number(m.tarifa);
      if (tarifa === 4) return false;
      const idMat = String(m._id);
      const cuotas = items.filter(
        (it) => it.idMat && String(it.idMat) === idMat && it.idProg && !this.esVirtual(it),
      );
      return cuotas.length >= 2;
    });
  });

  esProgramaTecnico = computed(() => {
    const p = this.programaSel();
    if (!p) return false;
    const cod = String(p.codigoProg || '').trim().toUpperCase();
    if (cod.startsWith('TEC')) return true;
    const tip = String(p.idTipCap || '').toLowerCase();
    return /tecnico|competenc/.test(tip);
  });

  totalExtrasMatricula = computed(() =>
    this.extrasMatriculaPreview().reduce((acc, i) => acc + this.num(i.valor), 0),
  );

  valorMatriculaBase = computed(() => {
    const p = this.programaSel();
    if (!p) return 0;
    const t = this.tarifa();
    if (esTarifaVirtualMatricula(t)) {
      return this.serviciosPrograma().reduce((acc, s) => acc + this.num(s.tarifaVirtual), 0);
    }
    const sem = Number(p.semestres);
    const porProg = this.serviciosPrograma();
    if (Number.isFinite(sem) && sem >= 1 && porProg.length > 0) {
      return porProg.reduce((acc, s) => {
        const v = s[`tarifa${t}`];
        if (v != null && v !== '') return acc + this.num(v);
        return acc + this.num(s.tarifa1);
      }, 0);
    }
    const serv = porProg[0];
    if (serv) {
      const v = serv[`tarifa${t}`];
      if (v != null && v !== '') return this.num(v);
    }
    return this.num(p.valorMatricula);
  });

  programaNumSemestres = computed(() => {
    const sem = Number(this.programaSel()?.semestres);
    const n = this.serviciosPrograma().length;
    if (Number.isFinite(sem) && sem >= 2) return Math.floor(sem);
    return n >= 2 ? n : 0;
  });

  valorMatFinal = computed(() => {
    if (this.ajustarCuotasSemestre && this.puedeAjustarCuotasSemestre()) {
      return this.totalCuotasSemestre() + this.totalExtrasMatricula();
    }
    if (!this.ajustarValorMat || !this.puedeAjustarValorMat()) return this.valorMatCalculado();
    const v = Math.round(Number(this.valorAcordadoMat));
    const base = Number.isFinite(v) && v >= 0 ? v : this.valorMatriculaBase();
    return base + this.totalExtrasMatricula();
  });

  valorMatriculaMostrar = computed(() => {
    if (this.ajustarCuotasSemestre && this.puedeAjustarCuotasSemestre()) {
      return this.totalCuotasSemestre();
    }
    if (this.ajustarValorMat && this.puedeAjustarValorMat()) {
      return this.valorMatFinal() - this.totalExtrasMatricula();
    }
    return this.valorMatriculaBase();
  });

  rebajaMatricula = computed(() => {
    const cat = this.valorMatriculaBase();
    const fin = this.ajustarValorMat && this.puedeAjustarValorMat()
      ? Math.round(Number(this.valorAcordadoMat))
      : cat;
    const acordadoBase = Number.isFinite(fin) && fin >= 0 ? fin : cat;
    return cat > acordadoBase ? cat - acordadoBase : 0;
  });

  valorMatCalculado = computed(() => this.valorMatriculaBase() + this.totalExtrasMatricula());

  servicioSel = computed(() => {
    const id = this.idServ();
    const cached = this.servicioAdicionalDetalle();
    if (cached && String(cached.idServ ?? cached._id) === id) return cached;
    return undefined;
  });

  servicioUsaCantidad = computed(() => {
    if (!this.idServ()) return false;
    return this.permiteCantidad(this.servicioSel());
  });

  cantidadLabel = computed(() =>
    this.esHoraPractica(this.servicioSel()) ? 'Cantidad (horas)' : 'Cantidad',
  );

  tarifaUnitariaLabel = computed(() =>
    this.esHoraPractica(this.servicioSel()) ? 'Tarifa / hora' : 'Tarifa unitaria',
  );

  servValorTotal = computed(() => {
    if (this.servicioUsaCantidad()) {
      const unit = this.num(this.servicioSel()?.tarifa1);
      const cant = Math.max(1, Math.floor(this.servCantidad()));
      return unit * cant;
    }
    return this.servValor();
  });

  textoPrograma = computed(() => this.textoProgramaLabel());

  buscarProgramasRemoto = (q: string): Observable<EnumBuscarOption[]> => {
    const t = q.trim();
    return this.progSvc
      .listar({ q: t || undefined, catalogo: true, limit: t ? 35 : 40 })
      .pipe(map((rows) => (rows || []).map((p) => this.programaToOption(p))));
  };

  opcionesTarifas = computed<EnumBuscarOption[]>(() => {
    const permitidas = this.tarifasPermitidasMat();
    const opts: EnumBuscarOption[] = [];
    if (permitidas.includes(1)) {
      opts.push({ value: 1, label: 'Tarifa 1' });
    }
    if (permitidas.includes(2)) {
      opts.push({ value: 2, label: 'Tarifa 2' });
    }
    if (permitidas.includes(3)) {
      opts.push({
        value: 3,
        label: this.programaSel()?.admiteRevalidacion ? 'Tarifa 3 (refrendación)' : 'Tarifa 3',
      });
    }
    if (permitidas.includes(TARIFA_VIRTUAL)) {
      opts.push({ value: TARIFA_VIRTUAL, label: 'Virtual (aula en línea)' });
    }
    return opts;
  });

  textoTarifa = computed(() => {
    const t = this.tarifa();
    const opt = this.opcionesTarifas().find((o) => Number(o.value) === t);
    return opt?.label || `Tarifa ${t}`;
  });

  textoServicioAdicional = computed(() => this.textoServicioLabel());

  buscarServiciosAdicionalesRemoto = (q: string): Observable<EnumBuscarOption[]> => {
    const t = q.trim();
    return this.servCatSvc
      .listar({ q: t || undefined, sinPrograma: true, catalogo: true, limit: t ? 35 : 40 })
      .pipe(
        map((rows) =>
          (rows || []).map((s) => ({
            value: String(s.idServ ?? s._id),
            label: String(s.descrServicio || '').trim(),
          })),
        ),
      );
  };

  constructor() {
    fromEvent(document, 'visibilitychange')
      .pipe(
        filter(() => document.visibilityState === 'visible'),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.cargarOpcionesMatricula());

    this.comboSvc.listar().subscribe({ next: (d) => this.combos.set(d || []), error: () => {} });

    effect(() => {
      const nd = this.store.numDoc();
      const prog = this.idProg();
      const id = this.store.alumno()?._id;
      const _docTouch = this.store.alumno()?.fechaMod;
      const _liq = this.store.liqTick();
      if (!nd) {
        this.lastRecargaNumDoc = null;
        this.liquidacion.set({ items: [], totales: { valor: 0, abonado: 0, saldo: 0 } });
        this.comprobantes.set([]);
      } else {
        const soloSync = this.lastRecargaNumDoc === nd && _liq > 0;
        this.lastRecargaNumDoc = nd;
        this.recargar(nd, { silencioso: soloSync });
      }
      if (id && prog) this.revisarDocsMatricula(id, prog);
      else this.docsPendientesMat.set([]);
    });
  }

  ngOnInit(): void {
    this.cargarOpcionesMatricula();
  }

  private cargarPreviewMatricula(): void {
    const id = this.idProg();
    if (!id) {
      this.extrasMatriculaPreview.set([]);
      return;
    }
    this.servAdicCfgSvc.previewMatricula(id, this.tarifa()).subscribe({
      next: (r) => this.extrasMatriculaPreview.set(r.items || []),
      error: () => this.extrasMatriculaPreview.set([]),
    });
  }

  private cargarOpcionesMatricula(): void {
    this.cfgSvc.obtenerReciboOpcionesMatricula().subscribe({
      next: (c) => {
        const okRebaja = c.permitirAjusteValorMatricula !== false;
        const okCuotas = c.permitirAjusteCuotasSemestre === true;
        this.permitirAjusteValorMatricula.set(okRebaja);
        this.permitirAjusteCuotasSemestre.set(okCuotas);
        if (!okRebaja) this.limpiarAjusteValorMat();
        if (!okCuotas) this.limpiarAjusteCuotasSemestre();
      },
      error: () => {
        this.permitirAjusteValorMatricula.set(true);
        this.permitirAjusteCuotasSemestre.set(false);
      },
    });
  }

  revisarDocsMatricula(alumnoId: string, idPrograma: string) {
    this.alumnoSvc.validarDocumentos(alumnoId, idPrograma).subscribe({
      next: (v) => this.docsPendientesMat.set(v.ok ? [] : v.pendientes || []),
      error: () => this.docsPendientesMat.set([]),
    });
  }

  irDocumentos() {
    this.router.navigate([], { queryParams: { tab: 'documentos' }, queryParamsHandling: 'merge' });
  }

  irPagosItem(_idLiq?: string) {
    void _idLiq;
    this.router.navigate([], { queryParams: { tab: 'pagos' }, queryParamsHandling: 'merge' });
  }

  recargar(numDoc: number | string, opts: { notificar?: boolean; silencioso?: boolean } = {}) {
    const { notificar = false, silencioso = false } = opts;
    if (!silencioso) this.loading.set(true);
    let pending = 2;
    const done = () => {
      pending -= 1;
      if (pending > 0) return;
      if (notificar) this.store.touchLiquidacion();
    };
    this.liqSvc.listarPorAlumno(numDoc).subscribe({
      next: (r) => {
        this.liquidacion.set(r);
        done();
      },
      error: () => {
        if (!silencioso) this.loading.set(false);
        done();
      },
    });
    this.ingSvc.listarPorAlumno(numDoc).subscribe({
      next: (r) => {
        this.comprobantes.set(r || []);
        if (!silencioso) this.loading.set(false);
        done();
      },
      error: () => {
        if (!silencioso) this.loading.set(false);
        done();
      },
    });
    this.matSvc.listarPorAlumno(numDoc).subscribe({
      next: (rows) => this.matriculasAlumno.set(rows || []),
      error: () => this.matriculasAlumno.set([]),
    });
  }

  setTarifa(v: number | string) {
    const n = Number(v);
    const permitidas = this.tarifasPermitidasMat();
    if (n === 1 || n === 2 || n === 3 || n === TARIFA_VIRTUAL) {
      if (n === TARIFA_VIRTUAL && !permitidas.includes(TARIFA_VIRTUAL)) return;
      if ((n === 1 || n === 2 || n === 3) && !permitidas.includes(n)) return;
      this.tarifa.set(n as 1 | 2 | 3 | 4);
      if (n === TARIFA_VIRTUAL) {
        this.limpiarAjusteValorMat();
        this.limpiarAjusteCuotasSemestre();
      } else {
        this.syncValorAcordadoMat();
        this.syncCuotasDesdeCatalogo();
      }
      this.cargarPreviewMatricula();
    }
  }

  private ajustarTarifaPermitida(): void {
    const permitidas = this.tarifasPermitidasMat();
    if (!permitidas.length) return;
    if (!permitidas.includes(this.tarifa())) {
      this.tarifa.set(permitidas[0] as 1 | 2 | 3 | 4);
    }
  }

  private limpiarAjusteValorMat(): void {
    this.ajustarValorMat = false;
    this.valorAcordadoMat = null;
    this.motivoAjusteMat = '';
  }

  private limpiarAjusteCuotasSemestre(): void {
    this.ajustarCuotasSemestre = false;
    this.valoresCuotasSemestre.set([]);
    this.motivoAjusteCuotas = '';
  }

  /** Entero COP ≥ 0; null si vacío o inválido (no se fuerza 0 al borrar). */
  private normalizarCuotaEntera(raw: number | string | null | undefined): number | null {
    if (raw === '' || raw === null || raw === undefined) return null;
    const v = Math.round(Number(raw));
    if (!Number.isFinite(v) || v < 0) return null;
    return v;
  }

  private cuotasDesdeCatalogo(): (number | null)[] {
    return this.cuotasSemestreCatalogo().map((v) => Math.round(v));
  }

  private syncCuotasDesdeCatalogo(): void {
    if (this.ajustarCuotasSemestre && this.puedeAjustarCuotasSemestre()) {
      this.valoresCuotasSemestre.set(this.cuotasDesdeCatalogo());
    }
  }

  onAjustarCuotasSemestreChange(activo: boolean): void {
    this.ajustarCuotasSemestre = activo;
    if (activo) {
      this.limpiarAjusteValorMat();
      this.valoresCuotasSemestre.set(this.cuotasDesdeCatalogo());
    } else {
      this.valoresCuotasSemestre.set([]);
      this.motivoAjusteCuotas = '';
    }
  }

  onCuotaSemestreChange(index: number, raw: number | string | null): void {
    const next = [...this.valoresCuotasSemestre()];
    next[index] = this.normalizarCuotaEntera(raw);
    this.valoresCuotasSemestre.set(next);
  }

  repartirCuotasEquitativo(): void {
    const n = this.valoresCuotasSemestre().length || this.numCuotasSemestre();
    if (!n) return;
    const total = this.totalCuotasSemestre() || this.valorMatriculaBase();
    const base = Math.floor(total / n);
    const arr: number[] = Array(n).fill(base);
    let rest = total - base * n;
    for (let i = 0; i < rest; i++) arr[i] += 1;
    this.valoresCuotasSemestre.set(arr);
  }

  restaurarCuotasCatalogo(): void {
    this.valoresCuotasSemestre.set(this.cuotasDesdeCatalogo());
  }

  trackByCuotaIndex = (index: number): number => index;

  resolverCuotasSemestreNumeros(): number[] | null {
    const vals = this.valoresCuotasSemestre();
    const esperado = this.numCuotasSemestre();
    if (vals.length !== esperado) return null;
    const nums: number[] = [];
    for (const v of vals) {
      if (v === null || !Number.isFinite(v) || v < 0) return null;
      nums.push(Math.round(v));
    }
    return nums;
  }

  etiquetaSemestre(index: number): string {
    const serv = this.serviciosPrograma()[index];
    const descr = String(serv?.descrServicio || serv?.descripcion || '').trim();
    if (descr) return descr;
    return `Semestre ${index + 1}`;
  }

  cuotaSemestreInvalida(index: number): boolean {
    const v = this.valoresCuotasSemestre()[index];
    return v === null;
  }

  abrirEditorCuotas(idMatricula: string): void {
    if (this.cuotasEditorId() === idMatricula) {
      this.cerrarEditorCuotas();
      return;
    }
    this.cuotasEditorId.set(idMatricula);
    this.cuotasEditorData.set(null);
    this.cuotasEditorDraft.set([]);
    this.cuotasEditorMotivo = '';
    this.cuotasEditorLoading.set(true);
    this.matSvc.obtenerCuotasSemestre(idMatricula).subscribe({
      next: (info) => {
        this.cuotasEditorLoading.set(false);
        if (!info.permitido || !info.configHabilitada) {
          this.setMsg(info.motivo || 'No se pueden editar las cuotas de esta matrícula.', true);
          this.cerrarEditorCuotas();
          return;
        }
        this.cuotasEditorData.set(info);
        this.cuotasEditorDraft.set((info.cuotas || []).map((c) => Math.round(c.valor)));
      },
      error: (e) => {
        this.cuotasEditorLoading.set(false);
        this.setMsg(e?.error?.message || 'No se pudieron cargar las cuotas.', true);
        this.cerrarEditorCuotas();
      },
    });
  }

  cerrarEditorCuotas(): void {
    this.cuotasEditorId.set(null);
    this.cuotasEditorData.set(null);
    this.cuotasEditorDraft.set([]);
    this.cuotasEditorMotivo = '';
  }

  onCuotaEditorChange(index: number, raw: number | string | null): void {
    const next = [...this.cuotasEditorDraft()];
    next[index] = this.normalizarCuotaEntera(raw);
    this.cuotasEditorDraft.set(next);
  }

  cuotaEditorInvalida(index: number): boolean {
    const info = this.cuotasEditorData();
    const cuota = info?.cuotas?.[index];
    if (!cuota) return false;
    const v = this.cuotasEditorDraft()[index];
    if (v === null) return true;
    return v < cuota.abonado;
  }

  guardarCuotasEditor(): void {
    const id = this.cuotasEditorId();
    const info = this.cuotasEditorData();
    if (!id || !info?.cuotas?.length) return;

    const draft = this.cuotasEditorDraft();
    for (let i = 0; i < info.cuotas.length; i++) {
      const c = info.cuotas[i];
      const v = draft[i];
      if (v === null || !Number.isFinite(v) || v < 0) {
        this.setMsg(`Indique un valor entero válido en ${c.descripcion}.`, true);
        return;
      }
      if (v < c.abonado) {
        this.setMsg(
          `${c.descripcion}: el valor no puede ser menor que lo abonado (${this.fmt(c.abonado)}).`,
          true,
        );
        return;
      }
    }

    this.cuotasEditorSaving.set(true);
    this.matSvc
      .actualizarCuotasSemestre(id, {
        cuotas: info.cuotas.map((c, i) => ({
          idLiquidacion: c.idLiquidacion,
          valor: Math.round(draft[i]!),
        })),
        motivoAjuste: this.cuotasEditorMotivo.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.cuotasEditorSaving.set(false);
          const nd = this.store.numDoc();
          if (nd) this.recargar(nd, { notificar: true });
          this.cerrarEditorCuotas();
          this.setMsg('Cuotas por semestre actualizadas. El total de matrícula se recalculó.', false);
        },
        error: (e) => {
          this.cuotasEditorSaving.set(false);
          this.setMsg(e?.error?.message || 'Error al guardar las cuotas.', true);
        },
      });
  }

  nombreProgramaMatricula(m: { idProg?: string; idPrograma?: string }): string {
    const id = String(m.idProg || m.idPrograma || '');
    const it = this.liquidacion().items.find((i) => i.idProg && String(i.idProg) === id);
    return it?.descripcion?.replace(/^\d+\s+SEM\s+\w+\s+/i, '').trim() || `Programa ${id}`;
  }

  private syncValorAcordadoMat(): void {
    if (this.ajustarValorMat) {
      this.valorAcordadoMat = this.valorMatriculaBase();
    }
  }

  onAjustarValorMatChange(activo: boolean): void {
    this.ajustarValorMat = activo;
    if (activo) {
      this.limpiarAjusteCuotasSemestre();
      this.valorAcordadoMat = this.valorMatriculaBase();
    } else {
      this.valorAcordadoMat = null;
      this.motivoAjusteMat = '';
    }
  }

  onProgramaPick(opt: EnumBuscarOption): void {
    const id = String(opt.value);
    this.textoProgramaLabel.set(opt.label);
    this.idProg.set(id);
    this.programaDetalle.set(null);
    this.serviciosMatriculaProg.set([]);
    this.matriculaCredenciales.set(null);
    this.tarifaManual.set(false);
    this.limpiarAjusteValorMat();
    this.limpiarAjusteCuotasSemestre();
    this.revalidacionPreview.set(null);
    this.progSvc.obtener(id).subscribe({
      next: (det) => {
        this.programaDetalle.set(det.programa);
        const servs = det.servicios?.length
          ? det.servicios
          : det.servicio
            ? [det.servicio]
            : [];
        this.serviciosMatriculaProg.set(servs);
        if (this.tarifa() === TARIFA_VIRTUAL && !this.programaTieneTarifaVirtual()) {
          this.tarifa.set(1);
        }
        this.ajustarTarifaPermitida();
        this.syncCuotasDesdeCatalogo();
        this.cargarPreviewMatricula();
      },
      error: () => this.setMsg('No se pudo cargar el detalle del programa.', true),
    });
    this.consultarRevalidacion(id);
  }

  onProgramaLimpiar(): void {
    this.idProg.set('');
    this.textoProgramaLabel.set('');
    this.programaDetalle.set(null);
    this.serviciosMatriculaProg.set([]);
    this.docsPendientesMat.set([]);
    this.matriculaCredenciales.set(null);
    this.revalidacionPreview.set(null);
    this.extrasMatriculaPreview.set([]);
    this.tarifaManual.set(false);
    this.limpiarAjusteValorMat();
    this.limpiarAjusteCuotasSemestre();
    if (this.tarifa() === TARIFA_VIRTUAL) this.tarifa.set(1);
  }

  private consultarRevalidacion(idPrograma: string): void {
    const nd = this.store.numDoc();
    if (!nd || !idPrograma) {
      this.revalidacionPreview.set(null);
      return;
    }
    this.matSvc.previewRevalidacion(nd, idPrograma).subscribe({
      next: (p) => {
        this.revalidacionPreview.set(p);
        if (p.aplicadaAuto && p.tarifa3Disponible && this.tarifasPermitidasMat().includes(3)) {
          this.tarifa.set(3);
          this.tarifaManual.set(false);
        } else if (p.califica && !this.tarifaManual()) {
          this.ajustarTarifaPermitida();
        }
      },
      error: () => this.revalidacionPreview.set(null),
    });
  }

  aplicarTarifaRevalidacion(): void {
    this.tarifa.set(3);
    this.tarifaManual.set(false);
  }

  onTarifaPick(opt: EnumBuscarOption): void {
    const n = Number(opt.value);
    const prev = this.revalidacionPreview();
    const sugerida = prev?.califica && prev?.tarifa3Disponible ? 3 : null;
    this.setTarifa(opt.value);
    this.tarifaManual.set(sugerida != null && n !== sugerida);
    this.syncValorAcordadoMat();
    this.syncCuotasDesdeCatalogo();
    this.cargarPreviewMatricula();
    if (Number(opt.value) === TARIFA_VIRTUAL && !this.matriculaEmailPortal.trim()) {
      const mail = String(this.store.alumno()?.correo || '').trim();
      if (mail) this.matriculaEmailPortal = mail;
    }
  }

  onTarifaLimpiar(): void {
    this.tarifa.set(1);
    this.tarifaManual.set(true);
  }

  onComboPick(opt: EnumBuscarOption): void {
    const id = String(opt.value);
    this.comboIdSeleccionado.set(id);
    this.comboPrevista.set(null);
    this.comboResultado.set(null);
    this.comboSvc.prevista(id).subscribe({
      next: (p) => this.comboPrevista.set(p),
      error: () => this.setMsg('No se pudo cargar la prevista del combo', true),
    });
  }

  onComboLimpiar(): void {
    this.comboIdSeleccionado.set('');
    this.comboPrevista.set(null);
    this.comboResultado.set(null);
  }

  aplicarCombo(): void {
    const nd = this.store.numDoc();
    if (!nd) { this.setMsg('Seleccione un alumno primero.', true); return; }
    const id = this.comboIdSeleccionado();
    if (!id) { this.setMsg('Seleccione un combo.', true); return; }
    if (this.aplicandoCombo()) return;

    this.aplicandoCombo.set(true);
    this.comboResultado.set(null);
    this.comboSvc.aplicar(id, nd).subscribe({
      next: (res) => {
        this.aplicandoCombo.set(false);
        this.comboResultado.set(res);
        this.recargar(nd, { notificar: true });
        this.setMsg(res.message, !res.ok);
      },
      error: (e) => {
        this.aplicandoCombo.set(false);
        this.setMsg(e?.error?.message || 'Error aplicando combo.', true);
      },
    });
  }

  onServicioAdicionalPick(opt: EnumBuscarOption): void {
    const id = String(opt.value);
    this.textoServicioLabel.set(opt.label);
    this.servCatSvc.obtener(id).subscribe({
      next: (r) => {
        this.servicioAdicionalDetalle.set(r.servicio);
        this.onServicioChange(id);
      },
      error: () => {
        this.servicioAdicionalDetalle.set(null);
        this.onServicioChange(id);
      },
    });
  }

  onServicioAdicionalLimpiar(): void {
    this.idServ.set('');
    this.textoServicioLabel.set('');
    this.servicioAdicionalDetalle.set(null);
    this.servDescripcion.set('');
    this.servValor.set(0);
    this.servCantidad.set(1);
  }

  crearMatricula() {
    const nd = this.store.numDoc();
    if (!nd) { this.setMsg('Selecciona o crea un alumno primero.', true); return; }
    if (!this.idProg()) { this.setMsg('Selecciona un programa.', true); return; }
    if (this.programaSoloVirtual()) {
      this.setMsg(
        'Este programa es solo virtual. El alumno debe matricularse en el portal; usted puede cobrar cuando aparezca la liquidación.',
        true,
      );
      return;
    }
    const prog = this.programaSel();
    const esVirtual = this.esTarifaVirtualSeleccionada();
    const emailPortal = this.matriculaEmailPortal.trim() || String(this.store.alumno()?.correo || '').trim();
    const passwordPortal = this.matriculaPasswordPortal.trim();

    if (esVirtual && this.matriculaCrearPortal) {
      if (!emailPortal) {
        this.setMsg('Indique el correo del portal (usuario de acceso).', true);
        return;
      }
      if (passwordPortal && passwordPortal.length < 6) {
        this.setMsg('La contraseña del portal debe tener al menos 6 caracteres.', true);
        return;
      }
    }

    const cuotasCustom = this.ajustarCuotasSemestre && this.puedeAjustarCuotasSemestre();
    let cuotasNumeros: number[] | null = null;
    if (cuotasCustom) {
      cuotasNumeros = this.resolverCuotasSemestreNumeros();
      if (!cuotasNumeros) {
        const esperado = this.numCuotasSemestre();
        const actual = this.valoresCuotasSemestre().length;
        if (actual !== esperado) {
          this.setMsg(
            `Hay ${esperado} cuota(s) en el programa; verifique que todas estén visibles e intente activar de nuevo «Personalizar cuotas».`,
            true,
          );
        } else {
          this.setMsg('Indique un valor entero en cada semestre (solo números, sin decimales).', true);
        }
        return;
      }
    }

    const catalogoBase = this.valorMatriculaBase();
    const ajuste = this.ajustarValorMat && this.puedeAjustarValorMat();
    const acordado = ajuste ? Math.round(Number(this.valorAcordadoMat)) : catalogoBase;
    if (ajuste) {
      if (!Number.isFinite(acordado) || acordado < 0) {
        this.setMsg('Indique un valor acordado válido.', true);
        return;
      }
      if (acordado > catalogoBase) {
        this.setMsg('Solo se permiten rebajas sobre la matrícula (no incluye derechos de grado).', true);
        return;
      }
      if (acordado < catalogoBase && !this.motivoAjusteMat.trim()) {
        this.setMsg('Indique el motivo de la rebaja.', true);
        return;
      }
    }

    this.setMsg(null, false);
    this.matriculaCredenciales.set(null);
    this.matSvc
      .crear({
        numDoc: nd,
        idPrograma: this.idProg(),
        tarifa: this.tarifa(),
        tarifaManual: this.tarifaManual(),
        ...(ajuste && acordado < catalogoBase
          ? {
              ajustarValor: true,
              valorAcordado: acordado,
              motivoAjuste: this.motivoAjusteMat.trim(),
            }
          : {}),
        ...(cuotasCustom && cuotasNumeros
          ? {
              ajustarCuotasSemestre: true,
              valoresCuotasSemestre: cuotasNumeros,
              motivoAjusteCuotas: this.motivoAjusteCuotas.trim() || undefined,
            }
          : {}),
        crearUsuarioPortal: esVirtual && this.matriculaCrearPortal,
        email: esVirtual && this.matriculaCrearPortal ? emailPortal : undefined,
        password: esVirtual && this.matriculaCrearPortal && passwordPortal ? passwordPortal : undefined,
      })
      .subscribe({
      next: (res) => {
        this.idProg.set('');
        this.textoProgramaLabel.set('');
        this.programaDetalle.set(null);
        this.serviciosMatriculaProg.set([]);
        this.tarifa.set(1);
        this.tarifaManual.set(false);
        this.limpiarAjusteValorMat();
        this.limpiarAjusteCuotasSemestre();
        this.revalidacionPreview.set(null);
        this.matriculaEmailPortal = '';
        this.matriculaPasswordPortal = '';
        this.docsPendientesMat.set([]);
        this.recargar(nd, { notificar: true });
        const avisoCea = this.esProgramaCea(prog)
          ? ' Debe programar las horas CEA (teoría, taller y práctica) en Programación CEA.'
          : '';
        let msg = `Matrícula creada. Se generaron los ítems de liquidación del programa.${avisoCea}`;
        if (res.cuotasSemestre?.valores?.length) {
          msg += ` Cuotas personalizadas (${res.cuotasSemestre.valores.length} semestres, total ${this.fmt(res.cuotasSemestre.total)}).`;
        }
        if (res.ajuste?.rebaja) {
          msg += ` Rebaja aplicada: ${this.fmt(res.ajuste.rebaja)} (total ${this.fmt(res.ajuste.valorAcordado)}).`;
        }
        if (res.revalidacion?.aplica) {
          msg += ` Refrendación: tarifa ${res.revalidacion.tarifa}.`;
        } else if (res.revalidacion?.mensaje) {
          msg += ` ${res.revalidacion.mensaje}`;
        }
        if (res.usuarioPortal) {
          const pass = passwordPortal || res.usuarioPortal.passwordTemporal || '';
          if (pass) {
            this.matriculaCredenciales.set({ email: res.usuarioPortal.email, password: pass });
            msg += ` Acceso portal: ${res.usuarioPortal.email}.`;
          }
        }
        this.setMsg(msg, false);
      },
      error: (e) => this.setMsg(e?.error?.message || 'Error creando matrícula.', true),
    });
  }

  onServicioChange(id: string) {
    this.idServ.set(id);
    const s = this.servicioSel();
    if (!s) return;
    const base = String(s.descrServicio || s.descripcion || s.nombre || '');
    this.servCantidad.set(1);
    if (this.permiteCantidad(s)) {
      this.servDescripcion.set(this.descrConCantidad(base, 1));
      this.servValor.set(this.num(s.tarifa1));
    } else {
      this.servDescripcion.set(base);
      const sugerido = this.num(s.tarifa1);
      this.servValor.set(sugerido > 0 ? sugerido : 0);
    }
  }

  onCantidadChange(v: number) {
    const cant = Math.max(1, Math.floor(Number(v) || 1));
    this.servCantidad.set(cant);
    const s = this.servicioSel();
    if (this.permiteCantidad(s)) {
      const base = String(s?.descrServicio || s?.descripcion || this.servDescripcion() || '');
      this.servDescripcion.set(this.descrConCantidad(base, cant));
      this.servValor.set(this.num(s?.tarifa1) * cant);
    }
  }

  private descrConCantidad(base: string, cant: number): string {
    const limpio = base
      .replace(/\s+x\s*\d+\s*$/i, '')
      .replace(/\s*\(\s*\d+\s*h\s*\)\s*$/i, '')
      .replace(/\s*\(\s*cant\.\s*\d+\s*\)\s*$/i, '')
      .trim();
    return `${limpio} x ${cant}`;
  }

  crearServicioAdicional() {
    const nd = this.store.numDoc();
    if (!nd) { this.msg.set('Selecciona un alumno primero.'); return; }
    if (!this.idServ()) { this.msg.set('Selecciona un servicio.'); return; }
    const usaCant = this.servicioUsaCantidad();
    const cant = usaCant ? Math.max(1, Math.floor(this.servCantidad())) : undefined;
    const v = this.servValorTotal();
    if (!v || v <= 0) {
      this.msg.set(
        usaCant
          ? 'Indique cantidad y verifique que el servicio tenga tarifa unitaria.'
          : 'Indique el valor del servicio (mayor a 0).',
      );
      return;
    }
    const servicio = this.servicioSel();
    this.msg.set(null);
    this.liqSvc
      .crear({
        numDoc: nd,
        idServ: String(this.idServ()),
        descripcion:
          String(this.servDescripcion() || this.servicioSel()?.descrServicio || '').trim() || undefined,
        valor: v,
        cantidad: cant,
      })
      .subscribe({
        next: () => {
          this.idServ.set('');
          this.textoServicioLabel.set('');
          this.servicioAdicionalDetalle.set(null);
          this.servDescripcion.set('');
          this.servValor.set(0);
          this.servCantidad.set(1);
          this.recargar(nd, { notificar: true });
          const avisoPractica = this.esHoraPractica(servicio)
            ? ' Programe estas horas prácticas en Programación CEA.'
            : '';
          this.msg.set(`Servicio adicional agregado.${avisoPractica}`);
        },
        error: (e) => this.msg.set(e?.error?.message || 'Error agregando servicio.'),
      });
  }

  async eliminarItem(item: LiquidacionItem) {
    const nd = this.store.numDoc();
    if (!nd) return;
    if (item.abonado > 0) {
      this.msg.set('No se puede eliminar un ítem con pagos.');
      return;
    }
    const descr = item.descripcion || 'este ítem';
    const ok = await this.confirmSvc.open({
      title: '¿Eliminar este ítem?',
      message: `Se eliminará «${descr}» de la liquidación. Esta acción no se puede deshacer.`,
      variant: 'danger',
      icon: 'delete',
      confirmLabel: 'Sí, eliminar',
    });
    if (!ok) return;
    this.liqSvc.eliminar(item._id).subscribe({
      next: () => this.recargar(nd, { notificar: true }),
      error: (e) => this.msg.set(e?.error?.message || 'Error eliminando.'),
    });
  }

  num(v: any): number {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return Number(v) || 0;
    if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
    return Number(v) || 0;
  }

  fmt(v: any): string {
    const n = this.num(v);
    return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  }

  estadoClass(it: LiquidacionItem): string {
    const s = this.num(it.saldo);
    if (s <= 0) return 'ok';
    if (this.num(it.abonado) > 0) return 'warn';
    return 'err';
  }

  esVirtual = esLiquidacionVirtual;

  esAnulado(p: { estado?: string; anulado?: boolean }): boolean {
    if (p?.anulado === true) return true;
    return String(p?.estado || '').trim().toUpperCase() === 'ANULADO';
  }

  estadoVirtualLabel(it: LiquidacionItem): string {
    const base = String(it.estado || 'pendiente').toUpperCase();
    if (!this.esVirtual(it)) return base;
    if (this.num(it.saldo) > 0) return `${base} · AULA VIRTUAL`;
    return base;
  }

  toggleRecibosItem(it: LiquidacionItem) {
    const id = it._id;
    this.itemRecibosAbierto.set(this.itemRecibosAbierto() === id ? null : id);
  }

  imprimirRecibo(idIngreso: string) {
    this.reciboSvc.abrirHtml(idIngreso, (m) => this.msg.set(m));
  }

  verRecibo(idIngreso: string) {
    if (!idIngreso) return;
    const url = this.router.serializeUrl(this.router.createUrlTree(['/recibo', idIngreso]));
    const w = window.open(url, '_blank', 'width=420,height=720');
    if (!w) this.msg.set('Permita ventanas emergentes para ver el comprobante.');
  }

  tiempoFmt(f?: string): string {
    if (!f) return '';
    const d = new Date(f);
    return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  }

  private programaToOption(p: {
    idPrograma?: string | number;
    idProg?: string | number;
    _id?: string;
    nombreProg?: string;
    descripcion?: string | null;
    codigoProg?: string;
  }): EnumBuscarOption {
    const id = String(p.idPrograma ?? p.idProg ?? p._id);
    const nombre = String(p.nombreProg || p.descripcion || '').trim();
    const cod = String(p.codigoProg || '').trim();
    return {
      value: id,
      label: cod ? `${nombre} (${cod})` : nombre || id,
      hint: cod ? `Código ${cod}` : undefined,
    };
  }

  private permiteCantidad(s: {
    idProg?: string | number | null;
    rolServicio?: string;
    usaCantidad?: boolean;
    valorVariable?: boolean;
    permiteCantidad?: boolean;
    tarifa1?: number;
    descrServicio?: string;
    descripcion?: string;
  } | null | undefined): boolean {
    if (!s) return false;
    if (s.permiteCantidad === true) return this.num(s.tarifa1) > 0;
    if (s.permiteCantidad === false) return false;
    if (s.valorVariable === true) return false;
    if (s.usaCantidad === false) return false;
    if (s.idProg != null && String(s.idProg).trim() !== '' && !this.esHoraPractica(s)) return false;
    if (this.num(s.tarifa1) <= 0) return false;
    if (this.esHoraPractica(s)) return true;
    if (s.usaCantidad === true) return true;
    return false;
  }

  private esHoraPractica(s: { rolServicio?: string; descrServicio?: string; descripcion?: string } | null | undefined): boolean {
    if (!s) return false;
    if (s.rolServicio === 'hora_practica') return true;
    return /\bhoras?\b.*\bpractic/i.test(String(s.descrServicio || s.descripcion || ''));
  }

  private esProgramaCea(p: {
    horasTeoria?: unknown;
    horasPractica?: unknown;
    horasTaller?: unknown;
  } | null | undefined): boolean {
    if (!p) return false;
    return this.num(p.horasTeoria) + this.num(p.horasPractica) + this.num(p.horasTaller) > 0;
  }

  private setMsg(text: string | null, isErr: boolean) {
    this.msg.set(text);
    this.msgEsError.set(isErr);
  }

  idIngreso = idIngreso;
}
