import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface InspeccionItemCheck {
  id: string;
  idItem?: number;
  idCaracteristica?: number;
  nombre: string;
  si: boolean | null;
  observacion?: string;
}

export interface InspeccionChecklistGrupo {
  idItem: number;
  titulo: string;
  lineas: InspeccionItemCheck[];
}

export interface InspeccionVehiculoDto {
  _id?: string | null;
  placa: string;
  fecha: string;
  hora?: string;
  combustible?: string;
  entrega?: string;
  recibe?: string;
  quienEntrega?: string;
  quienRecibe?: string;
  inspector?: string;
  documentoInspector?: string;
  idEmpleadoInstructor?: number | null;
  nombreInstructor?: string;
  idClase?: string;
  claseVehiculo?: string;
  documentosVehiculo: InspeccionItemCheck[];
  documentosInstructor: InspeccionItemCheck[];
  grupos: InspeccionChecklistGrupo[];
  aptoLaborar?: boolean | null;
  observacionesGenerales?: string;
  consecutivo?: string;
  urlfotoLatDer?: string;
  urlfotoLatIzq?: string;
  urlfotoFrontal?: string;
  urlfotoPost?: string;
  guardada?: boolean;
  esPrimeraRevision?: boolean;
  fechaRevisionAnterior?: string | null;
  avisoRolInstructor?: string | null;
}

export interface InspeccionVehiculoResumen {
  _id: string;
  placa: string;
  fecha: string;
  hora?: string;
  nombreInstructor?: string;
  aptoLaborar?: boolean | null;
  consecutivo?: string;
  fechaMod?: string | null;
}

export interface InspeccionVehiculoListRes {
  placa: string;
  total: number;
  inspecciones: InspeccionVehiculoResumen[];
}

export interface AlertaInspeccionPendiente {
  placa: string;
  vehiculoId: string;
  claseVehiculo?: string;
  marcaLinea?: string;
}

export interface AlertasInspeccionPendienteRes {
  fecha: string;
  totalPendientes: number;
  vehiculosAfectados: number;
  alertas: AlertaInspeccionPendiente[];
}

@Injectable({ providedIn: 'root' })
export class InspeccionVehiculoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/vehiculos`;

  listar(vehiculoId: string, opts: { limit?: number; skip?: number } = {}): Observable<InspeccionVehiculoListRes> {
    let params = new URLSearchParams();
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.skip != null) params.set('skip', String(opts.skip));
    const q = params.toString();
    return this.http.get<InspeccionVehiculoListRes>(`${this.base}/${vehiculoId}/inspeccion${q ? `?${q}` : ''}`);
  }

  obtenerDelDia(vehiculoId: string, fecha?: string): Observable<InspeccionVehiculoDto> {
    const q = fecha ? `?fecha=${encodeURIComponent(fecha)}` : '';
    return this.http.get<InspeccionVehiculoDto>(`${this.base}/${vehiculoId}/inspeccion/hoy${q}`);
  }

  guardar(vehiculoId: string, dto: InspeccionVehiculoDto): Observable<InspeccionVehiculoDto> {
    return this.http.put<InspeccionVehiculoDto>(`${this.base}/${vehiculoId}/inspeccion`, dto);
  }

  alertasPendientes(): Observable<AlertasInspeccionPendienteRes> {
    return this.http.get<AlertasInspeccionPendienteRes>(`${this.base}/alertas-inspeccion-pendiente`);
  }

  imprimirHtml(vehiculoId: string, fecha?: string, onError?: (msg: string) => void): void {
    const params = new URLSearchParams();
    if (fecha) params.set('fecha', fecha);
    params.set('v', String(Date.now()));
    const url = `${this.base}/${vehiculoId}/inspeccion/imprimir?${params.toString()}`;
    this.http.get(url, { responseType: 'text' }).subscribe({
      next: (html) => {
        const w = window.open('', '_blank', 'width=920,height=900');
        if (!w) {
          onError?.('Permita ventanas emergentes para imprimir el informe.');
          return;
        }
        w.document.open();
        w.document.write(html);
        w.document.close();
      },
      error: (e) => onError?.(e?.error?.message || 'No se pudo generar el informe de inspección.'),
    });
  }
}
