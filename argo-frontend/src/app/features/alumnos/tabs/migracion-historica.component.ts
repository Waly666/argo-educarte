import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';

import { AlumnoStore } from '../../../core/services/alumno-store.service';
import { LiquidacionItem, LiquidacionResumen, LiquidacionService } from '../../../core/services/liquidacion.service';
import { IngresoService } from '../../../core/services/ingreso.service';
import { MigracionMovimientosService } from '../../../core/services/migracion-movimientos.service';
import { ProgramaService } from '../../../core/services/programa.service';
import { MatriculaService, CuotasSemestreInfo } from '../../../core/services/matricula.service';
import { ConfigService } from '../../../core/services/config.service';
import {
  CatalogoEnumBuscarComponent,
  EnumBuscarOption,
} from '../../../shared/catalogo-enum-buscar/catalogo-enum-buscar.component';
import { ArgoDateInputComponent } from '../../../shared/argo-date-input/argo-date-input.component';
import { esTarifaVirtualMatricula, esLiquidacionVirtual } from '../catalogo.helpers';
import { etiquetaSaldoCorta, tituloSaldoItem } from '../../../core/utils/saldo-alerta.helpers';

const FORMAS_PAGO = ['Efectivo', 'Transferencia', 'Cheque', 'Tarjeta debito', 'Tarjeta de Credito'];

interface ItemPagoMigracion {
  idLiquidacion: string;
  descripcion: string;
  saldo: number;
  valor: number;
}

@Component({
  selector: 'argo-migracion-historica',
  standalone: true,
  imports: [CommonModule, FormsModule, CatalogoEnumBuscarComponent, ArgoDateInputComponent],
  templateUrl: './migracion-historica.component.html',
  styleUrls: ['./migracion-historica.component.scss'],
})
export class MigracionHistoricaComponent {
  store = inject(AlumnoStore);
  private migSvc = inject(MigracionMovimientosService);
  private progSvc = inject(ProgramaService);
  private liqSvc = inject(LiquidacionService);
  private ingSvc = inject(IngresoService);
  private matSvc = inject(MatriculaService);
  private cfgSvc = inject(ConfigService);

  estado = signal<{ puedeUsar: boolean; habilitado: boolean; prefijoRecibo: string } | null>(null);
  msg = signal<string | null>(null);
  msgEsError = signal(false);
  loading = signal(false);
  loadingLiq = signal(false);

  idProg = signal('');
  textoProgramaLabel = signal('');
  programaDetalle = signal<Record<string, unknown> | null>(null);
  serviciosMatriculaProg = signal<Record<string, unknown>[]>([]);
  tarifa: 1 | 2 | 3 | 4 = 1;
  valorHistorico: number | null = null;
  private valorHistoricoManual = false;
  fechaMat = '';
  semestreHasta: number | null = null;
  observacionesMat = '';

  /** Cuotas por semestre al matricular histórico. */
  ajustarCuotasSemestre = false;
  valoresCuotasSemestre = signal<(number | null)[]>([]);
  motivoAjusteCuotas = '';

  liquidacionResumen = signal<LiquidacionResumen>({
    items: [],
    totales: { valor: 0, abonado: 0, saldo: 0 },
  });
  comprobantes = signal<any[]>([]);
  matriculasAlumno = signal<any[]>([]);
  permitirAjusteCuotasSemestre = signal(true);

  itemsPagoMigracion = signal<ItemPagoMigracion[]>([]);
  numRecibo = '';
  fechaPago = '';
  formaPago = 'Efectivo';
  observacionesPago = '';

  cuotasEditorId = signal<string | null>(null);
  cuotasEditorData = signal<CuotasSemestreInfo | null>(null);
  cuotasEditorDraft = signal<(number | null)[]>([]);
  cuotasEditorMotivo = '';
  cuotasEditorLoading = signal(false);
  cuotasEditorSaving = signal(false);

  pagosMigracion = signal<Record<string, unknown>[]>([]);

  readonly formasPago = FORMAS_PAGO;
  etiquetaSaldo = etiquetaSaldoCorta;
  tituloSaldoItem = tituloSaldoItem;
  esVirtual = esLiquidacionVirtual;

  serviciosMatricula = computed(() =>
    this.serviciosMatriculaProg().filter((s) => !this.esHoraPractica(s)),
  );

