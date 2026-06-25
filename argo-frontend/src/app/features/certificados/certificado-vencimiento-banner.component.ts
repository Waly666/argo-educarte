import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { CertificadoVencimientoAlertService } from '../../core/services/certificado-vencimiento-alert.service';
import type { CertificadoVencimientoAlertaItem } from '../../core/services/certificado.service';
import { HeadAlarmListBannerComponent } from '../../shared/components/head-alarm-list-banner/head-alarm-list-banner.component';
import type { HeadAlarmListRow } from '../../shared/components/head-alarm-list-banner/head-alarm-list.types';

@Component({
  selector: 'argo-certificado-vencimiento-banner',
  standalone: true,
  imports: [CommonModule, HeadAlarmListBannerComponent],
  templateUrl: './certificado-vencimiento-banner.component.html',
  styleUrls: ['./certificado-vencimiento-banner.component.scss'],
})
export class CertificadoVencimientoBannerComponent {
  readonly alertSvc = inject(CertificadoVencimientoAlertService);

  visible = this.alertSvc.visible;
  peorNivel = this.alertSvc.peorNivel;

  theme = computed(() => `hal-theme-cert-vence-${this.peorNivel()}`);

  titulo = computed(() => {
    const d = this.alertSvc.data();
    const ventana = d?.diasVentana ?? 15;
    const hoy = this.alertSvc.venceHoy();
    const total = this.alertSvc.total();
    if (hoy > 0) {
      return hoy === 1
        ? `¡Certificado vence HOY (ventana ${ventana} días)!`
        : `¡${hoy} certificados vencen HOY (ventana ${ventana} días)!`;
    }
    return total === 1
      ? `1 certificado por vencer — próximos ${ventana} días`
      : `${total} certificados por vencer — próximos ${ventana} días`;
  });

  rows = computed<HeadAlarmListRow[]>(() =>
    this.alertSvc.items().map((it) => ({
      id: it._id,
      title: this.tituloItem(it),
      meta: this.alertSvc.resumenItem(it),
      rowClass: `hal-row-cert-vence-${it.nivelUrgencia}`,
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
