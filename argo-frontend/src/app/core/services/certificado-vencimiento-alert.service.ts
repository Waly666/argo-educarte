import { Injectable, computed, signal } from '@angular/core';

import type {
  CertificadoVencimientoAlertaItem,
  CertificadosVencimientoAlertasRes,
} from './certificado.service';

/** Alarma: certificados por vencer (15 días antes, hasta el día del vencimiento). */
@Injectable({ providedIn: 'root' })
export class CertificadoVencimientoAlertService {
  private ocultaManual = signal(false);
  private firmaAnterior = '';
  private _data = signal<CertificadosVencimientoAlertasRes | null>(null);

  readonly data = this._data.asReadonly();
  readonly items = computed(() => this._data()?.items ?? []);
  readonly total = computed(() => this._data()?.total ?? 0);
  readonly venceHoy = computed(() => this._data()?.venceHoy ?? 0);
  readonly venceManana = computed(() => this._data()?.venceManana ?? 0);
  readonly hayAlertas = computed(() => this.total() > 0);
  readonly visible = computed(() => this.hayAlertas() && !this.ocultaManual());

  readonly peorNivel = computed(() => {
    const items = this.items();
    if (!items.length) return 'aviso';
    const orden = ['hoy', 'critico', 'urgente', 'proximo', 'aviso'];
    let peor = 'aviso';
    for (const it of items) {
      const idx = orden.indexOf(it.nivelUrgencia);
      const peorIdx = orden.indexOf(peor);
      if (idx >= 0 && (peorIdx < 0 || idx < peorIdx)) peor = it.nivelUrgencia;
    }
    return peor as CertificadoVencimientoAlertaItem['nivelUrgencia'];
  });

  actualizar(data: CertificadosVencimientoAlertasRes | null | undefined) {
    const next = data ?? null;
    const firma = next
      ? `${next.total}|${next.venceHoy}|${next.venceManana}|${next.critico}|${next.items.map((i) => `${i._id}:${i.diasRestantes}`).join(',')}`
      : '';

    if (!next || next.total <= 0) {
      this.ocultaManual.set(false);
      this.firmaAnterior = '';
      this._data.set(null);
      return;
    }

    if (firma !== this.firmaAnterior) {
      this.ocultaManual.set(false);
    }

    this.firmaAnterior = firma;
    this._data.set(next);
  }

  cerrar() {
    this.ocultaManual.set(true);
  }

  etiquetaDias(item: CertificadoVencimientoAlertaItem): string {
    const d = item.diasRestantes;
    if (d <= 0) return 'VENCE HOY';
    if (d === 1) return 'Vence mañana';
    return `Vence en ${d} días`;
  }

  fmtFecha(f?: string | null): string {
    if (!f) return '—';
    const d = new Date(f);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-CO');
  }

  resumenItem(item: CertificadoVencimientoAlertaItem): string {
    const nombre = String(item.nombreCompleto || '').trim() || '—';
    const curso =
      String(item.encabezado || '').trim() ||
      String(item.tipoFormatoCertLabel || '').trim() ||
      'Certificado';
    const vence = this.fmtFecha(item.fechaVencimiento);
    const cod = item.codigoCert ? ` · ${item.codigoCert}` : '';
    return `${nombre} · ${curso}${cod} · ${vence} · ${this.etiquetaDias(item)}`;
  }
}
