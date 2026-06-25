import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AlumnoStore } from '../../../core/services/alumno-store.service';
import { ReciboService, idIngreso } from '../../../core/services/recibo.service';
import { CertificadoService } from '../../../core/services/certificado.service';
import { ConfirmDialogService } from '../../../shared/confirm-dialog/confirm-dialog.service';
import { CatalogoService } from '../../../core/services/catalogo.service';
import { IngresoService } from '../../../core/services/ingreso.service';
import { CajaAperturaAlertService } from '../../../core/services/caja-apertura-alert.service';
import { LiquidacionItem, LiquidacionResumen, LiquidacionService } from '../../../core/services/liquidacion.service';
import { etiquetaSaldoCorta, tituloSaldoItem } from '../../../core/utils/saldo-alerta.helpers';
import { esLiquidacionVirtual } from '../catalogo.helpers';
import {
  CatalogoEnumBuscarComponent,
  EnumBuscarOption,
} from '../../../shared/catalogo-enum-buscar/catalogo-enum-buscar.component';
import { PermisoService } from '../../../core/services/permiso.service';
import { FacturaEmitirModalComponent } from '../../facturacion/factura-emitir-modal.component';
import {
  FacturaElectronicaItem,
  FacturacionService,
} from '../../../core/services/facturacion.service';
import { ComprobanteHoyAlertService } from '../../../core/services/comprobante-hoy-alert.service';
import { AlertaPagoAlumnoService } from '../../../core/services/alerta-pago-alumno.service';
import { requiereReferenciaPago } from '../../../core/utils/referencia-pago.util';
import { leerImagenSoporte } from '../../../core/utils/pago-soporte.helpers';
import { pagoIntangibleCompleto, validarPagoIntangible } from '../../../core/utils/pago-intangible.validators';
import { PagoSoporteFieldComponent } from '../../../shared/pago-soporte-field/pago-soporte-field.component';
import {
  ConfigServiciosAdicionalesService,
  PreviewServicioAdicionalItem,
} from '../../../core/services/config-servicios-adicionales.service';

interface ItemPagoSel {
  idLiquidacion: string;
  descripcion: string;
  saldo: number;
  valor: number;
  /** Texto en edición; evita que el input pierda el foco al digitar. */
  valorText?: string;
}

const TIPOS_PAGO_DEF = [
  { idTipoPago: '1', codigo: 'EF', descripcion: 'Efectivo' },
  { idTipoPago: '2', codigo: 'TR', descripcion: 'Transferencia' },
  { idTipoPago: '3', codigo: 'TC', descripcion: 'Tarjeta crédito' },
  { idTipoPago: '4', codigo: 'TD', descripcion: 'Tarjeta débito' },
  { idTipoPago: '5', codigo: 'CH', descripcion: 'Cheque' },
  { idTipoPago: '6', codigo: 'NE', descripcion: 'Nequi / Daviplata' },
];

@Component({
  selector: 'argo-pagos',
  standalone: true,
  imports: [CommonModule, FormsModule, CatalogoEnumBuscarComponent, FacturaEmitirModalComponent, PagoSoporteFieldComponent],
  templateUrl: './pagos.component.html',
  styleUrls: ['./pagos.component.scss'],
})
export class PagosComponent {
  store = inject(AlumnoStore);
  auth = inject(AuthService);
  permisoSvc = inject(PermisoService);
  private router = inject(Router);
  private comprobanteAlertSvc = inject(ComprobanteHoyAlertService);
  private alertaPagoSvc = inject(AlertaPagoAlumnoService);
  private route = inject(ActivatedRoute);
  private catSvc = inject(CatalogoService);
  private liqSvc = inject(LiquidacionService);
  private ingSvc = inject(IngresoService);
  private reciboSvc = inject(ReciboService);
  private certSvc = inject(CertificadoService);
  private confirmSvc = inject(ConfirmDialogService);
  private cajaAlert = inject(CajaAperturaAlertService);
  private feSvc = inject(FacturacionService);
  private cfgServAdic = inject(ConfigServiciosAdicionalesService);

  tiposPago = signal<Record<string, unknown>[]>(TIPOS_PAGO_DEF);
  cuentasBancarias = signal<Record<string, unknown>[]>([]);

  liquidacion = signal<LiquidacionResumen>({ items: [], totales: { valor: 0, abonado: 0, saldo: 0 } });
  pagos = signal<any[]>([]);

