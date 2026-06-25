import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { EmpleadoDocsAlertService } from '../../core/services/empleado-docs-alert.service';
import type { AlertaDocumentoEmpleado } from '../../core/services/empleado.service';
import { HeadAlarmListBannerComponent } from '../../shared/components/head-alarm-list-banner/head-alarm-list-banner.component';
import type { HeadAlarmListRow } from '../../shared/components/head-alarm-list-banner/head-alarm-list.types';

interface EmpleadoDocsVencGrupo {
  idEmpleado: number;
  nombreEmpleado: string;
  docs: AlertaDocumentoEmpleado[];
}

@Component({
  selector: 'argo-empleado-docs-vencimiento-banner',
  standalone: true,
  imports: [CommonModule, HeadAlarmListBannerComponent],
  templateUrl: './empleado-docs-vencimiento-banner.component.html',
  styleUrls: ['./empleado-docs-vencimiento-banner.component.scss'],
})
export class EmpleadoDocsVencimientoBannerComponent {
  private alertSvc = inject(EmpleadoDocsAlertService);

  visible = this.alertSvc.visible;
  resumen = this.alertSvc.resumen;

  rows = computed(() => this.agrupar(this.resumen()?.alertas || []));

  titulo = computed(() => {
    const r = this.resumen();
    if (!r) return 'Documentos de empleados vencidos o por vencer';
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

  private agrupar(alertas: AlertaDocumentoEmpleado[]): HeadAlarmListRow[] {
    const map = new Map<string, EmpleadoDocsVencGrupo>();
    for (const a of alertas) {
      const key = String(a.idEmpleado);
      let row = map.get(key);
      if (!row) {
        row = { idEmpleado: a.idEmpleado, nombreEmpleado: a.nombreEmpleado, docs: [] };
        map.set(key, row);
      }
      row.docs.push(a);
    }
    return [...map.values()]
      .map((g) => ({
        id: String(g.idEmpleado),
        title: g.nombreEmpleado,
        meta: this.metaDocs(g.docs),
        routerLink: ['/app/rrhh/empleados'],
        queryParams: { empleado: String(g.idEmpleado), seccion: 'documentos' },
      }))
      .sort((a, b) => a.title.localeCompare(b.title, 'es'));
  }

  private metaDocs(docs: AlertaDocumentoEmpleado[]): string {
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
