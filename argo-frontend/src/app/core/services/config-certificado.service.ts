import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { LayoutDefaultsApi, LayoutPorTipoCert } from '../constants/certificado-campos-layout';
import {
  OrientacionCertificado,
  TipoCertificadoId,
} from '../constants/tipos-certificado';

export interface PlantillaPorTipoSlot {
  orientacion: OrientacionCertificado;
  id: string | null;
}

export interface ConfigCertificado {
  nombreInstitucion?: string;
  ciudad?: string;
  nombreDirector?: string;
  nombreInstructor?: string;
  urlFirmaDirector?: string;
  urlFirmaInstructor?: string;
  prefijoCertificado?: string;
  consecutivoCertificado?: number;
  usarPrefijoCertificado?: boolean;
  usarSegundoPrefijoCertificado?: boolean;
  segundoPrefijoCertificado?: string;
  plantillaPorTipo?: Partial<Record<TipoCertificadoId, PlantillaPorTipoSlot>>;
  /** Posición y estilo de campos por tipo y orientación */
  layoutPorTipo?: LayoutPorTipoCert;
  /** Incluir QR en todos los certificados (global) */
  mostrarQr?: boolean;
  qrPosicion?: 'inferior_izquierda' | 'inferior_derecha' | 'superior_derecha' | 'superior_izquierda';
  /** % del ancho de la hoja para el QR global */
  qrTamanoPct?: number;
  /** @deprecated */
  qrTamanoPx?: number;
  /** Días antes del vencimiento — alarma «por vencer» en el banner superior. */
  diasAvisoCertificadoPorVencer?: number;
  /** Días después del vencimiento — alarma «vencidos» en el banner superior. */
  diasAvisoCertificadoVencido?: number;
  /** Emitir certificado automáticamente cuando la liquidación queda en saldo 0 (interruptor maestro). */
  autoCertificadoAlPagar?: boolean;
  /** Qué formatos se certifican automáticamente al pagar. */
  autoCertificadoPorTipo?: Partial<Record<TipoCertificadoId, boolean>>;
  /** Tipos de capacitación (idTipCap o etiqueta) excluidos de la certificación automática. */
  autoCertificadoTiposCapExcluidos?: string[];
}

export interface TipoCapacitacionOpcion {
  idTipCap: string;
  label: string;
}

export const QR_POSICIONES_CERT = [
  { id: 'inferior_izquierda' as const, label: 'Inferior izquierda' },
  { id: 'inferior_derecha' as const, label: 'Inferior derecha' },
  { id: 'superior_derecha' as const, label: 'Superior derecha' },
  { id: 'superior_izquierda' as const, label: 'Superior izquierda' },
];

export interface PlantillaCertificado {
  _id: string;
  nombre: string;
  tipoCertificado: TipoCertificadoId;
  orientacion: OrientacionCertificado;
  urlFondo?: string;
  activa?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfigCertificadoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/config/certificado`;
  private plantillasBase = `${environment.apiUrl}/certificados/plantillas`;

  obtener(): Observable<ConfigCertificado> {
    return this.http.get<ConfigCertificado>(this.base);
  }

  listarTiposCapacitacion(): Observable<TipoCapacitacionOpcion[]> {
    return this.http
      .get<Record<string, unknown>[]>(`${environment.apiUrl}/catalogos/catTipoCapacitacion`)
      .pipe(
        map((rows) =>
          (rows || [])
            .map((r) => {
              const idTipCap = String(r['idTipCap'] ?? r['_id'] ?? '').trim();
              const label = String(
                r['tipoCap'] ?? r['descripcion'] ?? r['nombre'] ?? idTipCap,
              ).trim();
              return { idTipCap, label };
            })
            .filter((t) => !!t.idTipCap)
            .sort((a, b) => a.label.localeCompare(b.label)),
        ),
      );
  }

  guardar(data: ConfigCertificado): Observable<ConfigCertificado> {
    return this.http.put<ConfigCertificado>(this.base, data);
  }

  layoutDefaults(): Observable<LayoutDefaultsApi> {
    return this.http.get<LayoutDefaultsApi>(`${this.base}/layout-defaults`);
  }

  vistaPrevia(body: {
    tipo: TipoCertificadoId;
    orientacion: OrientacionCertificado;
    layoutPorTipo?: LayoutPorTipoCert;
    urlFondo?: string;
  }): Observable<string> {
    return this.http.post(`${this.base}/vista-previa`, body, { responseType: 'text' });
  }

  guardarFirmas(form: FormData): Observable<ConfigCertificado> {
    return this.http.put<ConfigCertificado>(`${this.base}/firmas`, form);
  }

  listarPlantillas(tipo?: TipoCertificadoId): Observable<PlantillaCertificado[]> {
    const q = tipo ? `?tipo=${encodeURIComponent(tipo)}` : '';
    return this.http.get<PlantillaCertificado[]>(`${this.plantillasBase}${q}`);
  }

  listarPlantillasTodas(): Observable<PlantillaCertificado[]> {
    return this.http.get<PlantillaCertificado[]>(`${this.plantillasBase}/todas`);
  }

  crearPlantilla(form: FormData): Observable<PlantillaCertificado> {
    return this.http.post<PlantillaCertificado>(`${this.plantillasBase}`, form);
  }

  actualizarPlantilla(id: string, form: FormData): Observable<PlantillaCertificado> {
    return this.http.put<PlantillaCertificado>(`${this.plantillasBase}/${id}`, form);
  }

  eliminarPlantilla(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.plantillasBase}/${id}`);
  }

  urlFondo(path?: string): string {
    if (!path) return '';
    const p = path.replace(/^\//, '');
    return `${environment.uploadsUrl}/${p}`;
  }

  /** Ruta relativa bajo uploads/ (certificados/archivo.png) para el API de vista previa. */
  urlFondoRel(path?: string): string {
    if (!path) return '';
    const s = path.trim();
    if (!/^https?:\/\//i.test(s)) return s.replace(/^\/+/, '');
    const marker = '/uploads/';
    const i = s.indexOf(marker);
    if (i >= 0) return s.slice(i + marker.length);
    return s.replace(/^\/+/, '');
  }
}
