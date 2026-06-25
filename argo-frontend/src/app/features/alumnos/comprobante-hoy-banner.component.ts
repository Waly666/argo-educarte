import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { AlarmaService } from '../../core/services/alarma.service';
import {
  ComprobanteHoyAlertService,
  ComprobanteHoyAlerta,
  ComprobanteHoyTipo,
} from '../../core/services/comprobante-hoy-alert.service';
import { ComprobanteHoyImpresionService } from '../../core/services/comprobante-hoy-impresion.service';
import { HeadAlarmListBannerComponent } from '../../shared/components/head-alarm-list-banner/head-alarm-list-banner.component';
import type { HeadAlarmListRow } from '../../shared/components/head-alarm-list-banner/head-alarm-list.types';
import {
  partesEtiquetaComprobanteAlarma,
} from '../../core/utils/comprobante-alarma.helpers';
import type { MovimientoAlarmaHoy } from '../../core/services/alumno.service';

@Component({
  selector: 'argo-comprobante-hoy-banner',
  standalone: true,
  imports: [CommonModule, HeadAlarmListBannerComponent],
  templateUrl: './comprobante-hoy-banner.component.html',
  styleUrls: ['./comprobante-hoy-banner.component.scss'],
})
export class ComprobanteHoyBannerComponent {
  private alertSvc = inject(ComprobanteHoyAlertService);
  private impresionSvc = inject(ComprobanteHoyImpresionService);
  private alarmas = inject(AlarmaService);

  alertas = computed(() =>
    this.alertSvc.alertas().filter((a) => this.puedeVerTipo(a.tipo)),
  );

  visible = computed(() => this.alertas().length > 0);

  rows = computed<HeadAlarmListRow[]>(() =>
    this.alertas().map((a) => ({
      id: a.key,
      title: this.titulo(a),
      rowClass: this.rowClass(a.tipo),
    })),
  );

  onItemClick(row: HeadAlarmListRow) {
    const a = this.alertas().find((x) => x.key === row.id);
    if (a) this.abrir(a);
  }

  onItemDismiss(row: HeadAlarmListRow) {
    this.alertSvc.descartar(row.id);
  }

  cerrar() {
    for (const a of this.alertas()) {
      this.alertSvc.descartar(a.key);
    }
  }

  private puedeVerTipo(tipo: ComprobanteHoyTipo): boolean {
    if (tipo === 'ingreso') return this.alarmas.tiene('alarmas.alumnos.comprobante_ingreso');
    if (tipo === 'egreso') return this.alarmas.tiene('alarmas.alumnos.comprobante_egreso');
    if (tipo === 'factura') return this.alarmas.tiene('alarmas.alumnos.factura');
    return false;
  }

  private rowClass(tipo: ComprobanteHoyTipo): string {
    if (tipo === 'ingreso') return 'hal-row-comp-ingreso';
    if (tipo === 'egreso') return 'hal-row-comp-egreso';
    return 'hal-row-comp-factura';
  }

  private etiquetaTipo(tipo: ComprobanteHoyTipo, a?: ComprobanteHoyAlerta): string {
    if (tipo === 'ingreso') return 'Comprobante ingreso';
    if (tipo === 'egreso') return 'Comprobante egreso';
    if (a?.idContrato || a?.origenFactura === 'contrato_cap') return 'Factura contrato';
    return 'Factura electrónica';
  }

  private etiquetaRef(a: ComprobanteHoyAlerta): string {
    if (a.tipo === 'factura') return a.numeroFactura || 'Factura';
    return a.numRecibo || (a.tipo === 'ingreso' ? 'Ingreso' : 'Egreso');
  }

  private titulo(a: ComprobanteHoyAlerta): string {
    if (a.tipo === 'factura') {
      const partes = [
        this.etiquetaTipo(a.tipo, a),
        this.etiquetaRef(a),
        a.nombreCompleto || '',
        this.fmt(a.valor),
        a.detalle || '',
      ].filter(Boolean);
      return partes.join(' · ');
    }
    const mov: MovimientoAlarmaHoy = {
      id: a.id,
      numRecibo: a.numRecibo,
      valor: a.valor,
      detalle: a.detalle,
      formaPago: a.formaPago,
      tipoPago: a.tipoPago,
      numComprobante: a.numComprobante,
    };
    const base = a.tipo === 'ingreso' ? 'Comprobante ingreso' : 'Comprobante egreso';
    const partes = [
      base,
      a.nombreCompleto || '',
      ...partesEtiquetaComprobanteAlarma(mov, a.tipo, (n) => this.fmt(n)),
    ].filter(Boolean);
    return partes.join(' · ');
  }

  private fmt(v: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(v || 0);
  }

  private abrir(a: ComprobanteHoyAlerta) {
    this.impresionSvc.abrir(a.tipo, a.id);
  }
}
