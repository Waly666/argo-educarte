import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { ConfigRecibo, ConfigService } from '../../core/services/config.service';
import { CatalogoService } from '../../core/services/catalogo.service';
import {
  CajaSesion,
  CajaSesionService,
  CajaEgresoItem,
  CajaIngresoItem,
  CierreCajaResponse,
  ResumenCaja,
  CajaDescuadre,
} from '../../core/services/caja-sesion.service';
import {
  tieneSoporteEgreso,
} from '../../core/utils/egreso-soporte.helpers';
import { ArqueoLinea } from '../../core/constants/caja-arqueo.constants';
import { crearLineasArqueoVacias, totalArqueo as calcTotalArqueo } from '../../core/utils/caja-arqueo.helpers';
import { CajaInformePrintService } from '../../core/services/caja-informe-print.service';
import { CajaEstadoService } from '../../core/services/caja-estado.service';
import { CajaArqueoPanelComponent } from './caja-arqueo-panel.component';
import { CajaResumenServiciosComponent } from './caja-resumen-servicios.component';
import { buildMetodosPagoCards, MetodoPagoCard } from '../../core/utils/metodo-pago.util';

@Component({
  selector: 'argo-caja-cuadre',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CurrencyPipe,
    DatePipe,
    CajaArqueoPanelComponent,
    CajaResumenServiciosComponent,
  ],
  templateUrl: './caja-cuadre.component.html',
  styleUrls: ['./caja-cuadre.component.scss'],
})
export class CajaCuadreComponent implements OnInit {
  private cajaSvc = inject(CajaSesionService);
  private catSvc = inject(CatalogoService);
  private configSvc = inject(ConfigService);
  private informePrint = inject(CajaInformePrintService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cajaEstado = inject(CajaEstadoService);

  isAdmin = signal(false);
  cajaAbierta = signal(false);
  sesion = signal<CajaSesion | null>(null);
  resumen = signal<ResumenCaja | null>(null);
  historial = signal<CajaSesion[]>([]);
  tiposPagoCat = signal<Record<string, unknown>[]>([]);
  loading = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);

  saldoInicialApertura = signal(0);
  obsApertura = signal('');
  arqueoLineas = signal<ArqueoLinea[]>(crearLineasArqueoVacias());
  arqueoTotal = computed(() => calcTotalArqueo(this.arqueoLineas()));
  efectivoContado = computed(() => this.arqueoTotal());
  obsCierre = signal('');
  mostrarApertura = signal(false);
  mostrarAuthCierre = signal(false);
  authAdminUser = signal('');
  authAdminPass = signal('');
  authError = signal<string | null>(null);
  ultimoCierre = signal<CierreCajaResponse | null>(null);
  egresosSesion = signal<CajaEgresoItem[]>([]);
  egresosInforme = signal<CajaEgresoItem[]>([]);
  ingresosInforme = signal<CajaIngresoItem[]>([]);
  descuadreInforme = signal<CajaDescuadre | null>(null);
  empresaConfig = signal<ConfigRecibo | null>(null);

  egresosSinSoporte = computed(() => this.egresosSesion().filter((e) => !tieneSoporteEgreso(e)));
  cantSinSoporte = computed(() => this.egresosSinSoporte().length);

  ventasBrutas = computed(() => this.resumen()?.ventasBrutas ?? this.resumen()?.totalIngresos ?? 0);
  cantidadRecibos = computed(
    () => this.resumen()?.cantidadRecibos ?? this.resumen()?.cantidadIngresos ?? 0,
  );
  efectivoEsperado = computed(
    () => this.resumen()?.efectivoEsperado ?? 0,
  );
  ingresosEfectivo = computed(() => this.resumen()?.totalIngresosEfectivo ?? 0);
  egresosEfectivo = computed(() => this.resumen()?.totalEgresosEfectivo ?? 0);
  totalGastos = computed(() => this.resumen()?.totalGastos ?? this.resumen()?.totalEgresos ?? 0);
  totalRetiros = computed(() => this.resumen()?.totalRetiros ?? 0);
  saldoInicial = computed(() => this.resumen()?.saldoInicial ?? this.sesion()?.saldoInicial ?? 0);
  ingresosPorServicio = computed(() => this.resumen()?.ingresosPorServicio ?? []);

  diferenciaCierre = computed(() => {
    const c = this.efectivoContado();
    if (c == null || !Number.isFinite(c)) return null;
    return c - this.efectivoEsperado();
  });

  hayDescuadreCierre = computed(() => {
    const d = this.diferenciaCierre();
    return d != null && Math.abs(d) >= 1;
  });

  descuadresPendientesHistorial = computed(
    () => this.historial().filter((s) => s.descuadreEstado === 'pendiente').length,
  );

  metodosPago = computed((): MetodoPagoCard[] => {
    const mapCat = new Map(
      this.tiposPagoCat().map((t) => {
        const id = String(t['idTipoPago'] ?? t['codigo'] ?? '');
        const label = String(t['descripcion'] ?? t['nombre'] ?? id);
        return [id, label];
      }),
    );
    const rows = (this.resumen()?.ingresosPorTipo ?? []).map((r) => ({
      forma: r.descripcion || mapCat.get(String(r.idTipoPago)) || String(r.idTipoPago),
      total: r.total,
      cantidad: r.cantidad,
    }));
    return buildMetodosPagoCards(rows);
  });