  numCuotasActivas = computed(() => {
    const servs = this.serviciosMatricula();
    if (!servs.length) return 0;
    if (servs.length < 2) return 1;
    const h = Math.round(Number(this.semestreHasta) || servs.length);
    return Math.min(Math.max(1, h), servs.length);
  });

  puedeCuotasSemestre = computed(
    () => this.numCuotasActivas() >= 2 && !esTarifaVirtualMatricula(this.tarifa),
  );

  cuotasSemestreCatalogo = computed(() => {
    const t = this.tarifa;
    return this.serviciosMatricula()
      .slice(0, this.numCuotasActivas())
      .map((s) => {
        if (esTarifaVirtualMatricula(t)) return this.num(s['tarifaVirtual']);
        const v = s[`tarifa${t}`];
        if (v != null && v !== '') return this.num(v);
        return this.num(s['tarifa1']);
      });
  });

  totalCuotasSemestre = computed((): number =>
    this.valoresCuotasSemestre().reduce<number>((acc, v) => acc + (v ?? 0), 0),
  );

  totalPagoMigracion = computed((): number =>
    this.itemsPagoMigracion().reduce((acc, i) => acc + (i.valor > 0 ? Math.round(i.valor) : 0), 0),
  );

  totales = computed(() => this.liquidacionResumen().totales);

  itemsConSaldo = computed(() =>
    this.liquidacionResumen()
      .items.filter((i) => this.num(i.saldo) > 0.0001)
      .sort((a, b) => String(a.descripcion || '').localeCompare(String(b.descripcion || ''), 'es')),
  );

  liquidacionesPendientes = computed(() => this.itemsConSaldo());

  tieneVirtualConSaldo = computed(() => this.itemsConSaldo().some((it) => this.esVirtual(it)));

  opcionesItemsLiquidacion = computed<EnumBuscarOption[]>(() =>
    this.itemsConSaldo().map((it) => ({
      value: it._id,
      label: `${this.etiquetaSaldo(it.descripcion || 'Ítem')} · saldo ${this.fmt(this.num(it.saldo))}`,
      hint: it.descripcion || undefined,
    })),
  );

  matriculasCuotasEditables = computed(() => {
    const items = this.liquidacionResumen().items;
    return this.matriculasAlumno().filter((m) => {
      if (Number(m.tarifa) === 4) return false;
      if (!m.origenMigracion && !this.permitirAjusteCuotasSemestre()) return false;
      const idMat = String(m._id);
      const cuotas = items.filter(
        (it) => it.idMat && String(it.idMat) === idMat && it.idProg && !this.esVirtual(it),
      );
      return cuotas.length >= 2;
    });
  });

  totalCuotasEditor = computed((): number =>
    this.cuotasEditorDraft().reduce<number>((acc, v) => acc + (v ?? 0), 0),
  );

  usaSemestres = computed(() => this.serviciosMatricula().length >= 1 && this.numCuotasActivas() >= 1);

  maxSemestres = computed(() => this.serviciosMatricula().length || 1);

  buscarProgramasRemoto = (q: string) =>
    this.progSvc.listar({ q: q.trim() || undefined, catalogo: true, limit: 40 }).pipe(
      map((rows) =>
        (rows || []).map((p) => ({
          value: String(p.idPrograma ?? p._id ?? p.codigoProg),
          label: [p.codigoProg, p.nombreProg || p.descripcion].filter(Boolean).join(' — '),
        })),
      ),
    );

  constructor() {
    this.migSvc.estado().subscribe({
      next: (st) =>
        this.estado.set({
          puedeUsar: st.puedeUsar,
          habilitado: st.habilitado,
          prefijoRecibo: st.prefijoRecibo || 'MIG-',
        }),
      error: () => this.estado.set({ puedeUsar: false, habilitado: false, prefijoRecibo: 'MIG-' }),
    });

    this.cfgSvc.obtenerReciboOpcionesMatricula().subscribe({
      next: (c) => this.permitirAjusteCuotasSemestre.set(c.permitirAjusteCuotasSemestre === true),
      error: () => this.permitirAjusteCuotasSemestre.set(true),
    });

    effect(() => {
      const nd = this.store.numDoc();
      if (nd == null) {
        this.liquidacionResumen.set({ items: [], totales: { valor: 0, abonado: 0, saldo: 0 } });
        this.pagosMigracion.set([]);
        this.comprobantes.set([]);
        this.matriculasAlumno.set([]);
        return;
      }
      this.recargar(nd);
    });
  }

