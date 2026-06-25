import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { CajaSesionService } from '../../core/services/caja-sesion.service';
import { CajaEstadoService } from '../../core/services/caja-estado.service';
import { CajaAperturaAlertService } from '../../core/services/caja-apertura-alert.service';
import { CatalogoService } from '../../core/services/catalogo.service';
import { IngresoService } from '../../core/services/ingreso.service';
import { requiereReferenciaPago, requiereSoportePago } from '../../core/utils/referencia-pago.util';
import { leerImagenSoporte, tieneSoportePago } from '../../core/utils/pago-soporte.helpers';
import { pagoIntangibleCompleto, validarPagoIntangible } from '../../core/utils/pago-intangible.validators';
import {
  LiquidacionConSaldoItem,
  LiquidacionService,
} from '../../core/services/liquidacion.service';
import { ReciboService, idIngreso } from '../../core/services/recibo.service';
import {
  capDoc,
  capFecha,
  capTipoIngreso,
  capValorIngreso,
} from '../../core/utils/capsule.util';
import { readVistaLista, saveVistaLista, VistaLista } from '../../core/utils/vista-lista.helpers';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { AlertaPagoAlumnoBannerComponent } from '../alumnos/alerta-pago-alumno-banner.component';
import { AlertaPagoAlumnoService } from '../../core/services/alerta-pago-alumno.service';
import { PagoSoporteFieldComponent } from '../../shared/pago-soporte-field/pago-soporte-field.component';

const TIPOS_PAGO_DEF = [
  { idTipoPago: '1', codigo: 'EF', descripcion: 'Efectivo' },
  { idTipoPago: '2', codigo: 'TR', descripcion: 'Transferencia' },
  { idTipoPago: '3', codigo: 'TC', descripcion: 'Tarjeta crédito' },
  { idTipoPago: '4', codigo: 'TD', descripcion: 'Tarjeta débito' },
  { idTipoPago: '5', codigo: 'CH', descripcion: 'Cheque' },
  { idTipoPago: '6', codigo: 'NE', descripcion: 'Nequi / Daviplata' },
];

@Component({
  selector: 'argo-caja-cobros-pendientes',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, AlertaPagoAlumnoBannerComponent, PagoSoporteFieldComponent],
  templateUrl: './caja-cobros-pendientes.component.html',
  styleUrls: ['./caja-cobros-pendientes.component.scss'],
})
export class CajaCobrosPendientesComponent implements OnInit {
  private liqSvc = inject(LiquidacionService);
  private ingSvc = inject(IngresoService);
  private catSvc = inject(CatalogoService);
  private cajaSvc = inject(CajaSesionService);
  private cajaEstado = inject(CajaEstadoService);
  private cajaAlert = inject(CajaAperturaAlertService);
  private reciboSvc = inject(ReciboService);
  private auth = inject(AuthService);
  private confirmSvc = inject(ConfirmDialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private alertaPagoSvc = inject(AlertaPagoAlumnoService);

  private readonly vistaKey = 'argo-caja-cobros-vista';

  vista = signal<VistaLista>(readVistaLista(this.vistaKey));
  items = signal<LiquidacionConSaldoItem[]>([]);
  total = signal(0);
  totales = signal({ valor: 0, abonado: 0, saldo: 0 });
  busqueda = signal('');
  loading = signal(false);
  cajaAbierta = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);

  seleccionado = signal<LiquidacionConSaldoItem | null>(null);
  pagosItem = signal<any[]>([]);
  loadingDetalle = signal(false);
  saving = signal(false);

  tiposPago = signal<Record<string, unknown>[]>(TIPOS_PAGO_DEF);
  cuentasBancarias = signal<Record<string, unknown>[]>([]);
  valor = signal(0);
  idTipoPago = signal('');
  idCuentaBancaria = signal('');
  numComprobante = signal('');
  archivoSoporte = signal<File | null>(null);
  previewSoporte = signal<string | null>(null);
  observaciones = signal('');

  ingresoPendienteAnular = signal<any | null>(null);
  mostrarAuthAnular = signal(false);
  authAdminUser = signal('');
  authAdminPass = signal('');

  capDoc = capDoc;
  capFecha = capFecha;
  capTipoIngreso = capTipoIngreso;
  capValorIngreso = capValorIngreso;

