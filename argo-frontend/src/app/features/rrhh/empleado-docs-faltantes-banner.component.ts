import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { EmpleadoDocsFaltantesAlertService } from '../../core/services/empleado-docs-faltantes-alert.service';
import type { AlertaDocFaltanteEmpleado } from '../../core/services/empleado.service';
import { formatNumDoc } from '../../core/utils/num-doc.helpers';
import { HeadAlarmListBannerComponent } from '../../shared/components/head-alarm-list-banner/head-alarm-list-banner.component';
import type { HeadAlarmListRow } from '../../shared/components/head-alarm-list-banner/head-alarm-list.types';

interface EmpleadoDocsFaltantesGrupo {
  idEmpleado: number;
  nombreEmpleado: string;
  numeroDocumento?: string;
  esInstructor?: boolean;
  documentos: string[];
}

@Component({
  selector: 'argo-empleado-docs-faltantes-banner',
  standalone: true,
  imports: [CommonModule, HeadAlarmListBannerComponent],
  templateUrl: './empleado-docs-faltantes-banner.component.html',
  styleUrls: ['./empleado-docs-faltantes-banner.component.scss'],
})
export class EmpleadoDocsFaltantesBannerComponent {
  private alertSvc = inject(EmpleadoDocsFaltantesAlertService);

  visible = this.alertSvc.visible;

  rows = computed(() => this.agrupar(this.alertSvc.resumen()?.alertas || []));

  cerrar() {
    this.alertSvc.cerrar();
  }

  private agrupar(alertas: AlertaDocFaltanteEmpleado[]): HeadAlarmListRow[] {
    const map = new Map<string, EmpleadoDocsFaltantesGrupo>();
    for (const a of alertas) {
      const key = String(a.idEmpleado);
      let row = map.get(key);
      if (!row) {
        row = {
          idEmpleado: a.idEmpleado,
          nombreEmpleado: a.nombreEmpleado,
          numeroDocumento: a.numeroDocumento,
          esInstructor: a.esInstructor,
          documentos: [],
        };
        map.set(key, row);
      }
      if (a.esInstructor) row.esInstructor = true;
      if (a.numeroDocumento && !row.numeroDocumento) row.numeroDocumento = a.numeroDocumento;
      if (!row.documentos.includes(a.documento)) row.documentos.push(a.documento);
    }
    return [...map.values()]
      .map((g) => ({
        id: String(g.idEmpleado),
        title: this.tituloItem(g),
        meta: this.metaDocs(g.documentos),
        routerLink: g.esInstructor
          ? ['/app/instructores', String(g.idEmpleado)]
          : ['/app/rrhh/empleados'],
        queryParams: g.esInstructor
          ? { tab: 'documentos' }
          : { empleado: String(g.idEmpleado), seccion: 'documentos' },
      }))
      .sort((a, b) => a.title.localeCompare(b.title, 'es'));
  }

  private tituloItem(item: EmpleadoDocsFaltantesGrupo): string {
    const rol = item.esInstructor ? 'Instructor' : 'Empleado';
    const doc = item.numeroDocumento ? ` · CC ${formatNumDoc(item.numeroDocumento)}` : '';
    return `${item.nombreEmpleado}${doc} · ${rol}`;
  }

  private metaDocs(docs: string[]): string {
    const n = docs.length;
    const lista = docs.slice(0, 3).join(', ');
    const extra = n > 3 ? ` · +${n - 3} más` : '';
    return `Falta${n === 1 ? '' : 'n'}: ${lista}${extra}`;
  }
}
