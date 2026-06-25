import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { VehiculoInspeccionAlertService } from '../../core/services/vehiculo-inspeccion-alert.service';
import { HeadAlarmListBannerComponent } from '../../shared/components/head-alarm-list-banner/head-alarm-list-banner.component';
import type { HeadAlarmListRow } from '../../shared/components/head-alarm-list-banner/head-alarm-list.types';

@Component({
  selector: 'argo-vehiculo-inspeccion-banner',
  standalone: true,
  imports: [CommonModule, HeadAlarmListBannerComponent],
  templateUrl: './vehiculo-inspeccion-banner.component.html',
  styleUrls: ['./vehiculo-inspeccion-banner.component.scss'],
})
export class VehiculoInspeccionBannerComponent {
  private alertSvc = inject(VehiculoInspeccionAlertService);

  visible = this.alertSvc.visible;
  resumen = this.alertSvc.resumen;

  rows = computed<HeadAlarmListRow[]>(() => {
    const r = this.resumen();
    return (r?.alertas || []).map((a) => ({
      id: a.vehiculoId || a.placa,
      title: `Placa ${a.placa}`,
      meta: r?.fecha ? `Sin inspección hoy · ${r.fecha}` : 'Sin inspección hoy',
      routerLink: ['/app/vehiculos', a.vehiculoId],
      queryParams: { tab: 'inspeccion' },
    }));
  });

  titulo = computed(() => {
    const n = this.resumen()?.totalPendientes ?? this.rows().length;
    return n === 1 ? '1 vehículo sin inspección hoy' : `${n} vehículos sin inspección hoy`;
  });

  cerrar() {
    this.alertSvc.cerrar();
  }
}
