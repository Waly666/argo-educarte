import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { VehiculoDocsFaltantesAlertService } from '../../core/services/vehiculo-docs-faltantes-alert.service';
import type { AlertaDocFaltanteVehiculo } from '../../core/services/vehiculo.service';
import { HeadAlarmListBannerComponent } from '../../shared/components/head-alarm-list-banner/head-alarm-list-banner.component';
import type { HeadAlarmListRow } from '../../shared/components/head-alarm-list-banner/head-alarm-list.types';

@Component({
  selector: 'argo-vehiculo-docs-faltantes-banner',
  standalone: true,
  imports: [CommonModule, HeadAlarmListBannerComponent],
  templateUrl: './vehiculo-docs-faltantes-banner.component.html',
  styleUrls: ['./vehiculo-docs-faltantes-banner.component.scss'],
})
export class VehiculoDocsFaltantesBannerComponent {
  private alertSvc = inject(VehiculoDocsFaltantesAlertService);

  visible = this.alertSvc.visible;

  rows = computed(() => this.agrupar(this.alertSvc.resumen()?.alertas || []));

  cerrar() {
    this.alertSvc.cerrar();
  }

  private agrupar(alertas: AlertaDocFaltanteVehiculo[]): HeadAlarmListRow[] {
    const map = new Map<string, HeadAlarmListRow & { docs: string[] }>();
    for (const a of alertas) {
      const key = a.vehiculoId || a.placa;
      if (!key) continue;
      let row = map.get(key);
      if (!row) {
        row = {
          id: key,
          title: `Placa ${a.placa}${a.claseVehiculo ? ` · ${a.claseVehiculo}` : ''}`,
          meta: '',
          routerLink: ['/app/vehiculos', a.vehiculoId],
          queryParams: { tab: 'documentos' },
          docs: [],
        };
        map.set(key, row);
      }
      if (!row.docs.includes(a.documento)) row.docs.push(a.documento);
    }
    return [...map.values()]
      .map(({ docs, ...row }) => ({
        ...row,
        meta: this.metaDocs(docs),
      }))
      .sort((a, b) => a.title.localeCompare(b.title, 'es'));
  }

  private metaDocs(docs: string[]): string {
    const n = docs.length;
    const lista = docs.slice(0, 3).join(', ');
    const extra = n > 3 ? ` · +${n - 3} más` : '';
    return `Falta${n === 1 ? '' : 'n'}: ${lista}${extra}`;
  }
}
