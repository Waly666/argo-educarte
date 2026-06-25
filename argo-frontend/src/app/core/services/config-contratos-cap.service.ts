import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface ReglaFiscalContratoCap {
  tipo: string;
  label: string;
  condicionIva: string;
  porcentajeIva: number;
  descuentoPorcentaje: number;
  reteIvaPorcentaje: number;
  reteFuentePorcentaje: number;
  reteIcaPorcentaje: number;
  responsabilidadFiscal: string;
  notas: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigContratosCapService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/config/contratos-cap-fiscal`;

  catalogos(): Observable<{
    tipos: { id: string; label: string }[];
    condicionesIva: { id: string; label: string }[];
  }> {
    return this.http.get<{
      tipos: { id: string; label: string }[];
      condicionesIva: { id: string; label: string }[];
    }>(`${this.base}/catalogos`);
  }

  obtener(): Observable<{ reglas: ReglaFiscalContratoCap[] }> {
    return this.http.get<{ reglas: ReglaFiscalContratoCap[] }>(this.base);
  }

  guardar(reglas: ReglaFiscalContratoCap[]): Observable<{ reglas: ReglaFiscalContratoCap[] }> {
    return this.http.put<{ reglas: ReglaFiscalContratoCap[] }>(this.base, { reglas });
  }
}
