import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import {
  ForoMensajeAlertService,
  ForoMensajeAlerta,
} from '../../core/services/foro-mensaje-alert.service';
import { HeadAlarmListBannerComponent } from '../../shared/components/head-alarm-list-banner/head-alarm-list-banner.component';
import type { HeadAlarmListRow } from '../../shared/components/head-alarm-list-banner/head-alarm-list.types';

@Component({
  selector: 'argo-foro-mensaje-banner',
  standalone: true,
  imports: [CommonModule, HeadAlarmListBannerComponent],
  templateUrl: './foro-mensaje-banner.component.html',
  styleUrl: './foro-mensaje-banner.component.scss',
})
export class ForoMensajeBannerComponent {
  private alertSvc = inject(ForoMensajeAlertService);

  visible = computed(() => this.alertSvc.alertas().length > 0);

  rows = computed<HeadAlarmListRow[]>(() =>
    this.alertSvc.alertas().map((a) => ({
      id: a.id,
      title: `${a.nombrePrograma} · ${a.autorNombre}`,
      meta: this.resumenTexto(a),
    })),
  );

  onItemClick(row: HeadAlarmListRow) {
    const a = this.alertSvc.alertas().find((x) => x.id === row.id);
    if (a) this.alertSvc.abrir(a);
  }

  onItemDismiss(row: HeadAlarmListRow) {
    this.alertSvc.descartar(row.id);
  }

  cerrar() {
    for (const a of this.alertSvc.alertas()) {
      this.alertSvc.descartar(a.id);
    }
  }

  private resumenTexto(a: ForoMensajeAlerta): string {
    const t = a.texto.trim();
    return t.length > 120 ? `${t.slice(0, 117)}…` : t;
  }
}