  ngOnInit(): void {
    this.alertaPagoSvc.cargar().subscribe();
    this.catSvc.list('catTipoPago', { refresh: true }).subscribe({
      next: (d) => this.tiposPago.set(d?.length ? d : TIPOS_PAGO_DEF),
      error: () => this.tiposPago.set(TIPOS_PAGO_DEF),
    });
    this.catSvc.list('cuentasBancarias', { refresh: true }).subscribe({
      next: (d) => this.cuentasBancarias.set(d || []),
      error: () => this.cuentasBancarias.set([]),
    });

    void this.cajaEstado.refrescar().then((ok) => this.cajaAbierta.set(ok));

    const q = this.route.snapshot.queryParamMap.get('q') || this.route.snapshot.queryParamMap.get('doc');
    if (q) this.busqueda.set(q);
    this.cargar();
  }

  setVista(v: VistaLista): void {
    this.vista.set(v);
    saveVistaLista(this.vistaKey, v);
  }

  cargar(): void {
    this.loading.set(true);
    this.inform(null);
    this.fetchPaginas(0, []);
  }

  private fetchPaginas(skip: number, acumulado: LiquidacionConSaldoItem[]): void {
    const q = this.busqueda().trim() || undefined;
    this.liqSvc.listarConSaldo({ q, skip, limit: 500 }).subscribe({
      next: (r) => {
        const pagina = r.items || [];
        const merged = [...acumulado, ...pagina];
        const total = r.total || merged.length;
        if (merged.length < total && pagina.length > 0) {
          this.fetchPaginas(merged.length, merged);
          return;
        }
        this.items.set(merged);
        this.total.set(total);
        this.totales.set(r.totales || { valor: 0, abonado: 0, saldo: 0 });
        this.loading.set(false);
        const sel = this.seleccionado();
        if (sel) {
          const upd = merged.find((i) => i._id === sel._id);
          if (upd) {
            this.seleccionado.set(upd);
            this.valor.set(this.num(upd.saldo));
          } else {
            this.cerrarDetalle();
          }
        }
      },
      error: (e) => {
        this.loading.set(false);
        this.inform(e?.error?.message || 'Error cargando servicios con saldo.');
      },
    });
  }

  fechaItem(it: LiquidacionConSaldoItem): string | null {
    return it.fecha || it.fechaCreacion || it.createdAt || null;
  }

  onBuscar(val: string): void {
    this.busqueda.set(val);
    this.cargar();
  }

  abrir(it: LiquidacionConSaldoItem): void {
    void this.cajaEstado.refrescar().then((ok) => this.cajaAbierta.set(ok));
    this.seleccionado.set(it);
    this.valor.set(this.num(it.saldo));
    this.idTipoPago.set('');
    this.idCuentaBancaria.set('');
    this.numComprobante.set('');
    this.observaciones.set('');
    this.cargarPagos(it._id);
  }

  cerrarDetalle(): void {
    this.seleccionado.set(null);
    this.pagosItem.set([]);
  }

  cargarPagos(idLiquidacion: string): void {
    this.loadingDetalle.set(true);
    this.ingSvc.listarPorLiquidacion(idLiquidacion).subscribe({
      next: (rows) => {
        this.pagosItem.set(rows || []);
        this.loadingDetalle.set(false);
      },
      error: () => this.loadingDetalle.set(false),
    });
  }

  esEfectivo(): boolean {
    const id = this.idTipoPago();
    if (!id) return false;
    const t = this.tiposPago().find((x) => this.tipoPagoValor(x) === id);
    const txt = t ? this.tipoPagoLabel(t).toLowerCase() : '';
    return txt.includes('efect') || txt.includes('ef');
  }

  requiereCuentaEmpresa(): boolean {
    return !!this.idTipoPago() && !this.esEfectivo();
  }

  requiereComprobante(): boolean {
    const id = this.idTipoPago();
    if (!id) return false;
    const t = this.tiposPago().find((x) => this.tipoPagoValor(x) === id);
    return requiereReferenciaPago(t ? this.tipoPagoLabel(t) : '');
  }

  requiereSoporte(): boolean {
    const id = this.idTipoPago();
    if (!id) return false;
    const t = this.tiposPago().find((x) => this.tipoPagoValor(x) === id);
    return requiereSoportePago(t ? this.tipoPagoLabel(t) : '');
  }

  onSoporteArchivo(file: File) {
    const ok = leerImagenSoporte(
      file,
      (dataUrl) => {
        this.archivoSoporte.set(file);
        this.previewSoporte.set(dataUrl);
      },
      (msg) => this.inform(msg),
    );
    if (!ok) this.quitarSoporte();
  }