  itemsPago = signal<ItemPagoSel[]>([]);
  idTipoPago = signal<string>('');
  idCuentaBancaria = signal<string>('');
  numComprobante = signal<string>('');
  archivoSoporte = signal<File | null>(null);
  previewSoporte = signal<string | null>(null);
  observaciones = signal<string>('');

  loading = signal(false);
  saving = signal(false);
  msg = signal<string | null>(null);

  mostrarFactura = signal(false);
  facturasEmitidas = signal<FacturaElectronicaItem[]>([]);
  loadingFacturas = signal(false);
  msgFacturas = signal<string | null>(null);
  facturaDetalleAbierto = signal<string | null>(null);
  ingresoDestacado = signal<string | null>(null);

  ingresoPendienteAnular = signal<any | null>(null);
  mostrarAuthAnular = signal(false);
  authAdminUser = signal('');
  authAdminPass = signal('');

  /** Evita spinner en recargas por sync entre pestañas (solo liqTick). */
  private lastRecargaNumDoc: string | number | null = null;

  itemsConSaldo = computed(() =>
    this.liquidacion()
      .items.filter((i) => this.num(i.saldo) > 0.0001)
      .sort((a, b) =>
        String(a.descripcion || '').localeCompare(String(b.descripcion || ''), 'es'),
      ),
  );
  totales = computed(() => this.liquidacion().totales);

  etiquetaSaldo = etiquetaSaldoCorta;
  esVirtual = esLiquidacionVirtual;
  tituloSaldoItem = tituloSaldoItem;

  extrasPagoPreview = signal<PreviewServicioAdicionalItem[]>([]);

  subtotalItemsPago = computed(() =>
    this.itemsPago().reduce((a, i) => a + (Number(i.valor) || 0), 0),
  );

  totalExtrasPago = computed(() =>
    this.extrasPagoPreview().reduce((a, i) => a + (Number(i.valor) || 0), 0),
  );

  totalPago = computed(() => this.subtotalItemsPago() + this.totalExtrasPago());

  itemSeleccionado = (id: string) => this.itemsPago().some((x) => x.idLiquidacion === String(id));

  esEfectivo = computed(() => {
    const t = this.tipoPagoSel();
    if (!t) return false;
    const txt = this.tipoPagoLabel(t).toLowerCase();
    return txt.includes('efect') || txt.includes('ef');
  });

  requiereCuentaEmpresa = computed(() => !!this.idTipoPago() && !this.esEfectivo());

  requiereComprobante = computed(() => {
    const t = this.tipoPagoSel();
    if (!t) return false;
    return requiereReferenciaPago(this.tipoPagoLabel(t));
  });

  requiereSoporte = computed(() => this.requiereCuentaEmpresa());

  inputPagoIntangible = computed(() => ({
    esIntangible: this.requiereCuentaEmpresa(),
    referencia: this.numComprobante(),
    archivo: this.archivoSoporte(),
  }));

  mensajePagoIntangible = computed(() => {
    const v = validarPagoIntangible(this.inputPagoIntangible());
    return v.ok ? null : v.message;
  });

  opcionesItemsLiquidacion = computed<EnumBuscarOption[]>(() =>
    this.itemsConSaldo()
      .filter((it) => !this.itemSeleccionado(String(it._id)))
      .map((it) => ({
        value: it._id,
        label: this.descrItem(it),
      })),
  );

  opcionesTiposPago = computed<EnumBuscarOption[]>(() =>
    this.tiposPago().map((t) => ({
      value: this.tipoPagoValor(t),
      label: this.tipoPagoLabel(t),
    })),
  );

  textoTipoPago = computed(() => {
    const id = this.idTipoPago();
    const t = this.tiposPago().find((x) => this.tipoPagoValor(x) === id);
    return t ? this.tipoPagoLabel(t) : '';
  });

  opcionesCuentasBancarias = computed<EnumBuscarOption[]>(() =>
    this.cuentasBancarias().map((c) => ({
      value: this.cuentaValor(c),
      label: this.labelCuenta(c),
    })),
  );

  textoCuentaBancaria = computed(() => {
    const id = this.idCuentaBancaria();
    const c = this.cuentasBancarias().find((x) => this.cuentaValor(x) === id);
    return c ? this.labelCuenta(c) : '';
  });

