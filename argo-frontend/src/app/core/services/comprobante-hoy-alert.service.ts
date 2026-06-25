import { Injectable, inject, signal } from '@angular/core';

import { AlertasRuntimeService } from './alertas-runtime.service';

export type ComprobanteHoyTipo = 'ingreso' | 'egreso' | 'factura';

export interface ComprobanteHoyAlerta {
  key: string;
  tipo: ComprobanteHoyTipo;
  id: string;
  numRecibo?: string | null;
  numeroFactura?: string | null;
  valor: number;
  detalle?: string | null;
  formaPago?: string | null;
  tipoPago?: string | null;
  numComprobante?: string | null;
  numDoc?: number | string;
  nombreCompleto?: string;
  alumnoId?: string | null;
  idContrato?: string | null;
  origenFactura?: string;
  mostradaAt: number;
}

@Injectable({ providedIn: 'root' })
export class ComprobanteHoyAlertService {
  private runtime = inject(AlertasRuntimeService);
  private vistos = new Set<string>();
  private readonly _alertas = signal<ComprobanteHoyAlerta[]>([]);

  readonly alertas = this._alertas.asReadonly();

  constructor() {
    setInterval(() => this.purgarExpiradas(), 5000);
  }

  private clave(tipo: ComprobanteHoyTipo, id: string): string {
    return `${tipo}:${id}`;
  }

  private claveAlarma(tipo: ComprobanteHoyTipo): string {
    return AlertasRuntimeService.claveComprobante(tipo);
  }

  private detalleDesdeIngreso(ing: Record<string, unknown>): string | null {
    const detalle = ing['detalle'];
    if (Array.isArray(detalle) && detalle.length) {
      const descrs = detalle
        .map((d) => String((d as Record<string, unknown>)?.['descripcion'] || '').trim())
        .filter(Boolean);
      if (descrs.length) return descrs.join(' · ');
    }
    const concepto = String(ing['concepto'] || '').trim();
    if (concepto) return concepto;
    const tipoIngreso = String(ing['tipoIngreso'] || '').trim();
    if (tipoIngreso) return tipoIngreso;
    const descripcion = String(ing['descripcion'] || '').trim();
    return descripcion || null;
  }

  private puedeMostrarTipo(tipo: ComprobanteHoyTipo): boolean {
    return this.runtime.activa(this.claveAlarma(tipo));
  }

  private purgarExpiradas(): void {
    const now = Date.now();
    this._alertas.update((list) =>
      list.filter((a) => {
        const ms = this.runtime.duracionMs(this.claveAlarma(a.tipo));
        if (ms <= 0) return true;
        return now - a.mostradaAt < ms;
      }),
    );
  }

  notificarDesdeEgreso(
    eg: Record<string, unknown> | null | undefined,
    ctx?: { nombreCompleto?: string; alumnoId?: string; numDoc?: number | string },
  ) {
    if (!eg || !this.puedeMostrarTipo('egreso')) return;
    const id = String(eg['idEgreso'] || eg['_id'] || eg['id'] || '');
    if (!id) return;
    this.notificar(
      {
        key: this.clave('egreso', id),
        tipo: 'egreso',
        id,
        numRecibo: eg['numRecibo'] != null ? String(eg['numRecibo']) : null,
        valor: Number(eg['valorEgreso'] ?? eg['valor']) || 0,
        detalle: String(eg['concepto'] || eg['detalle'] || '').trim() || null,
        formaPago: eg['formaPago'] != null ? String(eg['formaPago']) : null,
        tipoPago: eg['formaPago'] != null ? String(eg['formaPago']) : null,
        numComprobante:
          String(eg['numTransferencia'] || eg['numComprobante'] || '').trim() || null,
        numDoc: (eg['numeroDocumento'] as string | undefined) ?? ctx?.numDoc,
        nombreCompleto:
          ctx?.nombreCompleto ||
          (eg['pagueA'] != null ? String(eg['pagueA']) : '') ||
          (eg['empleadoNombre'] != null ? String(eg['empleadoNombre']) : ''),
        alumnoId: ctx?.alumnoId || null,
        mostradaAt: Date.now(),
      },
      { inmediato: true },
    );
  }