  quitarSoporte() {
    this.archivoSoporte.set(null);
    this.previewSoporte.set(null);
  }

  inputPagoIntangible() {
    return {
      esIntangible: this.requiereCuentaEmpresa(),
      referencia: this.numComprobante(),
      archivo: this.archivoSoporte(),
    };
  }

  mensajePagoIntangible(): string | null {
    const v = validarPagoIntangible(this.inputPagoIntangible());
    return v.ok ? null : v.message;
  }

  puedeRegistrar(): boolean {
    if (!this.seleccionado() || !this.idTipoPago() || !(this.valor() > 0)) return false;
    if (this.requiereCuentaEmpresa() && !this.idCuentaBancaria()) return false;
    return pagoIntangibleCompleto(this.inputPagoIntangible());
  }

  onTipoPagoChange(id: string): void {
    this.idTipoPago.set(id);
    if (!id) {
      this.idCuentaBancaria.set('');
      return;
    }
    const t = this.tiposPago().find((x) => this.tipoPagoValor(x) === id);
    const txt = t ? this.tipoPagoLabel(t).toLowerCase() : '';
    const cuentas = this.cuentasBancarias();
    if (!cuentas.length) return;
    let match: Record<string, unknown> | undefined;
    if (txt.includes('nequi')) {
      match = cuentas.find((c) => String(c['banco'] || '').toLowerCase().includes('nequi'));
    } else if (txt.includes('daviplata')) {
      match = cuentas.find((c) => String(c['banco'] || '').toLowerCase().includes('daviplata'));
    }
    if (match) this.idCuentaBancaria.set(this.cuentaValor(match));
  }

  async registrar(): Promise<void> {
    const it = this.seleccionado();
    if (!it) return;
    if (!(await this.cajaAlert.ensureAbierta('registrar cobros'))) return;
    if (!this.valor() || this.valor() <= 0) {
      this.inform('Valor del pago inválido.');
      return;
    }
    if (!this.idTipoPago()) {
      this.inform('Seleccione la forma de pago.');
      return;
    }
    if (this.requiereCuentaEmpresa() && !this.idCuentaBancaria()) {
      this.inform('Seleccione la cuenta bancaria de la empresa.');
      return;
    }
    const intangible = validarPagoIntangible(this.inputPagoIntangible());
    if (!intangible.ok) {
      this.inform(intangible.message);
      return;
    }
    if (!this.puedeRegistrar()) {
      this.inform(this.mensajePagoIntangible() || 'Complete referencia y pantallazo del movimiento.');
      return;
    }
    if (this.valor() > this.num(it.saldo)) {
      this.inform('El valor excede el saldo pendiente.');
      return;
    }

    this.saving.set(true);
    this.inform(null);
    this.ingSvc
      .crear(
        {
          numDoc: it.alumnoDoc ?? it.numDoc,
          idLiquidacion: it._id,
          valor: this.valor(),
          idTipoPago: this.idTipoPago(),
          idCuentaBancaria: this.requiereCuentaEmpresa() ? this.idCuentaBancaria() || undefined : undefined,
          numComprobante: this.numComprobante() || undefined,
          observaciones: this.observaciones() || undefined,
        },
        this.archivoSoporte(),
      )
      .subscribe({
        next: (ing) => {
          this.saving.set(false);
          this.inform(`Pago registrado (${ing.numRecibo || ''}).`);
          this.alertaPagoSvc.cargar().subscribe();
          this.cargar();
          if (it._id) this.cargarPagos(it._id);
          const id = ing?._id;
          if (id) void this.preguntarImprimirRecibo(ing);
        },
        error: (e) => {
          this.saving.set(false);
          this.inform(e?.error?.message || 'Error al registrar pago.');
        },
      });
  }

  async reversar(p: any): Promise<void> {
    const it = this.seleccionado();
    if (!it) return;
    const ref = p.numRecibo ? ` «${p.numRecibo}»` : '';
    const ok = await this.confirmSvc.open({
      title: '¿Reversar este pago?',
      message: `Se anulará el comprobante${ref} y se restaurará el saldo del servicio.`,
      variant: 'warn',
      icon: 'warning',
      confirmLabel: 'Sí, reversar',
    });
    if (!ok) return;
    if (!this.auth.isAdmin()) {
      this.ingresoPendienteAnular.set(p);
      this.authAdminUser.set('');
      this.authAdminPass.set('');
      this.mostrarAuthAnular.set(true);
      return;
    }
    this.ejecutarReversar(p, it._id);
  }