  constructor() {
    this.catSvc.list('catTipoPago', { refresh: true }).subscribe({
      next: (d) => this.tiposPago.set(d?.length ? d : TIPOS_PAGO_DEF),
      error: () => this.tiposPago.set(TIPOS_PAGO_DEF),
    });
    this.catSvc.list('cuentasBancarias', { refresh: true }).subscribe({
      next: (d) => this.cuentasBancarias.set(d || []),
      error: () => this.cuentasBancarias.set([]),
    });

    effect(() => {
      const nd = this.store.numDoc();
      const _liq = this.store.liqTick();
      if (!nd) {
        this.lastRecargaNumDoc = null;
        this.liquidacion.set({ items: [], totales: { valor: 0, abonado: 0, saldo: 0 } });
        this.pagos.set([]);
        return;
      }
      const soloSync = this.lastRecargaNumDoc === nd && _liq > 0;
      this.lastRecargaNumDoc = nd;
      this.recargar(nd, { silencioso: soloSync });
    });

    this.route.queryParamMap.subscribe((q) => {
      const ing = q.get('ingreso')?.trim() || '';
      this.ingresoDestacado.set(ing || null);
    });
  }

  esIngresoDestacado(p: { _id?: unknown; id?: unknown }): boolean {
    const id = idIngreso(p);
    return !!id && id === this.ingresoDestacado();
  }

