import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface ConfigFormatoInspeccionVehiculos {
  clave?: string;
  prefijoConsecutivoInspeccion?: string;
  consecutivoInspeccion?: number;
  proximoConsecutivoInspeccion?: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigFormatoInspeccionVehiculosService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/config/formato-inspeccion-vehiculos`;

  obtener(): Observable<ConfigFormatoInspeccionVehiculos> {
    return this.http.get<ConfigFormatoInspeccionVehiculos>(this.base);
  }

  guardar(
    data: Pick<ConfigFormatoInspeccionVehiculos, 'prefijoConsecutivoInspeccion' | 'consecutivoInspeccion'>,
  ): Observable<ConfigFormatoInspeccionVehiculos> {
    return this.http.put<ConfigFormatoInspeccionVehiculos>(this.base, data);
  }
}