  confirmarReversarConSupervisor(): void {
    const p = this.ingresoPendienteAnular();
    const it = this.seleccionado();
    if (!p || !it) return;
    const u = this.authAdminUser().trim();
    const pw = this.authAdminPass();
    if (!u || !pw) {
      this.inform('Ingrese usuario y contraseña del administrador.');
      return;
    }
    this.ejecutarReversar(p, it._id, { autorizadoUsername: u, autorizadoPassword: pw });
  }

  cancelarReversarSupervisor(): void {
    this.mostrarAuthAnular.set(false);
    this.ingresoPendienteAnular.set(null);
    this.authAdminUser.set('');
    this.authAdminPass.set('');
  }

  private ejecutarReversar(
    p: any,
    idLiquidacion: string,
    auth?: { autorizadoUsername: string; autorizadoPassword: string },
  ): void {
    this.ingSvc.eliminar(p._id, auth).subscribe({
      next: () => {
        this.mostrarAuthAnular.set(false);
        this.ingresoPendienteAnular.set(null);
        this.authAdminUser.set('');
        this.authAdminPass.set('');
        this.inform('Pago reversado.');
        this.cargar();
        this.cargarPagos(idLiquidacion);
      },
      error: (e) => this.inform(e?.error?.message || 'Error reversando pago.'),
    });
  }

  imprimirRecibo(ing: { _id?: unknown; id?: unknown }): void {
    const id = idIngreso(ing);
    if (!id) {
      this.inform('No se puede imprimir: comprobante sin ID.');
      return;
    }
    this.reciboSvc.abrirHtml(id, (m) => this.inform(m));
  }

  verRecibo(ing: { _id?: unknown; id?: unknown }): void {
    const id = idIngreso(ing);
    if (!id) return;
    const url = this.router.serializeUrl(this.router.createUrlTree(['/recibo', id]));
    const w = window.open(url, '_blank', 'width=420,height=720');
    if (!w) this.inform('Permita ventanas emergentes para ver el comprobante.');
  }

  private async preguntarImprimirRecibo(ing: { _id?: unknown; id?: unknown; numRecibo?: string }): Promise<void> {
    const num = ing.numRecibo ? ` (${ing.numRecibo})` : '';
    const ok = await this.confirmSvc.open({
      title: '¿Imprimir comprobante?',
      message: `El pago se registró correctamente${num}. ¿Desea imprimir el comprobante ahora?`,
      variant: 'primary',
      icon: 'print',
      confirmLabel: 'Sí, imprimir',
      cancelLabel: 'Ahora no',
    });
    if (ok) this.imprimirRecibo(ing);
  }

  tipoPagoValor(t: Record<string, unknown>): string {
    const v = t['idTipoPago'] ?? t['codigo'] ?? t['_id'];
    return v != null ? String(v) : '';
  }

  tipoPagoLabel(t: Record<string, unknown>): string {
    const d = t['descripcion'] ?? t['nombre'] ?? t['tipo'];
    return d ? String(d) : this.tipoPagoValor(t);
  }

  cuentaValor(c: Record<string, unknown>): string {
    const v = c['idCuentaBancaria'] ?? c['idCuenta'] ?? c['_id'];
    return v != null ? String(v) : '';
  }

  labelCuenta(c: Record<string, unknown>): string {
    const b = String(c['banco'] || '').trim();
    const n = c['numCuenta'] ?? '';
    const t = String(c['tipo'] || '').trim();
    return [b, t, n].filter(Boolean).join(' — ');
  }

  num(v: unknown): number {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return Number(v) || 0;
    if (typeof v === 'object' && (v as { $numberDecimal?: string }).$numberDecimal != null) {
      return Number((v as { $numberDecimal: string }).$numberDecimal) || 0;
    }
    return Number(v) || 0;
  }

  fmt(v: unknown): string {
    return this.num(v).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  }

  tiempoFmt(f?: string): string {
    if (!f) return '';
    const d = new Date(f);
    return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  }

  estadoLabel(it: LiquidacionConSaldoItem): string {
    if (it.estado === 'parcial') return 'Parcial';
    if (it.estado === 'pendiente') return 'Pendiente';
    return it.estado || 'Pendiente';
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
