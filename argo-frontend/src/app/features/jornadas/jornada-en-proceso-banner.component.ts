import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import {
  JornadaEnProcesoAlertService,
  JornadaEnProcesoAlerta,
} from '../../core/services/jornada-en-proceso-alert.service';
import { JornadaHubDeepLinkService, JornadaHubDeepLink } from '../../core/services/jornada-hub-deeplink.service';
import { HeadAlarmListBannerComponent } from '../../shared/components/head-alarm-list-banner/head-alarm-list-banner.component';
import type { HeadAlarmListRow } from '../../shared/components/head-alarm-list-banner/head-alarm-list.types';
import { fmtFechaCalendario } from './jornada-calendario.util';

@Component({
  selector: 'argo-jornada-en-proceso-banner',
  standalone: true,
  imports: [CommonModule, HeadAlarmListBannerComponent],
  templateUrl: './jornada-en-proceso-banner.component.html',
  styleUrls: ['./jornada-en-proceso-banner.component.scss'],
})
export class JornadaEnProcesoBannerComponent {
  private alertSvc = inject(JornadaEnProcesoAlertService);
  private deeplink = inject(JornadaHubDeepLinkService);
  private router = inject(Router);

  visible = this.alertSvc.visible;
  activas = this.alertSvc.activas;

  alertasContrato = computed(() => {
    const map = new Map<string, JornadaEnProcesoAlerta>();
    for (const j of this.activas()) {
      const key = j.idContrato || j.codContrato || j.id;
      if (!map.has(key)) map.set(key, j);
    }
    return Array.from(map.values());
  });

  rows = computed<HeadAlarmListRow[]>(() => {
    const list: HeadAlarmListRow[] = [
      {
        id: 'proceso',
        title: 'Jornada EN PROCESO',
        meta: this.detalleProceso(),
        rowClass: 'hal-row-jornada-proceso',
      },
    ];
    for (const c of this.alertasContrato()) {
      const key = c.idContrato || c.codContrato || c.id;
      list.push({
        id: `contrato:${key}`,
        title: `Contrato ${c.codContrato || '—'}`,
        meta: this.detalleContrato(c),
        rowClass: c.cumplidoContrato ? 'hal-row-jornada-cumplido' : 'hal-row-jornada-contrato',
      });
    }
    for (const j of this.activas()) {
      list.push({
        id: `jornada:${j.id}`,
        title: `Meta jornada · ${this.tituloJornada(j)}`,
        meta: this.detalleJornada(j),
        rowClass: j.cumplidoJornada ? 'hal-row-jornada-cumplido' : 'hal-row-jornada-meta',
      });
    }
    return list;
  });

  onItemClick(row: HeadAlarmListRow) {
    if (row.id === 'proceso') {
      this.irJornadas();
      return;
    }
    if (row.id.startsWith('contrato:')) {
      const key = row.id.slice('contrato:'.length);
      const c = this.alertasContrato().find(
        (x) => (x.idContrato || x.codContrato || x.id) === key,
      );
      if (c) this.irContrato(c);
      return;
    }
    if (row.id.startsWith('jornada:')) {
      const id = row.id.slice('jornada:'.length);
      const j = this.activas().find((x) => x.id === id);
      if (j) this.irJornadaEdit(j);
    }
  }

  cerrar() {
    this.alertSvc.cerrar();
  }

  private tituloJornada(j: JornadaEnProcesoAlerta): string {
    const partes = [
      j.codContrato,
      j.municipio,
      j.fechaProgramacion ? fmtFechaCalendario(j.fechaProgramacion) : '',
    ].filter(Boolean);
    return partes.length ? partes.join(' · ') : 'Jornada activa';
  }

  private detalleJornada(j: JornadaEnProcesoAlerta): string {
    const base = `${j.direccion || 'Sin dirección'} · ${j.certificadosJornada ?? 0}/${j.numeObjeJornada ?? 0} cert.`;
    return j.cumplidoJornada ? `${base} · META CUMPLIDA` : base;
  }

  private detalleContrato(c: JornadaEnProcesoAlerta): string {
    const base = `${c.certificadosContrato ?? 0}/${c.numeroAlumnos ?? 0} cert.`;
    return c.cumplidoContrato ? `${base} · META CUMPLIDA` : base;
  }

  private detalleProceso(): string {
    const list = this.activas();
    const n = list.length;
    if (n === 0) return 'Operación activa hoy';
    if (n === 1) {
      const j = list[0];
      const partes = [
        fmtFechaCalendario(j.fechaProgramacion),
        j.municipio,
        j.direccion,
        j.codContrato || j.contratoLabel,
      ].filter((x) => x && x !== '—');
      return partes.length ? partes.join(' · ') : 'Operación activa hoy';
    }
    return `${n} jornadas activas hoy`;
  }

  private irJornadas() {
    void this.router.navigate(['/app/jornadas/en-proceso']);
  }

  private irContrato(c: JornadaEnProcesoAlerta) {
    const id = c.idContrato;
    if (!id) {
      void this.router.navigate(['/app/jornadas/en-proceso']);
      return;
    }
    this.navegarHub({ contrato: id }, { contrato: id });
  }

  private irJornadaEdit(j: JornadaEnProcesoAlerta) {
    const contrato = j.idContrato;
    if (!contrato || !j.id) {
      void this.router.navigate(['/app/jornadas/en-proceso']);
      return;
    }
    this.navegarHub(
      { contrato, tab: 'jornadas', jornada: j.id },
      { contrato, tab: 'jornadas', jornada: j.id },
    );
  }

  private navegarHub(link: JornadaHubDeepLink, queryParams: Record<string, string>) {
    const tree = this.router.createUrlTree(['/app/jornadas'], { queryParams });
    const mismaUrl = this.router.isActive(tree, {
      paths: 'exact',
      queryParams: 'exact',
      fragment: 'ignored',
      matrixParams: 'ignored',
    });
    if (mismaUrl) {
      this.deeplink.emit(link);
      return;
    }
    void this.router.navigateByUrl(tree);
  }
}
