import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ArgoDateInputComponent } from '../../shared/argo-date-input/argo-date-input.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ConfigService } from '../../core/services/config.service';
import { IngresoService } from '../../core/services/ingreso.service';
import { ReciboService, idIngreso } from '../../core/services/recibo.service';
import { CajaSesionService } from '../../core/services/caja-sesion.service';
import {
  capConceptoCaja,
  capCuentaBancaria,
  capDoc,
  capFecha,
  capFormaPago,
  capRecibo,
  capTipoAbono,
  capTipoIngreso,
  capValorIngreso,
  capBeneficiario,
  capRefComprobante,
} from '../../core/utils/capsule.util';
import { readVistaLista, saveVistaLista, VistaLista } from '../../core/utils/vista-lista.helpers';
import { resolverFormaPagoIngreso } from '../../core/utils/caja-forma-pago.util';
import { CajaDescuadresBannerComponent } from './caja-descuadres-banner.component';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { abrirUrlSoporte, tieneSoporteAdjunto } from '../../core/utils/pago-soporte.helpers';

@Component({
  selector: 'argo-caja-ingresos-todos',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, CajaDescuadresBannerComponent,
    ArgoDateInputComponent,
  ],
  templateUrl: './caja-ingresos-todos.component.html',
  styleUrls: ['./caja-listados-admin.scss'],
})
export class CajaIngresosTodosComponent implements OnInit {
  private ingSvc = inject(IngresoService);
  private reciboSvc = inject(ReciboService);
  private configSvc = inject(ConfigService);
  private cajaSvc = inject(CajaSesionService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private confirm = inject(ConfirmDialogService);

  private readonly vistaKey = 'argo-caja-ingresos-todos-vista';

  vista = signal<VistaLista>(readVistaLista(this.vistaKey));
  items = signal<any[]>([]);
  total = signal(0);
  totalValor = signal(0);
  loading = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);

  q = signal('');
  numDoc = signal('');
  desde = signal('');
  hasta = signal('');
  idSesion = signal('');

  sesionAbiertaId = signal<number | null>(null);
  mostrarAuthAnular = signal(false);
  authAdminUser = signal('');
  authAdminPass = signal('');
  ingresoPendienteAnular = signal<any | null>(null);

  capFecha = capFecha;
  capRecibo = capRecibo;
  capDoc = capDoc;
  capTipoIngreso = capTipoIngreso;
  capTipoAbono = capTipoAbono;
  capConceptoCaja = capConceptoCaja;
  capFormaPago = capFormaPago;
  capCuentaBancaria = capCuentaBancaria;
  capValorIngreso = capValorIngreso;
  capBeneficiario = capBeneficiario;
  capRefComprobante = capRefComprobante;

  ngOnInit(): void {
    this.configSvc.obtenerReciboEncabezado().subscribe({
      next: (c) => this.reciboSvc.registrarFormatoIngreso(c.formatoComprobanteIngreso),
      error: () => undefined,
    });
    this.cajaSvc.activa().subscribe({
      next: (r) => this.sesionAbiertaId.set(r.sesion?.idSesion ?? null),
      error: () => this.sesionAbiertaId.set(null),
    });
    this.route.queryParamMap.subscribe((p) => {
      const sid = p.get('idSesion');
      if (sid) this.idSesion.set(sid);
      this.cargar();
    });
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

  private fetchPaginas(skip: number, acumulado: any[]): void {
    const sid = this.idSesion().trim();
    this.ingSvc
      .listarTodosAdmin({
        q: this.q().trim() || undefined,
        numDoc: this.numDoc().trim() || undefined,
        desde: this.desde() || undefined,
        hasta: this.hasta() || undefined,
        idSesion: sid ? Number(sid) : undefined,
        skip,
        limit: 500,
      })
      .subscribe({
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
          this.totalValor.set(r.totalValor || merged.reduce((a, i) => a + Number(i.valor || 0), 0));
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          this.inform(e?.error?.message || 'Error cargando ingresos.');
        },
      });
  }

  limpiarFiltros(): void {
    this.q.set('');
    this.numDoc.set('');
    this.desde.set('');
    this.hasta.set('');
    this.idSesion.set('');
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    this.cargar();
  }

  pagadorLabel(i: any): string {
    if (i.esIngresoCaja) return i.pagadorDescr || i.recibidoDe || 'Tercero';
    return i.alumnoNombre || i.pagadorDescr || (i.numDoc != null ? String(i.numDoc) : '—');
  }

