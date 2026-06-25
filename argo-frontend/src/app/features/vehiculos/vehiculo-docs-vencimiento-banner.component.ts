import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { VehiculoDocsAlertService } from '../../core/services/vehiculo-docs-alert.service';
import type { AlertaDocumentoVehiculo } from '../../core/services/vehiculo.service';
import { HeadAlarmListBannerComponent } from '../../shared/components/head-alarm-list-banner/head-alarm-list-banner.component';
import type { HeadAlarmListRow } from '../../shared/components/head-alarm-list-banner/head-alarm-list.types';

interface VehiculoDocsVencGrupo {
  vehiculoId: string;
  placa: string;
  docs: AlertaDocumentoVehiculo[];
}

@Component({
  selector: 'argo-vehiculo-docs-vencimiento-banner',
  standalone: true,
  imports: [CommonModule, HeadAlarmListBannerComponent],
  templateUrl: './vehiculo-docs-vencimiento-banner.component.html',
  styleUrls: ['./vehiculo-docs-vencimiento-banner.component.scss'],
})
export class VehiculoDocsVencimientoBannerComponent {
  private alertSvc = inject(VehiculoDocsAlertService);

  visible = this.alertSvc.visible;
  resumen = this.alertSvc.resumen;

  rows = computed(() => this.agrupar(this.resumen()?.alertas || []));

  titulo = computed(() => {
    const r = this.resumen();
    if (!r) return 'Documentos de vehículos vencidos o por vencer';
    if (r.docsVencidos > 0 && r.docsPorVencer > 0) {
      return `${r.docsVencidos} vencido(s) · ${r.docsPorVencer} por vencer`;
    }
    if (r.docsVencidos > 0) {
      return r.docsVencidos === 1 ? '1 documento vencido' : `${r.docsVencidos} documentos vencidos`;
    }
    return r.docsPorVencer === 1
      ? '1 documento por vencer'
      : `${r.docsPorVencer} documentos por vencer`;
  });

  cerrar() {
    this.alertSvc.cerrar();
  }

  private agrupar(alertas: AlertaDocumentoVehiculo[]): HeadAlarmListRow[] {
    const map = new Map<string, VehiculoDocsVencGrupo>();
    for (const a of alertas) {
      const key = a.vehiculoId || a.placa;
      if (!key) continue;
      let row = map.get(key);
      if (!row) {
        row = { vehiculoId: a.vehiculoId, placa: a.placa, docs: [] };
        map.set(key, row);
      }
      row.docs.push(a);
    }
    return [...map.values()]
      .map((g) => ({
        id: g.vehiculoId || g.placa,
        title: `Placa ${g.placa}`,
        meta: this.metaDocs(g.docs),
        routerLink: ['/app/vehiculos', g.vehiculoId],
        queryParams: { tab: 'documentos' },
      }))
      .sort((a, b) => a.title.localeCompare(b.title, 'es'));
  }

  private metaDocs(docs: AlertaDocumentoVehiculo[]): string {
    const muestra = docs
      .slice(0, 3)
      .map((a) => {
        if (a.vencido) return `${a.documento} (vencido)`;
        if (a.faltaFechaVence) return `${a.documento} (sin fecha)`;
        return a.documento;
      })
      .join(', ');
    const extra = docs.length > 3 ? ` · +${docs.length - 3} más` : '';
    return muestra + extra;
  }
}
