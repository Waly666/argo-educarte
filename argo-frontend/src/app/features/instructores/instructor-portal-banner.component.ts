import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { InstructorPortalAlertService } from '../../core/services/instructor-portal-alert.service';
import { HeadAlarmListBannerComponent } from '../../shared/components/head-alarm-list-banner/head-alarm-list-banner.component';
import type { HeadAlarmListRow } from '../../shared/components/head-alarm-list-banner/head-alarm-list.types';

@Component({
  selector: 'argo-instructor-portal-banner',
  standalone: true,
  imports: [CommonModule, HeadAlarmListBannerComponent],
  templateUrl: './instructor-portal-banner.component.html',
  styleUrls: ['./instructor-portal-banner.component.scss'],
})
export class InstructorPortalBannerComponent {
  protected alertSvc = inject(InstructorPortalAlertService);
  private router = inject(Router);

  visible = computed(() => this.alertSvc.hayAlertasActivas());
  proxima = computed(() => this.alertSvc.bannerProximaVisible());
  asignadas = computed(() => this.alertSvc.bannerAsignadasVisible());
  inspeccion = computed(() => this.alertSvc.bannerInspeccionVisible());

  rows = computed<HeadAlarmListRow[]>(() => {
    const list: HeadAlarmListRow[] = [];
    if (this.proxima()) {
      for (const c of this.alertSvc.proximas()) {
        list.push({
          id: `proxima:${c._id}`,
          title: `Clase en ${this.alertSvc.minutosVentana()} min o menos`,
          meta: this.alertSvc.resumenClase(c),
        });
      }
    }
    if (this.inspeccion()) {
      const info = this.alertSvc.inspeccion();
      list.push({
        id: 'inspeccion',
        title: 'Inspección preoperacional pendiente',
        meta: info?.mensaje || '',
      });
    }
    if (this.asignadas()) {
      for (const c of this.alertSvc.asignadasNuevas()) {
        list.push({
          id: `asignada:${c.origen}:${c._id}`,
          title: 'Nueva clase asignada',
          meta: this.alertSvc.resumenClase(c),
        });
      }
    }
    return list;
  });

  titulo = computed(() => {
    const n = this.rows().length;
    return n === 1 ? 'Alerta portal instructor' : `${n} alertas portal instructor`;
  });

  onItemClick(_row: HeadAlarmListRow) {
    this.irPortal();
  }

  cerrar() {
    if (this.proxima()) this.alertSvc.cerrarProxima();
    if (this.asignadas()) this.alertSvc.cerrarAsignadas();
    if (this.inspeccion()) this.alertSvc.ocultarInspeccionTemporal();
  }

  private irPortal() {
    void this.router.navigate(['/app/instructores']);
  }
}