  ngOnInit(): void {
    const r = String(this.auth.user()?.rol || '').toLowerCase();
    this.isAdmin.set(r.includes('admin'));
    this.catSvc.list('catTipoPago', { refresh: true }).subscribe({
      next: (t) => this.tiposPagoCat.set(t || []),
    });
    this.configSvc.obtenerReciboEncabezado().subscribe({
      next: (c) => this.empresaConfig.set(c),
      error: () => this.empresaConfig.set(null),
    });
    this.refrescar();
    this.cargarHistorial();
    this.route.queryParamMap.subscribe((p) => {
      if (p.get('abrir') === '1' && !this.cajaAbierta()) {
        this.abrirCaja();
      }
    });
  }

  refrescar(): void {
    this.loading.set(true);
    this.cajaSvc.activa().subscribe({
      next: (r) => {
        this.cajaAbierta.set(!!r.abierta);
        this.sesion.set(r.sesion);
        this.resumen.set(r.resumenParcial ?? null);
        if (r.abierta) {
          this.cajaSvc.egresosSesionActiva().subscribe({
            next: (rows) => this.egresosSesion.set(rows || []),
            error: () => this.egresosSesion.set([]),
          });
        } else {
          this.egresosSesion.set([]);
        }
        this.loading.set(false);
      },
      error: () => {
        this.cajaAbierta.set(false);
        this.loading.set(false);
      },
    });
  }

  cargarHistorial(): void {
    const hoy = new Date().toISOString().slice(0, 10);
    const desde = new Date();
    desde.setDate(desde.getDate() - 30);
    this.cajaSvc
      .listar({
        estado: 'cerrada',
        desde: desde.toISOString().slice(0, 10),
        hasta: hoy,
        limit: 40,
        todas: this.isAdmin(),
      })
      .subscribe({
        next: (rows) => this.historial.set(rows || []),
      });
  }

  abrirCaja(): void {
    this.saldoInicialApertura.set(0);
    this.obsApertura.set('');
    this.mostrarApertura.set(true);
  }

  confirmarApertura(): void {
    this.loading.set(true);
    this.cajaSvc.abrir(this.saldoInicialApertura(), this.obsApertura() || undefined).subscribe({
      next: () => {
        this.mostrarApertura.set(false);
        this.loading.set(false);
        this.inform('Caja abierta');
        void this.cajaEstado.refrescar();
        this.refrescar();
      },
      error: (e) => {
        this.loading.set(false);
        this.inform(e?.error?.message || 'No se pudo abrir la caja');
      },
    });
  }

  onArqueoChange(lineas: ArqueoLinea[]): void {
    this.arqueoLineas.set(lineas);
  }

  cerrarCaja(): void {
    const id = this.sesion()?.idSesion;
    if (!id) return;
    const contado = this.arqueoTotal();
    if (!(contado > 0)) {
      this.inform('Realice el arqueo de efectivo (billetes y monedas) antes de cerrar');
      return;
    }
    if (this.hayDescuadreCierre() && !this.isAdmin()) {
      this.authError.set(null);
      this.mostrarAuthCierre.set(true);
      return;
    }
    this.ejecutarCierre();
  }

  confirmarCierreConAuth(): void {
    this.authError.set(null);
    if (!this.isAdmin()) {
      const u = this.authAdminUser().trim();
      const p = this.authAdminPass();
      if (!u || !p) {
        this.authError.set('Ingrese usuario y contraseña de un administrador');
        return;
      }
    }
    this.ejecutarCierre(
      !this.isAdmin()
        ? { autorizadoUsername: this.authAdminUser().trim(), autorizadoPassword: this.authAdminPass() }
        : undefined,
    );
  }

  cancelarAuthCierre(): void {
    this.mostrarAuthCierre.set(false);
    this.authError.set(null);
    this.authAdminUser.set('');
    this.authAdminPass.set('');
  }

