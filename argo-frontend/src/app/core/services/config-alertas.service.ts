import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export type VentanaInicioAlerta = 'desde_registro' | 'desde_inicio_dia';

export interface ReglaAlerta {
  key: string;
  label: string;
  grupoId: string;
  grupoLabel: string;
  activo: boolean;
  ventanaInicio: VentanaInicioAlerta;
  /** 0 = solo cierre manual */
  duracionMinutos: number;
  intervaloPollSegundos: number;
  antelacionMinutos: number;
  diasAntelacion: number;
  diasGracia: number;
}

export interface AlertasCatalogos {
  grupos: { id: string; label: string; alarmas: { key: string; label: string }[] }[];
  ventanasInicio: { id: VentanaInicioAlerta; label: string }[];
}

@Injectable({ providedIn: 'root' })
export class ConfigAlertasService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/config/alertas`;

  catalogos(): Observable<AlertasCatalogos> {
    return this.http.get<AlertasCatalogos>(`${this.base}/catalogos`);
  }

  obtener(): Observable<{ reglas: ReglaAlerta[] }> {
    return this.http.get<{ reglas: ReglaAlerta[] }>(this.base);
  }

  guardar(reglas: ReglaAlerta[]): Observable<{ reglas: ReglaAlerta[] }> {
    return this.http.put<{ reglas: ReglaAlerta[] }>(this.base, { reglas });
  }
}