  conceptoLabel(i: any): string {
    return i.conceptoLabel || i.liquidacionDescr || i.concepto || '—';
  }

  conceptoCorto(i: any, max = 24): string {
    const full = this.conceptoLabel(i);
    if (full === '—' || full.length <= max) return full;
    return `${full.slice(0, max - 1).trimEnd()}…`;
  }

  formaPagoLabel(i: any): string {
    return resolverFormaPagoIngreso(i);
  }

  refComprobante(i: any): string {
    return String(i.numTransferencia || i.numComprobante || '').trim();
  }

  tieneSoporte = tieneSoporteAdjunto;

  urlSoporte(i: { urlSoporte?: string | null }): string | null {
    return this.ingSvc.urlArchivo(i.urlSoporte);
  }

  abrirSoporte(i: { urlSoporte?: string | null }): void {
    abrirUrlSoporte(this.urlSoporte(i), (m) => this.inform(m));
  }

  irAlCierre(idSesion: number | null | undefined): void {
    if (!idSesion) return;
    this.router.navigate(['/app/cierres', idSesion]);
  }

  filtrarPorSesion(idSesion: number | null | undefined): void {
    if (!idSesion) return;
    this.idSesion.set(String(idSesion));
    this.router.navigate([], { relativeTo: this.route, queryParams: { idSesion } });
    this.cargar();
  }

  verRecibo(ing: { _id?: unknown }): void {
    this.abrirComprobanteIngreso(ing);
  }

  imprimirRecibo(ing: { _id?: unknown }): void {
    this.abrirComprobanteIngreso(ing);
  }

  private abrirComprobanteIngreso(ing: { _id?: unknown }): void {
    const id = idIngreso(ing);
    if (!id) return;
    if (!this.reciboSvc.abrirHtml(id, (m) => this.inform(m))) {
      this.inform('Permita ventanas emergentes para ver o imprimir el comprobante.', true);
    }
  }

  requiereAuthSupervisor(ing: { idSesion?: number | null }): boolean {
    const abierta = this.sesionAbiertaId();
    if (abierta == null) return true;
    if (ing.idSesion == null) return true;
    return Number(ing.idSesion) !== Number(abierta);
  }

  async anularIngreso(ing: { _id?: unknown; numRecibo?: string; idSesion?: number | null }): Promise<void> {
    const id = idIngreso(ing);
    if (!id) return;
    const ok = await this.confirm.open({
      title: 'Anular ingreso',
      message: `¿Anular el ingreso ${ing.numRecibo || id}? Si pertenece a un cierre con descuadre, recalcule el cuadre desde el detalle del cierre.`,
      confirmLabel: 'Anular',
      variant: 'danger',
    });
    if (!ok) return;

    if (this.requiereAuthSupervisor(ing)) {
      this.ingresoPendienteAnular.set(ing);
      this.authAdminUser.set('');
      this.authAdminPass.set('');
      this.mostrarAuthAnular.set(true);
      return;
    }
    this.ejecutarAnularIngreso(ing);
  }

  confirmarAnularSupervisor(): void {
    const ing = this.ingresoPendienteAnular();
    if (!ing) return;
    const u = this.authAdminUser().trim();
    const p = this.authAdminPass();
    if (!u || !p) {
      this.inform('Ingrese usuario y contraseña de un administrador');
      return;
    }
    this.ejecutarAnularIngreso(ing, { autorizadoUsername: u, autorizadoPassword: p });
  }

  cancelarAnularSupervisor(): void {
    this.mostrarAuthAnular.set(false);
    this.ingresoPendienteAnular.set(null);
    this.authAdminUser.set('');
    this.authAdminPass.set('');
  }

  private ejecutarAnularIngreso(
    ing: { _id?: unknown; numRecibo?: string },
    auth?: { autorizadoUsername: string; autorizadoPassword: string },
  ): void {
    const id = idIngreso(ing);
    if (!id) return;
    this.ingSvc.eliminar(id, auth).subscribe({
      next: () => {
        this.cancelarAnularSupervisor();
        this.inform('Ingreso anulado');
        this.cargar();
      },
      error: (e) => {
        if (e?.error?.code === 'SUPERVISOR_AUTH_REQUIRED') {
          this.mostrarAuthAnular.set(true);
        }
        this.inform(e?.error?.message || 'No se pudo anular');
      },
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
        t.includes('adjunte') ||
        t.includes('verifique');
    }
    this.msgError.set(err);
  }

}