  private scrollIngresoDestacado() {
    const id = this.ingresoDestacado();
    if (!id) return;
    setTimeout(() => {
      const el = document.getElementById(`ingreso-row-${id}`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 120);
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

  cargarPreviewPago(): void {
    const idTipo = this.idTipoPago();
    const ids = this.itemsPago().map((i) => i.idLiquidacion);
    if (!idTipo || !ids.length) {
      this.extrasPagoPreview.set([]);
      return;
    }
    this.cfgServAdic.previewPago(idTipo, ids).subscribe({
      next: (r) => this.extrasPagoPreview.set(r.items || []),
      error: () => this.extrasPagoPreview.set([]),
    });
  }

  onTipoPagoChange(id: string) {
    this.idTipoPago.set(id);
    if (!id) {
      this.idCuentaBancaria.set('');
      this.quitarSoporte();
      this.extrasPagoPreview.set([]);
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
    if (match) {
      this.idCuentaBancaria.set(this.cuentaValor(match));
    }
    if (!this.requiereSoporte()) this.quitarSoporte();
    this.cargarPreviewPago();
  }

  onSoporteArchivo(file: File) {
    const ok = leerImagenSoporte(
      file,
      (dataUrl) => {
        this.archivoSoporte.set(file);
        this.previewSoporte.set(dataUrl);
      },
      (msg) => this.msg.set(msg),
    );
    if (!ok) this.quitarSoporte();
  }

  quitarSoporte() {
    this.archivoSoporte.set(null);
    this.previewSoporte.set(null);
  }

  tipoPagoSel(): Record<string, unknown> | undefined {
    const id = this.idTipoPago();
    return this.tiposPago().find((x) => this.tipoPagoValor(x) === id);
  }

  agregarItem(id: string) {
    if (!id) return;
    const it = this.liquidacion().items.find((i) => String(i._id) === String(id));
    if (!it) return;
    const idLiq = String(it._id);
    if (this.itemSeleccionado(idLiq)) return;
    const saldo = this.num(it.saldo);
    if (saldo <= 0.0001) return;
    this.itemsPago.update((arr) => [
      ...arr,
      { idLiquidacion: idLiq, descripcion: it.descripcion || '(sin descripción)', saldo, valor: saldo },
    ]);
    this.cargarPreviewPago();
  }

  trackItemPago(_index: number, it: ItemPagoSel): string {
    return it.idLiquidacion;
  }

  valorItemInput(it: ItemPagoSel): string {
    if (it.valorText != null) return it.valorText;
    if (!(it.valor > 0)) return '';
    return String(Math.round(it.valor));
  }

  quitarItem(idLiq: string) {
    this.itemsPago.update((arr) => arr.filter((x) => x.idLiquidacion !== idLiq));
    this.cargarPreviewPago();
  }

  itemEsVirtualEnPago(idLiq: string): boolean {
    const it = this.liquidacion().items.find((i) => String(i._id) === String(idLiq));
    return this.esVirtual(it);
  }

  setValorItem(idLiq: string, val: unknown) {
    if (this.itemEsVirtualEnPago(idLiq)) {
      this.pagarSaldoCompleto(idLiq);
      return;
    }
    const raw = String(val ?? '').replace(/[^\d]/g, '');
    const n = raw === '' ? 0 : Number(raw);
    this.itemsPago.update((arr) =>
      arr.map((x) => {
        if (x.idLiquidacion !== idLiq) return x;
        const valor = raw === '' ? 0 : Math.max(0, Math.min(n, x.saldo));
        return { ...x, valor, valorText: raw };
      }),
    );
  }

  blurValorItem(idLiq: string) {
    this.itemsPago.update((arr) =>
      arr.map((x) => {
        if (x.idLiquidacion !== idLiq) return x;
        const { valorText, ...rest } = x;
        return rest;
      }),
    );
  }

  pagarSaldoCompleto(idLiq: string) {
    this.itemsPago.update((arr) =>
      arr.map((x) =>
        x.idLiquidacion === idLiq ? { ...x, valor: x.saldo, valorText: undefined } : x,
      ),
    );
  }

  agregarTodosPendientes() {
    for (const it of this.itemsConSaldo()) {
      if (!this.itemSeleccionado(String(it._id))) {
        this.agregarItem(String(it._id));
      }
    }
    this.cargarPreviewPago();
  }

  limpiarItemsPago() {
    this.itemsPago.set([]);
    this.extrasPagoPreview.set([]);
  }

  seleccionarTipoPagoRapido(id: string) {
    this.onTipoPagoChange(id);
  }

  tipoPagoActivo(id: string): boolean {
    return this.idTipoPago() === id;
  }

  puedeRegistrar(): boolean {
    if (
      !(
        this.itemsPago().length > 0 &&
        !!this.idTipoPago() &&
        this.totalPago() > 0 &&
        (!this.requiereCuentaEmpresa() || !!this.idCuentaBancaria())
      )
    ) {
      return false;
    }
    return pagoIntangibleCompleto(this.inputPagoIntangible());
  }

  onItemLiquidacionPick(opt: EnumBuscarOption): void {
    this.agregarItem(String(opt.value));
  }

  onItemLiquidacionLimpiar(): void {
    /* combo de tipo "agregar": no mantiene selección */
  }

  onTipoPagoPick(opt: EnumBuscarOption): void {
    this.onTipoPagoChange(String(opt.value));
  }

  onTipoPagoLimpiar(): void {
    this.onTipoPagoChange('');
  }

  onCuentaBancariaPick(opt: EnumBuscarOption): void {
    this.idCuentaBancaria.set(String(opt.value));
  }

  onCuentaBancariaLimpiar(): void {
    this.idCuentaBancaria.set('');
  }

  alumnoNombre(): string {
    const a: any = this.store.alumno?.();
    if (!a) return '';
    return [a.nombre1, a.nombre2, a.apellido1, a.apellido2].filter(Boolean).join(' ').trim();
  }

  abrirFactura(): void {
    if (!this.store.numDoc()) {
      this.msg.set('Seleccione un alumno primero.');
      return;
    }
    this.mostrarFactura.set(true);
  }

  cerrarFactura(): void {
    this.mostrarFactura.set(false);
  }

  onFacturaEmitida(): void {
    const nd = this.store.numDoc();
    if (nd) this.recargar(nd, { notificar: true });
  }

  toggleDetalleFactura(id: string): void {
    this.facturaDetalleAbierto.update((cur) => (cur === id ? null : id));
  }

  labelAdquirente(f: FacturaElectronicaItem): string {
    const tipo = String(f.adquirente?.tipo || 'alumno');
    const nombre = String(f.adquirente?.nombre || '').trim();
    if (tipo === 'cliente') return nombre || 'Empresa / tercero';
    return nombre || 'Alumno';
  }

  esFacturaAEmpresa(f: FacturaElectronicaItem): boolean {
    return String(f.adquirente?.tipo || '') === 'cliente';
  }

  resumenItemsFactura(f: FacturaElectronicaItem): string {
    const items = (f.items || []).map((it) => String(it.descripcion || '').trim()).filter(Boolean);
    if (!items.length) return '—';
    if (this.esFacturaAEmpresa(f) && items.length > 1) {
      return `${items.length} capacitaciones (1 ítem en factura)`;
    }
    if (items.length <= 2) return items.join(' · ');
    return `${items.slice(0, 2).join(' · ')} (+${items.length - 2})`;
  }

  participanteFactura(f: FacturaElectronicaItem): string | null {
    if (!this.esFacturaAEmpresa(f)) return null;
    const nombre = String(f.adquirente?.participanteNombre || '').trim();
    const doc = f.adquirente?.participanteNumDoc;
    if (nombre && doc) return `${nombre} (CC ${doc})`;
    if (nombre) return nombre;
    return null;
  }

  labelEstadoFactura(f: FacturaElectronicaItem): string {
    const e = String(f.estado || '');
    if (e === 'anulada') return 'Anulada';
    if (f.modoDesarrollo) return 'Desarrollo';
    if (e === 'validada') return 'Validada DIAN';
    if (e === 'rechazada') return 'Rechazada';
    if (e === 'pendiente_envio') return 'Pendiente DIAN';
    return e || '—';
  }

  claseEstadoFactura(f: FacturaElectronicaItem): string {
    const e = String(f.estado || '').toLowerCase();
    if (e === 'anulada' || e === 'rechazada') return 'badge err';
    if (f.modoDesarrollo) return 'badge warn';
    if (e === 'validada') return 'badge ok';
    if (e === 'pendiente_envio') return 'badge info';
    return 'badge';
  }

  verFacturaEmitida(f: FacturaElectronicaItem): void {
    this.feSvc.verFactura(f, (m) => this.msg.set(m));
  }

  imprimirFacturaEmitida(f: FacturaElectronicaItem): void {
    this.feSvc.abrirHtmlFactura(f._id, (m) => this.msg.set(m));
  }

  private cargarFacturas(numDoc: number | string): void {
    this.loadingFacturas.set(true);
    this.msgFacturas.set(null);
    this.feSvc.listarPorAlumno(numDoc).subscribe({
      next: (rows) => {
        this.facturasEmitidas.set(rows || []);
        this.loadingFacturas.set(false);
      },
      error: (e) => {
        this.facturasEmitidas.set([]);
        this.loadingFacturas.set(false);
        const status = e?.status ?? e?.error?.status;
        this.msgFacturas.set(
          status === 403
            ? 'Sin permiso para consultar facturas de este alumno.'
            : e?.error?.message || 'No se pudieron cargar las facturas emitidas.',
        );
      },
    });
  }

  recargar(numDoc: number | string, opts: { notificar?: boolean; silencioso?: boolean } = {}) {
    const { notificar = false, silencioso = false } = opts;
    this.cargarFacturas(numDoc);
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
        // Sincroniza saldos/limpia ítems ya pagados de la selección pendiente.
        this.itemsPago.update((arr) =>
          arr
            .map((sel) => {
              const it = r.items.find((i) => String(i._id) === String(sel.idLiquidacion));
              if (!it) return null;
              const saldo = this.num(it.saldo);
              if (saldo <= 0.0001) return null;
              return { ...sel, saldo, valor: Math.min(sel.valor, saldo) };
            })
            .filter((x): x is ItemPagoSel => x !== null),
        );
        done();
      },
      error: () => done(),
    });
    this.ingSvc.listarPorAlumno(numDoc).subscribe({
      next: (r) => {
        this.pagos.set(r || []);
        if (!silencioso) this.loading.set(false);
        this.scrollIngresoDestacado();
        done();
      },
      error: (e) => {
        this.pagos.set([]);
        if (!silencioso) this.loading.set(false);
        this.msg.set(e?.error?.message || 'No se pudo cargar el historial de pagos.');
        done();
      },
    });
  }

  async registrar(): Promise<void> {
    const nd = this.store.numDoc();
    if (!nd) {
      this.msg.set('Selecciona un alumno primero.');
      return;
    }
    if (!(await this.cajaAlert.ensureAbierta('registrar cobros del alumno'))) return;
    const items = this.itemsPago();
    if (!items.length) {
      this.msg.set('Agregue al menos un ítem a pagar.');
      return;
    }
    for (const it of items) {
      if (!(it.valor > 0)) {
        this.msg.set(`Valor inválido en «${it.descripcion}».`);
        return;
      }
      if (it.valor > it.saldo + 0.0001) {
        this.msg.set(`El valor de «${it.descripcion}» excede su saldo.`);
        return;
      }
    }
    if (!this.idTipoPago()) {
      this.msg.set('Selecciona el tipo de pago.');
      return;
    }
    if (this.requiereCuentaEmpresa() && !this.idCuentaBancaria()) {
      this.msg.set('Selecciona la cuenta bancaria de la empresa donde ingresa el pago.');
      return;
    }
    const intangible = validarPagoIntangible(this.inputPagoIntangible());
    if (!intangible.ok) {
      this.msg.set(intangible.message);
      return;
    }
    if (!this.puedeRegistrar()) {
      this.msg.set(this.mensajePagoIntangible() || 'Complete los datos del pago antes de continuar.');
      return;
    }
    this.saving.set(true);
    this.msg.set(null);
    this.ingSvc
      .crear(
        {
          numDoc: nd,
          items: items.map((i) => ({ idLiquidacion: i.idLiquidacion, valor: i.valor })),
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
          this.itemsPago.set([]);
          this.idCuentaBancaria.set('');
          this.numComprobante.set('');
          this.quitarSoporte();
          this.observaciones.set('');
          this.recargar(nd, { notificar: true });
          this.alertaPagoSvc.cargar().subscribe();
          const id = ing?._id || ing?.id;
          const certs: { _id?: string; codigoCert?: string }[] =
            ing?.certificadosAuto?.length
              ? ing.certificadosAuto
              : ing?.certificadoAuto
                ? [ing.certificadoAuto]
                : [];
          this.msg.set(
            id
              ? certs.length
                ? `Pago registrado (${ing.numRecibo || ''}). Se ${
                    certs.length > 1 ? 'generaron' : 'generó'
                  } ${certs.length} certificado(s) automáticamente.`
                : `Pago registrado (${ing.numRecibo || ''}). Puede imprimir el recibo.`
              : 'Pago registrado correctamente.',
          );
          if (id) {
            this.comprobanteAlertSvc.notificarDesdeIngreso({ ...ing, _id: id }, {
              numDoc: nd,
              nombreCompleto: this.store.nombreCompleto() ?? undefined,
              alumnoId: this.store.alumno()?._id ? String(this.store.alumno()!._id) : undefined,
            });
            void this.flujoPostPago(ing, certs);
          }
        },
        error: (e) => {
          this.saving.set(false);
          this.msg.set(e?.error?.message || 'Error al registrar pago.');
        },
      });
  }

