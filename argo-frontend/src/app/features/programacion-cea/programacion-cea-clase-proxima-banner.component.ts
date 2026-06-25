import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { ProgramacionCeaClaseProximaAlertService } from '../../core/services/programacion-cea-clase-proxima-alert.service';
import { HeadAlarmListBannerComponent } from '../../shared/components/head-alarm-list-banner/head-alarm-list-banner.component';
import type { HeadAlarmListRow } from '../../shared/components/head-alarm-list-banner/head-alarm-list.types';

@Component({
  selector: 'argo-programacion-cea-clase-proxima-banner',
  standalone: true,
  imports: [CommonModule, HeadAlarmListBannerComponent],
  templateUrl: './programacion-cea-clase-proxima-banner.component.html',
  styleUrls: ['./programacion-cea-clase-proxima-banner.component.scss'],
})
export class ProgramacionCeaClaseProximaBannerComponent {
  private alertSvc = inject(ProgramacionCeaClaseProximaAlertService);

  visible = this.alertSvc.visible;
  total = this.alertSvc.total;

  titulo = computed(() => {
    const n = this.total();
    if (n <= 1) return 'Clase CEA próxima';
    return `${n} clases CEA próximas`;
  });

  rows = computed<HeadAlarmListRow[]>(() =>
    this.alertSvc.clases().map((c) => ({
      id: c._id,
      title: this.alertSvc.resumenClase(c),
      routerLink: ['/app/programacion-cea/clases-hoy'],
    })),
  );

  cerrar() {
    this.alertSvc.cerrar();
  }
}
