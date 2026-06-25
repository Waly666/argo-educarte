import { Injectable, computed, signal } from '@angular/core';

import type {
  CertificadoVencimientoAlertaItem,
  CertificadosVencidosAlertasRes,
} from './certificado.service';

/** Alarma: certificados ya vencidos (3 días después del vencimiento). */
@Injectable({ providedIn: 'root' })
export class CertificadoVencidoAlertService {
  private ocultaManual = signal(false);
  private firmaAnterior = '';
  private _data = signal<CertificadosVencidosAlertasRes | null>(null);

  readonly data = this._data.asReadonly();
  readonly items = computed(() => this._data()?.items ?? []);
  readonly total = computed(() => this._data()?.total ?? 0);
  readonly hayAlertas = computed(() => this.total() > 0);
  readonly visible = computed(() => this.hayAlertas() && !this.ocultaManual());

  actualizar(data: CertificadosVencidosAlertasRes | null | undefined) {
    const next = data ?? null;
    const firma = next
      ? `${next.total}|${next.diasVentana}|${next.items.map((i) => `${i._id}:${i.diasVencidos}`).join(',')}`
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
    const vencidos = item.diasVencidos ?? (item.diasRestantes < 0 ? Math.abs(item.diasRestantes) : 0);
    if (vencidos === 1) return 'Venció ayer';
    return `Venció hace ${vencidos} días`;
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
