import { CommonModule } from '@angular/common';
import { Component, Input, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { CajaEstadoService } from '../../core/services/caja-estado.service';
import { HeadAlarmListBannerComponent } from '../../shared/components/head-alarm-list-banner/head-alarm-list-banner.component';
import type { HeadAlarmListRow } from '../../shared/components/head-alarm-list-banner/head-alarm-list.types';

@Component({
  selector: 'argo-caja-cerrada-banner',
  standalone: true,
  imports: [CommonModule, HeadAlarmListBannerComponent],
  templateUrl: './caja-cerrada-banner.component.html',
  styleUrls: ['./caja-cerrada-banner.component.scss'],
})
export class CajaCerradaBannerComponent {
  private router = inject(Router);
  private cajaEstado = inject(CajaEstadoService);

  @Input() blink = false;

  visible = computed(
    () =>
      !this.cajaEstado.loading() &&
      this.cajaEstado.abierta() === false &&
      this.cajaEstado.mostrarBannerCerrada(),
  );

  rows = computed<HeadAlarmListRow[]>(() => [
    {
      id: 'abrir-caja',
      title: 'Abrir caja',
      meta: 'La caja está cerrada. Pulse para abrirla.',
    },
  ]);

  onItemClick(_row: HeadAlarmListRow) {
    this.irAbrirCaja();
  }

  cerrar() {
    this.cajaEstado.cerrarBannerCerrada();
  }

  private irAbrirCaja(): void {
    void this.router.navigate(['/app/caja'], { queryParams: { abrir: 1 } });
  }
}
