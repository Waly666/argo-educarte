import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { ConfigRecibo, ConfigService } from '../../core/services/config.service';
import { CatalogoService } from '../../core/services/catalogo.service';
import {
  CajaDescuadre,
  CajaSesion,
  CajaSesionService,
  CajaEgresoItem,
  CajaIngresoItem,
  ResumenCaja,
} from '../../core/services/caja-sesion.service';
import {
  tieneSoporteEgreso,
  tituloSoporteEgreso,
} from '../../core/utils/egreso-soporte.helpers';
import { CajaInformePrintService } from '../../core/services/caja-informe-print.service';
import { IngresoService } from '../../core/services/ingreso.service';
import { CajaResumenServiciosComponent } from './caja-resumen-servicios.component';
import { resolverFormaPagoIngreso } from '../../core/utils/caja-forma-pago.util';
import { buildMetodosPagoCards, MetodoPagoCard } from '../../core/utils/metodo-pago.util';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';

@Component({
  selector: 'argo-caja-cierre-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe, DatePipe, CajaResumenServiciosComponent],
  templateUrl: './caja-cierre-detalle.component.html',
  styleUrls: ['./caja-cierre-detalle.component.scss'],
})
export class CajaCierreDetalleComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cajaSvc = inject(CajaSesionService);
  private catSvc = inject(CatalogoService);
  private configSvc = inject(ConfigService);
  private informePrint = inject(CajaInformePrintService);
  private ingresoSvc = inject(IngresoService);
  private auth = inject(AuthService);
  private confirm = inject(ConfirmDialogService);

  idSesion = signal<number | null>(null);
  sesion = signal<CajaSesion | null>(null);
  resumen = signal<ResumenCaja | null>(null);
  descuadre = signal<CajaDescuadre | null>(null);
  ingresos = signal<CajaIngresoItem[]>([]);
  egresos = signal<CajaEgresoItem[]>([]);
  tiposPagoCat = signal<Record<string, unknown>[]>([]);
  loading = signal(true);
  saving = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);

  valorCuadre = signal(0);
  obsCuadre = signal('');
  empresaConfig = signal<ConfigRecibo | null>(null);

  ventasBrutas = computed(() => this.resumen()?.ventasBrutas ?? this.resumen()?.totalIngresos ?? 0);
  cantidadRecibos = computed(
    () => this.resumen()?.cantidadRecibos ?? this.resumen()?.cantidadIngresos ?? 0,
  );
  /** Valores de cuadre devueltos por API (congelados al cierre salvo descuadre pendiente). */
  efectivoEsperado = computed(() => {
    const r = this.resumen();
    if (r?.efectivoEsperado != null) return Number(r.efectivoEsperado);
    const s = this.sesion();
    if (s?.saldoFinal != null) return Number(s.saldoFinal);
    return 0;
  });

  efectivoContado = computed(() => {
    const r = this.resumen()?.efectivoContado;
    if (r != null) return Number(r);
    const s = this.sesion()?.efectivoContado;
    return s != null ? Number(s) : null;
  });

  diferencia = computed(() => {
    const r = this.resumen();
    if (r?.diferencia != null) return Number(r.diferencia);
    const s = this.sesion();
    if (s?.diferencia != null) return Number(s.diferencia);
    if (this.descuadrePendiente()) {
      const dd = this.descuadre()?.diferencia;
      if (dd != null) return Number(dd);
    }
    const c = this.efectivoContado();
    const e = this.efectivoEsperado();
    return c != null && Number.isFinite(e) ? c - e : null;
  });

  arqueoTotal = computed(() => this.resumen()?.arqueoTotal ?? null);

  descuadrePendiente = computed(
    () => this.descuadre()?.estado === 'pendiente' || this.sesion()?.descuadreEstado === 'pendiente',
  );

  cuadreCuadrado = computed(() => {
    const d = this.diferencia();
    return d != null && Math.abs(d) < 1;
  });

  totalGastos = computed(() => this.resumen()?.totalGastos ?? 0);
  totalRetiros = computed(() => this.resumen()?.totalRetiros ?? 0);
  saldoInicial = computed(() => this.resumen()?.saldoInicial ?? 0);
  ingresosPorServicio = computed(() => this.resumen()?.ingresosPorServicio ?? []);

  montoDebe = computed(() => {
    const d = this.descuadre();
    if (d?.montoDebe != null && d.montoDebe > 0) return d.montoDebe;
    const dif = this.diferencia();
    return dif != null && dif < -1 ? Math.abs(dif) : 0;
  });

  isAdmin = computed(() => this.auth.isAdmin());

  backLink = computed(() => (this.isAdmin() ? '/app/cierres' : '/app/caja'));
  backLabel = computed(() => (this.isAdmin() ? '← Cierres' : '← Resumen del día'));

  tieneIngresoCuadre = computed(() => this.ingresos().some((i) => !!i.cuadreDescuadre));

  puedeCuadrar = computed(() => {
    if (this.montoDebe() <= 0) return false;
    if (this.tieneIngresoCuadre()) return false;
    if (this.auth.isAdmin()) {
      const est = this.descuadre()?.estado || this.sesion()?.descuadreEstado;
      return !est || est === 'pendiente';
    }
    return this.descuadre()?.estado === 'pendiente';
  });

  puedeReabrir = computed(
    () => this.auth.isAdmin() && this.sesion()?.estado === 'cerrada',
  );

  sesionReabierta = computed(() => this.sesion()?.estado === 'abierta' && !!this.sesion()?.fechaReapertura);

  egresosSinSoporte = computed(() => this.egresos().filter((e) => !tieneSoporteEgreso(e)));
  cantSinSoporte = computed(() => this.egresosSinSoporte().length);
  tieneSoporte = tieneSoporteEgreso;
  tituloSoporte = tituloSoporteEgreso;

  metodosPago = computed((): MetodoPagoCard[] => {
    const rows = (this.resumen()?.ingresosPorTipo ?? []).map((r) => ({
      forma: r.descripcion || String(r.idTipoPago),
      total: r.total,
      cantidad: r.cantidad,
    }));
    return buildMetodosPagoCards(rows);
  });

  sedeLabel = computed(() => {
    const nombre = String(this.empresaConfig()?.nombreSede || '').trim();
    if (nombre) return nombre;
    const sid = String(this.sesion()?.idSede || '').trim();
    return sid || '';
  });

  ngOnInit(): void {
    this.catSvc.list('catTipoPago', { refresh: true }).subscribe({
      next: (t) => this.tiposPagoCat.set(t || []),
    });
    this.route.paramMap.subscribe((p) => {
      const id = Number(p.get('idSesion'));
      if (!Number.isFinite(id)) return;
      this.idSesion.set(id);
      this.cargar(id);
    });
  }

  cargar(id: number): void {
    this.loading.set(true);
    this.inform(null);
    this.cajaSvc.resumen(id).subscribe({
      next: (r) => {
        this.sesion.set(r.sesion);
        this.resumen.set(r.resumen);
        this.descuadre.set(r.descuadre ?? null);
        this.valorCuadre.set(r.descuadre?.montoDebe ?? 0);
        this.cargarEncabezado(r.sesion?.idSede);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.inform(e?.error?.message || 'No se pudo cargar el cierre');
      },
    });
    this.cajaSvc.ingresosPorSesion(id).subscribe({ next: (r) => this.ingresos.set(r || []) });
    this.cajaSvc.egresosPorSesion(id).subscribe({ next: (r) => this.egresos.set(r || []) });
  }

  async anularIngreso(i: CajaIngresoItem): Promise<void> {
    const id = i._id;
    if (!id) return;
    const ref = i.numRecibo ? ` ${i.numRecibo}` : '';
    const ok = await this.confirm.open({
      title: 'Anular ingreso',
      message: `¿Anular el ingreso${ref}? Se actualizará el cuadre automáticamente.`,
      confirmLabel: 'Anular',
      variant: 'danger',
    });
    if (!ok) return;
    this.saving.set(true);
    this.ingresoSvc.eliminar(String(id)).subscribe({
      next: () => {
        this.saving.set(false);
        this.inform('Ingreso anulado');
        const sid = this.idSesion();
        if (sid) this.cargar(sid);
      },
      error: (e) => {
        this.saving.set(false);
        this.inform(e?.error?.message || 'No se pudo anular');
      },
    });
  }

  async reabrirCaja(): Promise<void> {
    const id = this.idSesion();
    if (!id) return;
    const ok = await this.confirm.open({
      title: 'Reabrir caja',
      message:
        '¿Reabrir esta caja cerrada para corregir movimientos? El cajero podrá seguir operando hasta un nuevo cierre.',
      confirmLabel: 'Reabrir',
      variant: 'warn',
    });
    if (!ok) return;
    this.saving.set(true);
    this.cajaSvc.reabrirSesion(id, 'Reapertura administrativa').subscribe({
      next: (r) => {
        this.saving.set(false);
        this.inform(r.message || 'Caja reabierta');
        this.cargar(id);
      },
      error: (e) => {
        this.saving.set(false);
        this.inform(e?.error?.message || 'No se pudo reabrir la caja');
      },
    });
  }

  editarEgreso(e: CajaEgresoItem): void {
    if (!e.idEgreso) return;
    void this.router.navigate(['/app/caja/egresos/editar', e.idEgreso], {
      queryParams: { returnUrl: this.router.url },
    });
  }

  registrarCuadre(): void {
    const id = this.idSesion();
    const v = Math.round(this.valorCuadre());
    if (!id || !(v > 0)) {
      this.inform('Indique el valor en efectivo a ingresar');
      return;
    }
    if (v > this.montoDebe()) {
      this.inform(`No puede superar el faltante (${this.montoDebe().toLocaleString('es-CO')} COP)`);
      return;
    }
    this.saving.set(true);
    this.cajaSvc
      .ingresoCuadreDescuadre(id, { valor: v, idTipoPago: '1', observaciones: this.obsCuadre() || undefined })
      .subscribe({
        next: (r) => {
          this.saving.set(false);
          this.inform(
            r.resuelto
              ? 'Reposición registrada — el descuadre quedó resuelto.'
              : 'Reposición registrada — revise el faltante actualizado.',
          );
          this.cargar(id);
        },
        error: (e) => {
          this.saving.set(false);
          this.inform(e?.error?.message || 'No se pudo registrar el ingreso');
        },
      });
  }

  imprimir(): void {
    const s = this.sesion();
    const r = this.resumen();
    if (!s || !r) return;
    this.informePrint.imprimirIndividual({
      sesion: s,
      resumen: r,
      ingresos: this.ingresos(),
      egresos: this.egresos(),
      descuadre: this.descuadre(),
    });
  }

  private cargarEncabezado(idSede?: string | null): void {
    this.configSvc.obtenerReciboEncabezado(idSede || undefined).subscribe({
      next: (c) => this.empresaConfig.set(c),
      error: () => this.empresaConfig.set(null),
    });
  }

  onAlarmaSoporte(e: CajaEgresoItem, ev?: Event): void {
    ev?.stopPropagation();
    if (this.auth.isAdmin()) {
      void this.router.navigate(['/app/caja/egresos/editar', e.idEgreso], {
        queryParams: { returnUrl: this.router.url },
      });
      this.inform('Adjunte el soporte (imagen) en el formulario y guarde.');
      return;
    }
    this.inform(
      `Egreso ${e.numRecibo || e.concepto || ''} sin soporte. Solicite a un administrador que adjunte el comprobante.`,
    );
  }

  estadoDescuadreLabel(): string {
    const e = this.descuadre()?.estado || this.sesion()?.descuadreEstado;
    if (e === 'pendiente') return 'Pendiente — puede cuadrar durante el mes';
    if (e === 'en_nomina') return 'Incluido en nómina (pendiente de pago)';
    if (e === 'descontado_nomina') return 'Descontado en nómina';
    if (e === 'resuelto') return 'Resuelto';
    return '';
  }

  formaPagoLabel(i: CajaIngresoItem): string {
    return resolverFormaPagoIngreso(i);
  }

  private tonoMetodo(label: string): { tone: string; icon: string } {
    const t = label.toLowerCase();
    if (t.includes('efect')) return { tone: 'emerald', icon: '💵' };
    if (t.includes('nequi')) return { tone: 'pink', icon: '📱' };
    if (t.includes('transf')) return { tone: 'blue', icon: '🏦' };
    if (t.includes('tarj')) return { tone: 'purple', icon: '💳' };
    return { tone: 'cyan', icon: '◎' };
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
        t.includes('adjunte') ||
        t.includes('verifique');
    }
    this.msgError.set(err);
  }

}
