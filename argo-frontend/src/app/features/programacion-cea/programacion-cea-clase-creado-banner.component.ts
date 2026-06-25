import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { ProgramacionCeaClaseCreadoAlertService } from '../../core/services/programacion-cea-clase-creado-alert.service';
import { HeadAlarmListBannerComponent } from '../../shared/components/head-alarm-list-banner/head-alarm-list-banner.component';
import type { HeadAlarmListRow } from '../../shared/components/head-alarm-list-banner/head-alarm-list.types';

@Component({
  selector: 'argo-programacion-cea-clase-creado-banner',
  standalone: true,
  imports: [CommonModule, HeadAlarmListBannerComponent],
  templateUrl: './programacion-cea-clase-creado-banner.component.html',
  styleUrls: ['./programacion-cea-clase-creado-banner.component.scss'],
})
export class ProgramacionCeaClaseCreadoBannerComponent {
  private alertSvc = inject(ProgramacionCeaClaseCreadoAlertService);

  visible = this.alertSvc.visible;
  totalClases = this.alertSvc.totalClases;

  titulo = computed(() => {
    const n = this.totalClases();
    if (n <= 0) return 'Pendiente programar clase licencia';
    return n === 1
      ? 'Pendiente programar clase licencia (1 clase)'
      : `Pendiente programar clase licencia (${n} clases)`;
  });

  rows = computed<HeadAlarmListRow[]>(() =>
    this.alertSvc.items().map((it) => ({
      id: String(it.numDoc),
      title: this.alertSvc.tituloItem(it),
      routerLink: it.alumnoId ? ['/app/alumnos', it.alumnoId] : undefined,
      queryParams: it.alumnoId ? { tab: 'programacion' } : undefined,
    })),
  );

  cerrar() {
    this.alertSvc.cerrar();
  }
}