  imprimirRecibo(ing: { _id?: unknown; id?: unknown }) {
    const id = idIngreso(ing);
    if (!id) {
      this.msg.set('No se puede imprimir: comprobante sin ID.');
      return;
    }
    this.reciboSvc.abrirHtml(id, (m) => this.msg.set(m));
  }

  verRecibo(ing: { _id?: unknown; id?: unknown }) {
    const id = idIngreso(ing);
    if (!id) return;
    const url = this.router.serializeUrl(this.router.createUrlTree(['/recibo', id]));
    const w = window.open(url, '_blank', 'width=420,height=720');
    if (!w) this.msg.set('Permita ventanas emergentes para ver el comprobante.');
  }

  private async flujoPostPago(
    ing: { _id?: unknown; id?: unknown; numRecibo?: string },
    certs: { _id?: string; codigoCert?: string }[] = [],
  ) {
    await this.preguntarImprimirRecibo(ing);
    for (const cert of certs) {
      if (cert?._id) await this.preguntarImprimirCertificado(cert);
    }
  }

  private async preguntarImprimirRecibo(ing: { _id?: unknown; id?: unknown; numRecibo?: string }) {
    const num = ing.numRecibo ? ` (${ing.numRecibo})` : '';
    const ok = await this.confirmSvc.open({
      title: '¿Imprimir comprobante?',
      message: `El pago se registró correctamente${num}. ¿Desea imprimir el comprobante de ingreso ahora?`,
      variant: 'primary',
      icon: 'print',
      confirmLabel: 'Sí, imprimir',
      cancelLabel: 'Ahora no',
    });
    if (ok) this.imprimirRecibo(ing);
  }

