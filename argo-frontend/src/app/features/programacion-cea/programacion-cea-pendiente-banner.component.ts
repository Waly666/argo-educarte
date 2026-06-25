import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { ProgramacionCeaPendienteAlertService } from '../../core/services/programacion-cea-pendiente-alert.service';
import { trackFilaRastreoCea } from '../../core/services/programacion-cea.service';
import { HeadAlarmListBannerComponent } from '../../shared/components/head-alarm-list-banner/head-alarm-list-banner.component';
import type { HeadAlarmListRow } from '../../shared/components/head-alarm-list-banner/head-alarm-list.types';

@Component({
  selector: 'argo-programacion-cea-pendiente-banner',
  standalone: true,
  imports: [CommonModule, HeadAlarmListBannerComponent],
  templateUrl: './programacion-cea-pendiente-banner.component.html',
  styleUrls: ['./programacion-cea-pendiente-banner.component.scss'],
})
export class ProgramacionCeaPendienteBannerComponent {
  private alertSvc = inject(ProgramacionCeaPendienteAlertService);

  visible = this.alertSvc.visible;
  total = this.alertSvc.total;

  titulo = computed(() => {
    const n = this.total();
    return n === 1
      ? '1 servicio sin programar'
      : `${n} servicios/alumnos con horas sin programar`;
  });

  rows = computed<HeadAlarmListRow[]>(() =>
    this.alertSvc.items().map((f) => ({
      id: trackFilaRastreoCea(f),
      title: f.alumnoNombre || `Doc ${f.numDoc}`,
      meta: this.alertSvc.resumenItem(f),
      routerLink: ['/app/programacion-cea'],
      queryParams: { tab: 'pendientes' },
    })),
  );

  cerrar() {
    this.alertSvc.cerrar();
  }
}
