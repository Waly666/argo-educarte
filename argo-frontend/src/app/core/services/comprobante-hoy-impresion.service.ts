import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { FacturacionService } from './facturacion.service';
import { ReciboService } from './recibo.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import type { ComprobanteHoyTipo } from './comprobante-hoy-alert.service';

/**
 * Abre comprobantes desde alarmas con el mismo patrón que facturas:
 * HTML del API en ventana nueva (imprimir / guardar PDF).
 */
@Injectable({ providedIn: 'root' })
export class ComprobanteHoyImpresionService {
  private reciboSvc = inject(ReciboService);
  private feSvc = inject(FacturacionService);
  private confirmSvc = inject(ConfirmDialogService);
  private router = inject(Router);

  abrir(tipo: ComprobanteHoyTipo, id: string, onError?: (msg: string) => void): void {
    if (!id) return;
    if (tipo === 'ingreso') {
      this.abrirIngreso(id, onError);
      return;
    }
    if (tipo === 'egreso') {
      this.abrirEgreso(id, onError);
      return;
    }
    this.abrirFactura(id, onError);
  }

  abrirIngreso(id: string, onError?: (msg: string) => void): void {
    const err = onError ?? ((msg) => this.mostrarError('Comprobante de ingreso', msg));
    if (!id) {
      err('Comprobante sin identificador.');
      return;
    }
    if (!this.reciboSvc.abrirHtml(id, err)) {
      this.abrirReciboEnPestana('/recibo', id);
    }
  }

  abrirEgreso(id: string, onError?: (msg: string) => void): void {
    const err = onError ?? ((msg) => this.mostrarError('Comprobante de egreso', msg));
    if (!id) {
      err('Comprobante sin identificador.');
      return;
    }
    if (!this.reciboSvc.abrirHtmlEgreso(id, err)) {
      this.abrirReciboEnPestana('/recibo-egreso', id);
    }
  }

  /** Si el popup fue bloqueado, abre la vista de recibo en nueva pestaña o en la actual. */
  private abrirReciboEnPestana(ruta: string, id: string): void {
    const url = `${ruta}/${encodeURIComponent(id)}`;
    const w = window.open(url, '_blank');
    if (!w) {
      void this.router.navigate([ruta, id]);
    }
  }

  abrirFactura(id: string, onError?: (msg: string) => void): void {
    const err = onError ?? ((msg) => this.mostrarError('Factura electrónica', msg));
    this.feSvc.obtener(id).subscribe({
      next: (f) => this.feSvc.verFactura(f, err),
      error: () => this.feSvc.abrirHtmlFactura(id, err),
    });
  }

  private mostrarError(titulo: string, msg: string): void {
    void this.confirmSvc.open({
      title: titulo,
      message: msg,
      variant: 'warn',
      hideCancel: true,
      confirmLabel: 'Entendido',
    });
  }
}