  private ejecutarCierre(auth?: { autorizadoUsername: string; autorizadoPassword: string }): void {
    const id = this.sesion()?.idSesion;
    if (!id) return;
    const contado = this.arqueoTotal();
    if (!(contado > 0)) return;

    this.loading.set(true);
    this.authError.set(null);
    this.cajaSvc
      .cerrar(id, {
        efectivoContado: contado,
        arqueo: this.arqueoLineas(),
        observaciones: this.obsCierre() || undefined,
        ...auth,
      })
      .subscribe({
        next: (r) => {
          this.ultimoCierre.set(r);
          this.descuadreInforme.set(r.descuadre ?? null);
          this.cargarMovimientosInforme(r.sesion.idSesion!, () => {
            this.cajaAbierta.set(false);
            this.sesion.set(null);
            this.resumen.set(null);
            this.arqueoLineas.set(crearLineasArqueoVacias());
            this.obsCierre.set('');
            this.mostrarAuthCierre.set(false);
            this.authAdminUser.set('');
            this.authAdminPass.set('');
            this.authError.set(null);
            this.loading.set(false);
            if (r.descuadre) {
              this.inform(
                `Caja cerrada con descuadre de ${r.descuadre.diferencia?.toLocaleString('es-CO')} COP. Tiene el mes para cuadrarlo antes de la nómina.`,
              );
            } else {
              this.inform('Caja cerrada correctamente');
            }
            this.cargarHistorial();
            void this.cajaEstado.refrescar();
            this.informePrint.imprimirIndividual({
              sesion: r.sesion,
              resumen: r.resumen,
              ingresos: this.ingresosInforme(),
              egresos: this.egresosInforme(),
              descuadre: r.descuadre,
            });
          });
        },
        error: (e) => {
          this.loading.set(false);
          const code = e?.error?.code;
          const status = e?.status;
          const errMsg = e?.error?.message || 'No se pudo cerrar la caja';

          if (code === 'AUTH_INVALID' || code === 'AUTH_REQUIRED' || code === 'DESCUADRE_AUTH_REQUIRED') {
            this.mostrarAuthCierre.set(true);
            this.authError.set(errMsg);
            return;
          }

          if (status === 404) {
            this.mostrarAuthCierre.set(false);
            this.authError.set(null);
            this.refrescar();
            this.cargarHistorial();
            this.inform('La caja ya fue cerrada. Actualizamos el estado.');
            return;
          }

          if (this.mostrarAuthCierre()) {
            this.authError.set(errMsg);
          } else {
            this.inform(errMsg);
          }
        },
      });
  }

  verCierre(s: CajaSesion): void {
    if (!s.idSesion) return;
    const dest = this.isAdmin() ? '/app/cierres' : '/app/caja/cierres';
    this.router.navigate([dest, s.idSesion]);
  }

  verResumenSesion(s: CajaSesion): void {
    if (!s.idSesion) return;
    this.cajaSvc.resumen(s.idSesion).subscribe({
      next: (r) => {
        this.ultimoCierre.set({ sesion: r.sesion, resumen: r.resumen, descuadre: r.descuadre });
        this.descuadreInforme.set(r.descuadre ?? null);
        this.cargarMovimientosInforme(s.idSesion!, () => {
          const c = this.ultimoCierre();
          if (!c) return;
          this.informePrint.imprimirIndividual({
            sesion: c.sesion,
            resumen: c.resumen,
            ingresos: this.ingresosInforme(),
            egresos: this.egresosInforme(),
            descuadre: this.descuadreInforme(),
          });
        });
      },
    });
  }

  private cargarMovimientosInforme(idSesion: number, done: () => void): void {
    let pending = 2;
    const finish = () => {
      pending -= 1;
      if (pending <= 0) done();
    };
    this.cajaSvc.egresosPorSesion(idSesion).subscribe({
      next: (rows) => {
        this.egresosInforme.set(rows || []);
        finish();
      },
      error: () => {
        this.egresosInforme.set([]);
        finish();
      },
    });
    this.cajaSvc.ingresosPorSesion(idSesion).subscribe({
      next: (rows) => {
        this.ingresosInforme.set(rows || []);
        finish();
      },
      error: () => {
        this.ingresosInforme.set([]);
        finish();
      },
    });
  }

  ventasHistorial(s: CajaSesion): number {
    const r = s.resumen as ResumenCaja | undefined;
    return r?.ventasBrutas ?? r?.totalIngresos ?? 0;
  }

  esperadoHistorial(s: CajaSesion): number {
    const r = s.resumen as ResumenCaja | undefined;
    return r?.efectivoEsperado ?? s.saldoFinal ?? 0;
  }

  contadoHistorial(s: CajaSesion): number | null {
    if (s.efectivoContado != null) return s.efectivoContado;
    const r = s.resumen as ResumenCaja | undefined;
    return r?.efectivoContado ?? null;
  }

  diferenciaHistorial(s: CajaSesion): number | null {
    if (s.descuadreDiferencia != null) return s.descuadreDiferencia;
    if (s.diferencia != null) return s.diferencia;
    const c = this.contadoHistorial(s);
    if (c == null) return null;
    return c - this.esperadoHistorial(s);
  }

  tieneDescuadrePendiente(s: CajaSesion): boolean {
    return s.descuadreEstado === 'pendiente';
  }

  enNominaDescuadre(s: CajaSesion): boolean {
    return s.descuadreEstado === 'en_nomina';
  }

  montoDebeHistorial(s: CajaSesion): number {
    if (s.descuadreMontoDebe != null && s.descuadreMontoDebe > 0) return s.descuadreMontoDebe;
    const d = this.diferenciaHistorial(s);
    return d != null && d < -1 ? Math.abs(d) : 0;
  }

  private tonoMetodo(label: string): { tone: string; icon: string } {
    const t = label.toLowerCase();
    if (t.includes('efect')) return { tone: 'emerald', icon: '💵' };
    if (t.includes('nequi')) return { tone: 'pink', icon: '📱' };
    if (t.includes('davi')) return { tone: 'red', icon: '📲' };
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
        t.includes('realice');
    }
    this.msgError.set(err);
  }
}
