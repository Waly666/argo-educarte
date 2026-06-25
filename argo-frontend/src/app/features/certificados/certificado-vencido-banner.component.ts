import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { CertificadoVencidoAlertService } from '../../core/services/certificado-vencido-alert.service';
import type { CertificadoVencimientoAlertaItem } from '../../core/services/certificado.service';
import { HeadAlarmListBannerComponent } from '../../shared/components/head-alarm-list-banner/head-alarm-list-banner.component';
import type { HeadAlarmListRow } from '../../shared/components/head-alarm-list-banner/head-alarm-list.types';

@Component({
  selector: 'argo-certificado-vencido-banner',
  standalone: true,
  imports: [CommonModule, HeadAlarmListBannerComponent],
  templateUrl: './certificado-vencido-banner.component.html',
  styleUrls: ['./certificado-vencido-banner.component.scss'],
})
export class CertificadoVencidoBannerComponent {
  readonly alertSvc = inject(CertificadoVencidoAlertService);

  visible = this.alertSvc.visible;

  titulo = computed(() => {
    const d = this.alertSvc.data();
    const ventana = d?.diasVentana ?? 3;
    const total = this.alertSvc.total();
    return total === 1
      ? `¡1 certificado vencido (últimos ${ventana} días)!`
      : `¡${total} certificados vencidos (últimos ${ventana} días)!`;
  });

  rows = computed<HeadAlarmListRow[]>(() =>
    this.alertSvc.items().map((it) => ({
      id: it._id,
      title: this.tituloItem(it),
      meta: this.alertSvc.resumenItem(it),
      routerLink: it.alumnoId ? ['/app/alumnos', it.alumnoId] : ['/app/certificados'],
      queryParams: it.alumnoId ? { tab: 'certificados' } : undefined,
    })),
  );

  cerrar() {
    this.alertSvc.cerrar();
  }

  private tituloItem(it: CertificadoVencimientoAlertaItem): string {
    const nombre = String(it.nombreCompleto || '').trim() || '—';
    return `${nombre} · ${this.alertSvc.etiquetaDias(it)}`;
  }
}
