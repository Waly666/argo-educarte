import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';

import { Component, OnInit, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';

import { Router, RouterLink } from '@angular/router';



import { AlumnoListItem, AlumnoService } from '../../core/services/alumno.service';

import { AuthService } from '../../core/services/auth.service';

import {

  CajaIngresoItem,

  CajaSesionService,

} from '../../core/services/caja-sesion.service';
import { resolverFormaPagoIngreso } from '../../core/utils/caja-forma-pago.util';

import { IngresoService } from '../../core/services/ingreso.service';

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

import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { CajaAperturaAlertService } from '../../core/services/caja-apertura-alert.service';



@Component({

  selector: 'argo-caja-ingresos-sesion',

  standalone: true,

  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, RouterLink],

  templateUrl: './caja-ingresos-sesion.component.html',

  styleUrls: ['./caja-movimientos.scss'],

})

export class CajaIngresosSesionComponent implements OnInit {

  private cajaSvc = inject(CajaSesionService);

  private alumnoSvc = inject(AlumnoService);

  private ingSvc = inject(IngresoService);

  private auth = inject(AuthService);

  private confirmSvc = inject(ConfirmDialogService);
  private cajaAlert = inject(CajaAperturaAlertService);

  private router = inject(Router);



  items = signal<CajaIngresoItem[]>([]);

  sesionId = signal<number | null>(null);

  cajaAbierta = signal(false);

  loading = signal(false);

  busqueda = signal('');

  resultados = signal<AlumnoListItem[]>([]);

  msg = signal<string | null>(null);
  msgError = signal(false);



  ingresoPendienteAnular = signal<CajaIngresoItem | null>(null);

  mostrarAuthAnular = signal(false);

  authAdminUser = signal('');

  authAdminPass = signal('');



  capFecha = capFecha;
  capRecibo = capRecibo;
  capDoc = capDoc;
  capConceptoCaja = capConceptoCaja;
  capFormaPago = capFormaPago;
  capTipoAbono = capTipoAbono;
  capCuentaBancaria = capCuentaBancaria;
  capValorIngreso = capValorIngreso;
  capTipoIngreso = capTipoIngreso;
  capBeneficiario = capBeneficiario;
  capRefComprobante = capRefComprobante;

  total = () => this.items().reduce((a, i) => a + (i.valor || 0), 0);

  formaPagoLabel(i: CajaIngresoItem): string {
    return resolverFormaPagoIngreso(i);
  }

  refComprobante(i: CajaIngresoItem): string {
    return String(i.numTransferencia || i.numComprobante || '').trim();
  }

  esPagoNoEfectivo(i: CajaIngresoItem): boolean {
    const txt = this.formaPagoLabel(i).toLowerCase();
    if (!txt || txt === '—') return !!(i.cuentaBancariaDescr || i.cuentaRecibe);
    return !txt.includes('efect') && txt !== 'ef';
  }

  muestraRefEnCuenta(i: CajaIngresoItem): boolean {
    return this.esPagoNoEfectivo(i) && !!this.refComprobante(i);
  }

  pagadorLabel(i: CajaIngresoItem): string {
    if (i.esIngresoCaja) return i.pagadorDescr || i.recibidoDe || 'Tercero';
    return i.numDoc != null ? String(i.numDoc) : '—';
  }

  conceptoLabel(i: CajaIngresoItem): string {
    if (i.esIngresoCaja) {
      return i.concepto || i.liquidacionDescr || '—';
    }
    return i.liquidacionDescr || '—';
  }

  tipoIngresoLabel(i: CajaIngresoItem): string {
    return i.tipoIngresoDescr || i.tipoIngreso || '—';
  }

  async nuevoIngresoCaja(): Promise<void> {
    if (!(await this.cajaAlert.ensureAbierta('registrar ingresos de caja'))) return;
    this.router.navigate(['/app/caja/ingresos/nuevo']);
  }



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

        this.cajaSvc.ingresosSesionActiva().subscribe({

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



  buscarAlumno(): void {

    const q = this.busqueda().trim();

    if (q.length < 2) return;

    this.alumnoSvc.listar({ q, limit: 8 }).subscribe({

      next: (r) => this.resultados.set(r.items || []),

    });

  }



  async cobrarAlumno(a: AlumnoListItem): Promise<void> {
    if (!(await this.cajaAlert.ensureAbierta('registrar cobros'))) return;
    this.router.navigate(['/app/cobros-pendientes'], { queryParams: { q: String(a.numDoc ?? '') } });
  }



  verRecibo(id: string): void {

    window.open(`/recibo/${id}`, '_blank');

  }



  async reversar(i: CajaIngresoItem): Promise<void> {

    if (!(await this.cajaAlert.ensureAbierta('reversar cobros'))) return;

    const ref = i.numRecibo ? ` «${i.numRecibo}»` : '';

    const ok = await this.confirmSvc.open({

      title: '¿Reversar este cobro?',

      message: `Se anulará el comprobante${ref} y se descontará el valor de la liquidación. Esta acción no se puede deshacer.`,

      variant: 'warn',

      icon: 'warning',

      confirmLabel: 'Sí, reversar',

    });

    if (!ok) return;

    if (!this.auth.isAdmin()) {

      this.ingresoPendienteAnular.set(i);

      this.authAdminUser.set('');

      this.authAdminPass.set('');

      this.mostrarAuthAnular.set(true);

      return;

    }

    this.ejecutarReversar(i);

  }



  confirmarReversarConSupervisor(): void {

    const i = this.ingresoPendienteAnular();

    if (!i) return;

    const u = this.authAdminUser().trim();

    const pw = this.authAdminPass();

    if (!u || !pw) {

      this.inform('Ingrese usuario y contraseña del administrador para anular el ingreso.');

      return;

    }

    this.ejecutarReversar(i, { autorizadoUsername: u, autorizadoPassword: pw });

  }



  cancelarReversarSupervisor(): void {

    this.mostrarAuthAnular.set(false);

    this.ingresoPendienteAnular.set(null);

    this.authAdminUser.set('');

    this.authAdminPass.set('');

  }



  private ejecutarReversar(

    i: CajaIngresoItem,

    auth?: { autorizadoUsername: string; autorizadoPassword: string },

  ): void {

    this.ingSvc.eliminar(i._id, auth).subscribe({

      next: () => {

        this.mostrarAuthAnular.set(false);

        this.ingresoPendienteAnular.set(null);

        this.authAdminUser.set('');

        this.authAdminPass.set('');

        this.inform('Cobro reversado.');

        this.cargar();

      },

      error: (e) => this.inform(e?.error?.message || 'Error reversando cobro.'),

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