  textoPrograma(): string {
    return this.textoProgramaLabel();
  }

  trackByCuotaIndex = (index: number): number => index;

  num(v: unknown): number {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'object' && v !== null && '$numberDecimal' in v) {
      return Number((v as { $numberDecimal: string }).$numberDecimal) || 0;
    }
    return Number(v) || 0;
  }

  fmt(n: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
      n || 0,
    );
  }

  fechaFmt(v: unknown): string {
    if (!v) return '—';
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-CO');
  }

  recargar(numDoc: number | string) {
    this.loadingLiq.set(true);
    this.liqSvc.listarPorAlumno(numDoc).subscribe({
      next: (r) => {
        this.liquidacionResumen.set(r);
        this.loadingLiq.set(false);
      },
      error: () => {
        this.liquidacionResumen.set({ items: [], totales: { valor: 0, abonado: 0, saldo: 0 } });
        this.loadingLiq.set(false);
      },
    });
    this.ingSvc.listarPorAlumno(numDoc).subscribe({
      next: (rows) => {
        const all = rows || [];
        this.comprobantes.set(all);
        this.pagosMigracion.set(
          all.filter(
            (p) =>
              p['origenMigracion'] === true ||
              String(p['tipoIngreso'] || '').toUpperCase() === 'MIGRACION' ||
              String(p['idTipoPago'] || '').toUpperCase() === 'MIGRACION',
          ),
        );
      },
      error: () => {
        this.comprobantes.set([]);
        this.pagosMigracion.set([]);
      },
    });
    this.matSvc.listarPorAlumno(numDoc).subscribe({
      next: (rows) => this.matriculasAlumno.set(rows || []),
      error: () => this.matriculasAlumno.set([]),
    });
  }

  setMsg(text: string | null, err = false) {
    this.msg.set(text);
    this.msgEsError.set(err);
  }

  private esHoraPractica(s: Record<string, unknown>): boolean {
    if (s['rolServicio'] === 'hora_practica') return true;
    return /\bhoras?\b.*\bpractic/i.test(String(s['descrServicio'] || s['descripcion'] || ''));
  }

  private normalizarCuotaEntera(raw: number | string | null | undefined): number | null {
    if (raw === '' || raw === null || raw === undefined) return null;
    const v = Math.round(Number(raw));
    if (!Number.isFinite(v) || v < 0) return null;
    return v;
  }

  valorCatalogoReferencia(): number {
    return this.cuotasSemestreCatalogo().reduce((acc, v) => acc + v, 0);
  }

  private cuotasDesdeCatalogo(): (number | null)[] {
    return this.cuotasSemestreCatalogo().map((v) => Math.round(v));
  }

  private syncCuotasMatricula(): void {
    if (this.ajustarCuotasSemestre && this.puedeCuotasSemestre()) {
      this.valoresCuotasSemestre.set(this.cuotasDesdeCatalogo());
    }
  }

  private sincronizarValorHistorico(): void {
    if (this.ajustarCuotasSemestre && this.puedeCuotasSemestre()) {
      if (!this.valorHistoricoManual) {
        this.valorHistorico = this.totalCuotasSemestre();
      }
      return;
    }
    if (this.valorHistoricoManual) return;
    this.valorHistorico = this.valorCatalogoReferencia();
  }

  onTarifaChange(): void {
    if (esTarifaVirtualMatricula(this.tarifa)) {
      this.limpiarCuotasSemestre();
    }
    this.syncCuotasMatricula();
    this.sincronizarValorHistorico();
  }

  onSemestreHastaChange(): void {
    this.syncCuotasMatricula();
    this.sincronizarValorHistorico();
  }

  onValorHistoricoChange(): void {
    this.valorHistoricoManual = true;
  }

  onAjustarCuotasSemestreChange(activo: boolean): void {
    this.ajustarCuotasSemestre = activo;
    if (activo) {
      this.valoresCuotasSemestre.set(this.cuotasDesdeCatalogo());
      this.valorHistoricoManual = false;
    } else {
      this.valoresCuotasSemestre.set([]);
      this.motivoAjusteCuotas = '';
      this.valorHistoricoManual = false;
    }
    this.sincronizarValorHistorico();
  }

  onCuotaSemestreChange(index: number, raw: number | string | null): void {
    const next = [...this.valoresCuotasSemestre()];
    next[index] = this.normalizarCuotaEntera(raw);
    this.valoresCuotasSemestre.set(next);
    if (this.ajustarCuotasSemestre && !this.valorHistoricoManual) {
      this.valorHistorico = this.totalCuotasSemestre();
    }
  }

  repartirCuotasEquitativo(): void {
    const n = this.valoresCuotasSemestre().length || this.numCuotasActivas();
    if (!n) return;
    const total = this.totalCuotasSemestre() || this.valorCatalogoReferencia();
    const base = Math.floor(total / n);
    const arr: number[] = Array(n).fill(base);
    let rest = total - base * n;
    for (let i = 0; i < rest; i++) arr[i] += 1;
    this.valoresCuotasSemestre.set(arr);
    if (!this.valorHistoricoManual) this.valorHistorico = total;
  }

  restaurarCuotasCatalogo(): void {
    this.valoresCuotasSemestre.set(this.cuotasDesdeCatalogo());
    this.valorHistoricoManual = false;
    this.sincronizarValorHistorico();
  }

  etiquetaSemestre(index: number): string {
    const serv = this.serviciosMatricula()[index];
    const descr = String(serv?.['descrServicio'] || serv?.['descripcion'] || '').trim();
    return descr || `Semestre ${index + 1}`;
  }

  cuotaSemestreInvalida(index: number): boolean {
    return this.valoresCuotasSemestre()[index] === null;
  }

  resolverCuotasSemestreNumeros(): number[] | null {
    const vals = this.valoresCuotasSemestre();
    const esperado = this.numCuotasActivas();
    if (vals.length !== esperado) return null;
    const nums: number[] = [];
    for (const v of vals) {
      if (v === null || !Number.isFinite(v) || v < 0) return null;
      nums.push(Math.round(v));
    }
    return nums;
  }

  private limpiarCuotasSemestre(): void {
    this.ajustarCuotasSemestre = false;
    this.valoresCuotasSemestre.set([]);
    this.motivoAjusteCuotas = '';
  }

  onProgramaPick(opt: EnumBuscarOption): void {
    const id = String(opt.value);
    this.textoProgramaLabel.set(opt.label);
    this.idProg.set(id);
    this.programaDetalle.set(null);
    this.serviciosMatriculaProg.set([]);
    this.semestreHasta = null;
    this.valorHistorico = null;
    this.valorHistoricoManual = false;
    this.limpiarCuotasSemestre();
    this.progSvc.obtener(id).subscribe({
      next: (det) => {
        this.programaDetalle.set(det.programa as unknown as Record<string, unknown>);
        const servs = det.servicios?.length ? det.servicios : det.servicio ? [det.servicio] : [];
        this.serviciosMatriculaProg.set(servs as Record<string, unknown>[]);
        const n = this.serviciosMatricula().length;
        if (n >= 1) this.semestreHasta = n;
        this.sincronizarValorHistorico();
      },
      error: () => this.setMsg('No se pudo cargar el programa.', true),
    });
  }

  onProgramaLimpiar(): void {
    this.idProg.set('');
    this.textoProgramaLabel.set('');
    this.programaDetalle.set(null);
    this.serviciosMatriculaProg.set([]);
    this.semestreHasta = null;
    this.valorHistorico = null;
    this.valorHistoricoManual = false;
    this.limpiarCuotasSemestre();
  }

  crearMatriculaHistorica(): void {
    const nd = this.store.numDoc();
    if (nd == null) {
      this.setMsg('Seleccione un alumno.', true);
      return;
    }
    if (!this.idProg()) {
      this.setMsg('Seleccione un programa actual de ARGO.', true);
      return;
    }
    if (!this.fechaMat) {
      this.setMsg('Indique la fecha histórica de matrícula.', true);
      return;
    }

    const cuotasCustom = this.ajustarCuotasSemestre && this.puedeCuotasSemestre();
    let cuotasNumeros: number[] | null = null;
    if (cuotasCustom) {
      cuotasNumeros = this.resolverCuotasSemestreNumeros();
      if (!cuotasNumeros) {
        this.setMsg('Indique un valor entero en cada semestre (solo números, sin decimales).', true);
        return;
      }
    }

    const valorHist = cuotasNumeros
      ? cuotasNumeros.reduce((a, v) => a + v, 0)
      : Math.round(Number(this.valorHistorico));
    if (!Number.isFinite(valorHist) || valorHist < 0) {
      this.setMsg('Indique el valor histórico de la matrícula.', true);
      return;
    }

    this.loading.set(true);
    this.setMsg(null, false);
    this.migSvc
      .matriculaHistorica({
        numDoc: nd,
        idPrograma: this.idProg(),
        tarifa: this.tarifa,
        valorHistorico: valorHist,
        fechaMat: this.fechaMat,
        semestreHasta: this.puedeCuotasSemestre() || this.numCuotasActivas() > 1
          ? this.semestreHasta ?? undefined
          : undefined,
        observaciones: this.observacionesMat.trim() || 'Matrícula histórica (migración)',
        ...(cuotasCustom && cuotasNumeros
          ? {
              ajustarCuotasSemestre: true,
              valoresCuotasSemestre: cuotasNumeros,
              motivoAjusteCuotas: this.motivoAjusteCuotas.trim() || 'Cuotas históricas (migración Access)',
            }
          : {}),
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.onProgramaLimpiar();
          this.observacionesMat = '';
          this.store.touchLiquidacion();
          this.recargar(nd);
          const n = res.liquidaciones?.length ?? 1;
          let msg = `Matrícula histórica creada con ${n} liquidación(es). Registre los recibos de migración abajo.`;
          if (res.cuotasSemestre?.valores?.length) {
            msg += ` Cuotas: ${res.cuotasSemestre.valores.length} semestre(s), total ${this.fmt(res.cuotasSemestre.totalMatricula ?? valorHist)}.`;
          }
          this.setMsg(msg);
        },
        error: (e) => {
          this.loading.set(false);
          this.setMsg(e?.error?.message || 'No se pudo crear la matrícula histórica.', true);
        },
      });
  }

  trackByCuotaSemestre(_i: number, s: { idServicio: string }): string {
    return s.idServicio;
  }

  trackByCuotaEditor(_i: number, c: { idLiquidacion: string }): string {
    return c.idLiquidacion;
  }

  trackByItemPago(_i: number, it: ItemPagoMigracion): string {
    return it.idLiquidacion;
  }

  trackByLiquidacion(_i: number, it: LiquidacionItem): string {
    return String(it._id);
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
        if (!info.permitido) {
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
    const nd = this.store.numDoc();
    if (!id || !info?.cuotas?.length || nd == null) return;

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
          this.cerrarEditorCuotas();
          this.store.touchLiquidacion();
          this.recargar(nd);
          this.setMsg('Cuotas por semestre actualizadas. El total de matrícula se recalculó.');
        },
        error: (e) => {
          this.cuotasEditorSaving.set(false);
          this.setMsg(e?.error?.message || 'No se pudieron guardar las cuotas.', true);
        },
      });
  }

  nombreProgramaMatricula(m: { idProg?: string; idPrograma?: string; valorMat?: number }): string {
    const id = String(m.idProg || m.idPrograma || '');
    const it = this.liquidacionResumen().items.find((i) => i.idProg && String(i.idProg) === id);
    return it?.descripcion?.replace(/^\d+\s+SEM\s+\w+\s+/i, '').trim() || `Programa ${id}`;
  }

  estadoClass(it: LiquidacionItem): string {
    const s = this.num(it.saldo);
    if (s <= 0) return 'ok';
    if (this.num(it.abonado) > 0) return 'warn';
    return 'err';
  }

  estadoVirtualLabel(it: LiquidacionItem): string {
    const base = String(it.estado || 'pendiente').toUpperCase();
    if (!this.esVirtual(it)) return base;
    if (this.num(it.saldo) > 0) return `${base} · AULA VIRTUAL`;
    return base;
  }

  itemSeleccionado = (id: string) =>
    this.itemsPagoMigracion().some((x) => x.idLiquidacion === String(id));

  onItemLiquidacionPick(opt: EnumBuscarOption): void {
    this.agregarItemPago(String(opt.value));
  }

  onItemLiquidacionLimpiar(): void {
    /* combo agregar: no mantiene selección */
  }

  pagarSaldoCompletoItem(idLiq: string): void {
    this.itemsPagoMigracion.update((arr) =>
      arr.map((x) => (x.idLiquidacion === idLiq ? { ...x, valor: Math.round(x.saldo) } : x)),
    );
  }

  agregarItemPago(idLiquidacion: string | unknown): void {
    const id = String(idLiquidacion);
    const it = this.liquidacionResumen().items.find((i) => String(i._id) === id);
    if (!it || this.num(it.saldo) <= 0) return;
    if (this.itemsPagoMigracion().some((x) => x.idLiquidacion === id)) return;
    this.itemsPagoMigracion.set([
      ...this.itemsPagoMigracion(),
      {
        idLiquidacion: id,
        descripcion: String(it.descripcion || 'Ítem'),
        saldo: this.num(it.saldo),
        valor: Math.round(this.num(it.saldo)),
      },
    ]);
  }

  agregarTodoPendiente(): void {
    const nuevos: ItemPagoMigracion[] = [];
    for (const it of this.itemsConSaldo()) {
      const id = String(it._id);
      if (this.itemsPagoMigracion().some((x) => x.idLiquidacion === id)) continue;
      nuevos.push({
        idLiquidacion: id,
        descripcion: String(it.descripcion || 'Ítem'),
        saldo: this.num(it.saldo),
        valor: Math.round(this.num(it.saldo)),
      });
    }
    if (nuevos.length) this.itemsPagoMigracion.set([...this.itemsPagoMigracion(), ...nuevos]);
  }

  quitarItemPago(index: number): void {
    const next = [...this.itemsPagoMigracion()];
    next.splice(index, 1);
    this.itemsPagoMigracion.set(next);
  }

  onItemPagoValorChange(index: number, raw: number | string | null): void {
    const next = [...this.itemsPagoMigracion()];
    const row = { ...next[index] };
    const n = this.normalizarCuotaEntera(raw);
    row.valor = n ?? 0;
    next[index] = row;
    this.itemsPagoMigracion.set(next);
  }

  itemPagoInvalido(it: ItemPagoMigracion): boolean {
    const v = it.valor;
    if (!Number.isFinite(v) || v <= 0) return true;
    return v > it.saldo + 0.0001;
  }

  limpiarItemsPago(): void {
    this.itemsPagoMigracion.set([]);
  }

  registrarPago(): void {
    const nd = this.store.numDoc();
    if (nd == null) {
      this.setMsg('Seleccione un alumno.', true);
      return;
    }
    if (!this.fechaPago) {
      this.setMsg('Indique la fecha histórica del recibo.', true);
      return;
    }

    const items = this.itemsPagoMigracion()
      .filter((i) => i.valor > 0)
      .map((i) => ({ idLiquidacion: i.idLiquidacion, valor: Math.round(i.valor) }));

    if (!items.length) {
      this.setMsg('Agregue al menos un ítem con valor a pagar.', true);
      return;
    }
    for (const it of this.itemsPagoMigracion()) {
      if (it.valor > 0 && this.itemPagoInvalido(it)) {
        this.setMsg(`Valor inválido en «${it.descripcion}» (máximo saldo ${this.fmt(it.saldo)}).`, true);
        return;
      }
    }

    this.loading.set(true);
    this.setMsg(null, false);
    this.migSvc
      .pagoMigracion({
        numDoc: nd,
        items,
        fecha: this.fechaPago,
        numRecibo: this.numRecibo.trim() || undefined,
        formaPago: this.formaPago,
        observaciones: this.observacionesPago.trim() || undefined,
      })
      .subscribe({
        next: (res) => this.onPagoOk(nd, res.numRecibo, res.total),
        error: (e) => this.onPagoError(e),
      });
  }

  private onPagoOk(nd: number | string, numRecibo: string, total: number): void {
    this.loading.set(false);
    this.limpiarItemsPago();
    this.numRecibo = '';
    this.observacionesPago = '';
    this.store.touchLiquidacion();
    this.recargar(nd);
    this.setMsg(`Recibo de migración #${numRecibo} registrado por ${this.fmt(total)}.`);
  }

  private onPagoError(e: { error?: { message?: string } }): void {
    this.loading.set(false);
    this.setMsg(e?.error?.message || 'No se pudo registrar el pago.', true);
  }
}
