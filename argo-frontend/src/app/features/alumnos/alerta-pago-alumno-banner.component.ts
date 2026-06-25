import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AlarmaService } from '../../core/services/alarma.service';
import {
  AlertaPagoAlumnoItem,
  AlertaPagoAlumnoService,
} from '../../core/services/alerta-pago-alumno.service';
import { formatNumDoc } from '../../core/utils/num-doc.helpers';
import { HeadAlarmListBannerComponent } from '../../shared/components/head-alarm-list-banner/head-alarm-list-banner.component';
import type { HeadAlarmListRow } from '../../shared/components/head-alarm-list-banner/head-alarm-list.types';

@Component({
  selector: 'argo-alerta-pago-alumno-banner',
  standalone: true,
  imports: [CommonModule, HeadAlarmListBannerComponent],
  templateUrl: './alerta-pago-alumno-banner.component.html',
  styleUrls: ['./alerta-pago-alumno-banner.component.scss'],
})
export class AlertaPagoAlumnoBannerComponent {
  svc = inject(AlertaPagoAlumnoService);
  private alarmas = inject(AlarmaService);

  modo = input<'inline' | 'panel'>('inline');

  visible = computed(
    () => this.alarmas.tiene('alarmas.caja.alerta_pago') && this.svc.visibleBanner(),
  );

  rows = computed<HeadAlarmListRow[]>(() =>
    this.svc.items().map((item) => ({
      id: item.alumnoId,
      title: item.nombreCompleto,
      meta: this.metaItem(item),
      routerLink: ['/app/alumnos', item.alumnoId],
      queryParams: { tab: 'pagos' },
    })),
  );

  cerrar() {
    this.svc.cerrar();
  }

  private metaItem(item: AlertaPagoAlumnoItem): string {
    const parts = [`Doc. ${formatNumDoc(item.numDoc)}`, this.svc.etiquetaFrecuencia(item.alertaPagoFrecuencia)];
    if (item.celular) parts.push(item.celular);
    return parts.join(' · ');
  }
}
