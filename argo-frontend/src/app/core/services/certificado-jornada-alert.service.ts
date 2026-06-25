import { Injectable, signal } from '@angular/core';
import type { TipoCertificadoId } from '../constants/tipos-certificado';

export interface CertificadoJornadaAlerta {
  id: string;
  codigoCert?: string;
  nombreCompleto?: string;
  encabezado?: string;
  numDoc?: number | string;
  fechaEmision?: string;
  tipoFormatoCert?: TipoCertificadoId | string;
  tipoFormatoCertLabel?: string;
}

@Injectable({ providedIn: 'root' })
export class CertificadoJornadaAlertService {
  private vistos = new Set<string>();
  private readonly _alertas = signal<CertificadoJornadaAlerta[]>([]);

  readonly alertas = this._alertas.asReadonly();

  notificarDesdeRespuesta(cert: Record<string, unknown> | null | undefined, nombreAlumno?: string) {
    if (!cert) return;
    const id = String(cert['_id'] || cert['id'] || '');
    if (!id) return;
    this.notificar({
      id,
      codigoCert: String(cert['codigoCert'] || ''),
      nombreCompleto: nombreAlumno || String(cert['nombreCompleto'] || ''),
      encabezado: String(cert['encabezado'] || ''),
      numDoc: cert['numDoc'] as number | string | undefined,
      fechaEmision: cert['fechaEmision'] ? String(cert['fechaEmision']) : undefined,
      tipoFormatoCert: cert['tipoFormatoCert'] ? String(cert['tipoFormatoCert']) : undefined,
      tipoFormatoCertLabel: cert['tipoFormatoCertLabel'] ? String(cert['tipoFormatoCertLabel']) : undefined,
    });
  }

  notificarVariosDesdeRespuesta(
    items: Array<{ certificado?: Record<string, unknown> | null; nombreAlumno?: string }> | null | undefined,
  ) {
    for (const item of items || []) {
      this.notificarDesdeRespuesta(item?.certificado, item?.nombreAlumno);
    }
  }

  notificar(alerta: CertificadoJornadaAlerta) {
    const id = String(alerta.id || '');
    if (!id || this.vistos.has(id)) return;
    if (this._alertas().some((a) => a.id === id)) return;
    this._alertas.update((list) => [alerta, ...list].slice(0, 12));
  }

  descartar(id: string) {
    const key = String(id || '');
    if (key) this.vistos.add(key);
    this._alertas.update((list) => list.filter((a) => a.id !== key));
  }

  descartarTodas() {
    const actuales = this._alertas();
    if (!actuales.length) return;
    for (const a of actuales) this.vistos.add(a.id);
    this._alertas.set([]);
  }

  /** Evita re-alertar certificados ya conocidos al iniciar sesión o tras cargar listado. */
  marcarConocidos(ids: string[]) {
    for (const id of ids) {
      const k = String(id || '');
      if (k) this.vistos.add(k);
    }
  }

  idsConocidos(): string[] {
    return [...this.vistos];
  }
}