  notificarDesdeFactura(
    f: Record<string, unknown> | null | undefined,
    ctx?: { nombreCompleto?: string; alumnoId?: string; numDoc?: number | string },
  ) {
    if (!f || !this.puedeMostrarTipo('factura')) return;
    const id = String(f['_id'] || f['id'] || '');
    if (!id) return;
    const adq = f['adquirente'] as { nombre?: string; razonSocial?: string } | undefined;
    this.notificar(
      {
        key: this.clave('factura', id),
        tipo: 'factura',
        id,
        numeroFactura: f['numeroFactura'] != null ? String(f['numeroFactura']) : null,
        valor: Number(f['valorTotal']) || 0,
        numDoc: (f['numDoc'] as number | string | undefined) ?? ctx?.numDoc,
        nombreCompleto: ctx?.nombreCompleto || adq?.nombre || adq?.razonSocial || '',
        alumnoId: ctx?.alumnoId || null,
        idContrato: f['idContrato'] != null ? String(f['idContrato']) : null,
        origenFactura: f['origenFactura'] != null ? String(f['origenFactura']) : '',
        mostradaAt: Date.now(),
      },
      { inmediato: true },
    );
  }

  notificarDesdeIngreso(
    ing: Record<string, unknown> | null | undefined,
    ctx?: { nombreCompleto?: string; alumnoId?: string; numDoc?: number | string },
  ) {
    if (!ing || !this.puedeMostrarTipo('ingreso')) return;
    const id = String(ing['_id'] || ing['id'] || '');
    if (!id) return;
    this.notificar(
      {
        key: this.clave('ingreso', id),
        tipo: 'ingreso',
        id,
        numRecibo: ing['numRecibo'] != null ? String(ing['numRecibo']) : null,
        valor: Number(ing['valor']) || 0,
        detalle: this.detalleDesdeIngreso(ing),
        formaPago: ing['formaPago'] != null ? String(ing['formaPago']) : null,
        tipoPago: String(ing['tipoPagoDescr'] || ing['formaPago'] || ing['idTipoPago'] || '').trim() || null,
        numComprobante:
          String(ing['numTransferencia'] || ing['numComprobante'] || '').trim() || null,
        numDoc: (ing['numDoc'] as number | string | undefined) ?? ctx?.numDoc,
        nombreCompleto: ctx?.nombreCompleto || '',
        alumnoId: ctx?.alumnoId || null,
        mostradaAt: Date.now(),
      },
      { inmediato: true },
    );
  }

  notificarDesdeRespuesta(row: Record<string, unknown> | null | undefined) {
    if (!row) return;
    const tipo = String(row['tipo'] || '') as ComprobanteHoyTipo;
    if (tipo !== 'ingreso' && tipo !== 'egreso' && tipo !== 'factura') return;
    if (!this.puedeMostrarTipo(tipo)) return;
    const id = String(row['id'] || '');
    if (!id) return;
    this.notificar({
      key: this.clave(tipo, id),
      tipo,
      id,
      numRecibo: row['numRecibo'] != null ? String(row['numRecibo']) : null,
      numeroFactura: row['numeroFactura'] != null ? String(row['numeroFactura']) : null,
      valor: Number(row['valor']) || 0,
      detalle: row['detalle'] != null ? String(row['detalle']).trim() || null : null,
      formaPago: row['formaPago'] != null ? String(row['formaPago']) : null,
      tipoPago: row['tipoPago'] != null ? String(row['tipoPago']) : null,
      numComprobante: row['numComprobante'] != null ? String(row['numComprobante']) : null,
      numDoc: row['numDoc'] as number | string | undefined,
      nombreCompleto: row['nombreCompleto'] != null ? String(row['nombreCompleto']) : '',
      alumnoId: row['alumnoId'] != null ? String(row['alumnoId']) : null,
      idContrato: row['idContrato'] != null ? String(row['idContrato']) : null,
      origenFactura: row['origenFactura'] != null ? String(row['origenFactura']) : '',
      mostradaAt: Date.now(),
    });
  }

  notificar(alerta: ComprobanteHoyAlerta, opts?: { inmediato?: boolean }) {
    const key = String(alerta.key || '');
    if (!key || !this.puedeMostrarTipo(alerta.tipo)) return;
    if (opts?.inmediato) {
      this.vistos.delete(key);
      this._alertas.update((list) => list.filter((a) => a.key !== key));
    } else if (this.vistos.has(key)) {
      return;
    }
    if (this._alertas().some((a) => a.key === key)) return;
    const conTiempo = { ...alerta, mostradaAt: alerta.mostradaAt || Date.now() };
    this._alertas.update((list) => [conTiempo, ...list].slice(0, 12));
  }

  descartar(key: string) {
    const k = String(key || '');
    if (k) this.vistos.add(k);
    this._alertas.update((list) => list.filter((a) => a.key !== k));
  }

  marcarConocidos(keys: string[]) {
    for (const key of keys) {
      const k = String(key || '');
      if (k) this.vistos.add(k);
    }
  }
}