  private async preguntarImprimirCertificado(cert: { _id?: string; codigoCert?: string }) {
    if (!cert?._id) return;
    const cod = cert.codigoCert ? ` ${cert.codigoCert}` : '';
    const ok = await this.confirmSvc.open({
      title: 'Certificado generado',
      message: `Se generó automáticamente el certificado${cod} de este programa. ¿Desea abrirlo para imprimirlo ahora?`,
      variant: 'primary',
      icon: 'print',
      confirmLabel: 'Sí, abrir certificado',
      cancelLabel: 'Ahora no',
    });
    if (ok) this.certSvc.abrirHtml(cert._id, (m) => this.msg.set(m));
  }

  async reversar(p: any): Promise<void> {
    const nd = this.store.numDoc();
    if (!nd) return;
    if (!(await this.cajaAlert.ensureAbierta('reversar pagos del alumno'))) return;
    const ref = p.numRecibo ? ` «${p.numRecibo}»` : '';
    const ok = await this.confirmSvc.open({
      title: '¿Reversar este pago?',
      message: `Se anulará el comprobante${ref}. El saldo del servicio quedará disponible para volver a cobrarlo.`,
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
    this.ejecutarReversar(p, nd);
  }

  confirmarReversarConSupervisor() {
    const p = this.ingresoPendienteAnular();
    const nd = this.store.numDoc();
    if (!p || !nd) return;
    const u = this.authAdminUser().trim();
    const pw = this.authAdminPass();
    if (!u || !pw) {
      this.msg.set('Ingrese usuario y contraseña del administrador para anular el ingreso.');
      return;
    }
    this.ejecutarReversar(p, nd, { autorizadoUsername: u, autorizadoPassword: pw });
  }

  cancelarReversarSupervisor() {
    this.mostrarAuthAnular.set(false);
    this.ingresoPendienteAnular.set(null);
    this.authAdminUser.set('');
    this.authAdminPass.set('');
  }

  private ejecutarReversar(
    p: any,
    nd: number | string,
    auth?: { autorizadoUsername: string; autorizadoPassword: string },
  ) {
    this.ingSvc.eliminar(p._id, auth).subscribe({
      next: () => {
        this.mostrarAuthAnular.set(false);
        this.ingresoPendienteAnular.set(null);
        this.authAdminUser.set('');
        this.authAdminPass.set('');
        this.recargar(nd, { notificar: true });
        this.msg.set('Pago anulado. El servicio quedó habilitado para volver a cobrarlo.');
      },
      error: (e) => this.msg.set(e?.error?.message || 'Error reversando pago.'),
    });
  }

  esAnulado(p: { estado?: string; anulado?: boolean }): boolean {
    if (p?.anulado === true) return true;
    return String(p?.estado || '').trim().toUpperCase() === 'ANULADO';
  }

  esMigracion(p: { esMigracion?: boolean; origenMigracion?: boolean; tipoIngreso?: string; idTipoPago?: string }): boolean {
    if (p?.esMigracion === true || p?.origenMigracion === true) return true;
    const t = String(p?.tipoIngreso || p?.idTipoPago || '').toUpperCase();
    return t === 'MIGRACION';
  }

  tituloAnulado(p: { anuladoPor?: string; autorizadoPor?: string; anuladoEn?: string }): string {
    const partes: string[] = [];
    if (p?.anuladoPor) partes.push(`Anuló: ${p.anuladoPor}`);
    if (p?.autorizadoPor) partes.push(`Autorizó: ${p.autorizadoPor}`);
    if (p?.anuladoEn) partes.push(this.tiempoFmt(p.anuladoEn));
    return partes.join(' · ') || 'Comprobante anulado';
  }

  num(v: any): number {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return Number(v) || 0;
    if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
    return Number(v) || 0;
  }
  fmt(v: any): string {
    return this.num(v).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  }

  tiempoFmt(f?: string): string {
    if (!f) return '';
    const d = new Date(f);
    return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  }

  descrItem(it: LiquidacionItem): string {
    const d = it.descripcion || '(sin descripción)';
    return `${d} · saldo ${this.fmt(it.saldo)}`;
  }

  conceptoPago(p: {
    idLiquidacion?: string;
    liquidacionDescr?: string;
    detalle?: { descripcion?: string }[];
  }): string {
    if (p.detalle?.length) {
      const descrs = p.detalle.map((d) => d.descripcion).filter(Boolean);
      if (descrs.length) return descrs.join(', ');
    }
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
}
