import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { CajaEgresoItem, CajaSesionService } from '../../core/services/caja-sesion.service';
import { EgresoService } from '../../core/services/egreso.service';
import {
  capBeneficiario,
  capConceptoCaja,
  capFecha,
  capFormaPago,
  capRecibo,
  capTipoEgreso,
  capValorEgreso,
} from '../../core/utils/capsule.util';
import {
  tieneSoporteEgreso,
  tituloSoporteEgreso,
} from '../../core/utils/egreso-soporte.helpers';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { CajaAperturaAlertService } from '../../core/services/caja-apertura-alert.service';
import { ReciboService } from '../../core/services/recibo.service';

@Component({
  selector: 'argo-caja-egresos-sesion',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './caja-egresos-sesion.component.html',
  styleUrls: ['./caja-movimientos.scss'],
})
export class CajaEgresosSesionComponent implements OnInit {
  private cajaSvc = inject(CajaSesionService);
  private egresoSvc = inject(EgresoService);
  private auth = inject(AuthService);
  private confirm = inject(ConfirmDialogService);
  private cajaAlert = inject(CajaAperturaAlertService);
  private router = inject(Router);
  private reciboSvc = inject(ReciboService);

  items = signal<CajaEgresoItem[]>([]);
  sesionId = signal<number | null>(null);
  cajaAbierta = signal(false);
  loading = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);

  egresoPendienteAnular = signal<CajaEgresoItem | null>(null);
  mostrarAuthAnular = signal(false);
  authAdminUser = signal('');
  authAdminPass = signal('');

  capFecha = capFecha;
  capRecibo = capRecibo;
  capBeneficiario = capBeneficiario;
  capConceptoCaja = capConceptoCaja;
  capTipoEgreso = capTipoEgreso;
  capFormaPago = capFormaPago;
  capValorEgreso = capValorEgreso;

  total = () => this.items().reduce((a, e) => a + (e.valorEgreso || 0), 0);

  sinSoporte = () => this.items().filter((e) => !tieneSoporteEgreso(e));

  cantSinSoporte = () => this.sinSoporte().length;

  tieneSoporte = tieneSoporteEgreso;

  tituloSoporte = tituloSoporteEgreso;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.cajaSvc.activa().subscribe({
      next: (r) => {
        this.cajaAbierta.set(!!r.abierta);
        this.sesionId.set(r.sesion?.idSesion ?? null);
        if (!r.abierta) {
          this.items.set([]);
          this.loading.set(false);
          return;
        }
        this.cajaSvc.egresosSesionActiva().subscribe({
          next: (rows) => {
            this.items.set(rows || []);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
  }

  puedeGestionar(e: CajaEgresoItem): boolean {
    if (this.auth.isAdmin()) return true;
    if (!this.cajaAbierta() || this.sesionId() == null) return false;
    if (e.idSesion == null) return false;
    return Number(e.idSesion) === Number(this.sesionId());
  }

  async nuevoEgreso(): Promise<void> {
    if (!(await this.cajaAlert.ensureAbierta('registrar egresos'))) return;
    this.router.navigate(['/app/caja/egresos/nuevo']);
  }

  editarEgreso(e: CajaEgresoItem): void {
    if (!this.puedeGestionar(e)) {
      this.inform('Solo puede editar egresos de su sesión de caja actual.');
      return;
    }
    this.router.navigate(['/app/caja/egresos/editar', e.idEgreso]);
  }

  verRecibo(id: string): void {
    this.reciboSvc.abrirHtmlEgreso(id, (m) => this.inform(m));
  }

  onAlarmaSoporte(e: CajaEgresoItem, ev?: Event): void {
    ev?.stopPropagation();
    if (this.puedeGestionar(e)) {
      this.editarEgreso(e);
      this.inform('Adjunte el soporte (imagen) en el formulario y guarde.');
      return;
    }
    this.inform('Solicite a un administrador que adjunte el comprobante.');
  }

  async anularEgreso(e: CajaEgresoItem): Promise<void> {
    if (!this.puedeGestionar(e)) {
      this.inform('Solo puede anular egresos de su sesión de caja actual.');
      return;
    }
    const ok = await this.confirm.open({
      title: 'Anular egreso',
      message: `¿Anular el egreso a ${e.pagueA || e.concepto}?`,
      confirmLabel: 'Anular',
      variant: 'danger',
    });
    if (!ok) return;
    if (!this.auth.isAdmin()) {
      this.egresoPendienteAnular.set(e);
      this.authAdminUser.set('');
      this.authAdminPass.set('');
      this.mostrarAuthAnular.set(true);
      return;
    }
    this.ejecutarAnular(e);
  }

  confirmarAnularConSupervisor(): void {
    const e = this.egresoPendienteAnular();
    if (!e) return;
    const u = this.authAdminUser().trim();
    const p = this.authAdminPass();
    if (!u || !p) {
      this.inform('Ingrese usuario y contraseña del administrador para anular.');
      return;
    }
    this.ejecutarAnular(e, { autorizadoUsername: u, autorizadoPassword: p });
  }

  cancelarAnularSupervisor(): void {
    this.mostrarAuthAnular.set(false);
    this.egresoPendienteAnular.set(null);
    this.authAdminUser.set('');
    this.authAdminPass.set('');
  }

  private ejecutarAnular(
    e: CajaEgresoItem,
    auth?: { autorizadoUsername: string; autorizadoPassword: string },
  ): void {
    this.egresoSvc.eliminar(e.idEgreso, auth).subscribe({
      next: () => {
        this.mostrarAuthAnular.set(false);
        this.egresoPendienteAnular.set(null);
        this.authAdminUser.set('');
        this.authAdminPass.set('');
        this.inform('Egreso anulado.');
        this.cargar();
      },
      error: (err) => this.inform(err?.error?.message || 'No se pudo anular'),
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
