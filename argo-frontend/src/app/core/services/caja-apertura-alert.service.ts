import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';

import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { AlarmaService } from './alarma.service';
import { CajaSesionService } from './caja-sesion.service';

@Injectable({ providedIn: 'root' })
export class CajaAperturaAlertService {
  private cajaSvc = inject(CajaSesionService);
  private confirm = inject(ConfirmDialogService);
  private router = inject(Router);
  private alarmas = inject(AlarmaService);

  /** true si la caja está abierta; si no, muestra aviso (si el rol lo tiene) y devuelve false. */
  async ensureAbierta(accion = 'registrar movimientos de caja'): Promise<boolean> {
    const abierta = await firstValueFrom(this.cajaSvc.activa().pipe(map((r) => !!r.abierta)));
    if (abierta) return true;
    if (this.alarmas.tiene('alarmas.caja.sin_abrir')) {
      await this.mostrarAviso(accion);
    }
    return false;
  }

  async mostrarAviso(accion = 'registrar movimientos de caja'): Promise<void> {
    if (!this.alarmas.tiene('alarmas.caja.sin_abrir')) return;
    const ir = await this.confirm.open({
      title: 'Caja cerrada',
      message: `Debe abrir su caja antes de ${accion}.\n\nVaya a Resumen del día y pulse «Abrir caja» para iniciar su turno.`,
      variant: 'warn',
      icon: 'warning',
      confirmLabel: 'Ir a abrir caja',
      cancelLabel: 'Entendido',
    });
    if (ir) {
      await this.router.navigate(['/app/caja'], { queryParams: { abrir: 1 } });
    }
  }
}
