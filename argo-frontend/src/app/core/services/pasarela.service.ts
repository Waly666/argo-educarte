import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface ConfigPasarela {
  activo?: boolean;
  ambiente?: 'sandbox' | 'production';
  publicKey?: string;
  privateKey?: string;
  integritySecret?: string;
  eventsSecret?: string;
  idSedeVirtual?: string;
  idCuentaBancaria?: string;
  idTipoPago?: string;
  redirectUrlBase?: string;
  webhookUrl?: string;
  webhookUrlSugerida?: string;
  updatedAt?: string | null;
}

export interface InformeMatriculasVirtuales {
  resumen: {
    totalMatriculas: number;
    pagadas: number;
    pendientes: number;
    valorTotal: number;
    saldoPendiente: number;
  };
  filas: Array<{
    idMatricula: string;
    numDoc: number | string;
    idPrograma?: string;
    fechaMatricula?: string;
    valorMatricula: number;
    pagada: string;
    saldo: number;
    abonado: number;
  }>;
  desde?: string | null;
  hasta?: string | null;
}

export interface InformeIngresosEnLinea {
  resumen: { cantidad: number; total: number };
  porDia: Array<{ dia: string; total: number }>;
  filas: Array<{
    idIngreso: string;
    numDoc: number | string;
    numRecibo?: string;
    valor: number;
    fecha?: string;
    concepto?: string;
  }>;
  desde?: string | null;
  hasta?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PasarelaService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/pasarela`;

  obtenerConfig(): Observable<ConfigPasarela> {
    return this.http.get<ConfigPasarela>(`${this.base}/config`);
  }

  guardarConfig(dto: ConfigPasarela): Observable<ConfigPasarela> {
    return this.http.put<ConfigPasarela>(`${this.base}/config`, dto);
  }

  informeMatriculas(desde?: string, hasta?: string): Observable<InformeMatriculasVirtuales> {
    const p = new URLSearchParams();
    if (desde) p.set('desde', desde);
    if (hasta) p.set('hasta', hasta);
    const q = p.toString();
    return this.http.get<InformeMatriculasVirtuales>(
      `${this.base}/informes/matriculas${q ? `?${q}` : ''}`,
    );
  }

  informeIngresos(desde?: string, hasta?: string): Observable<InformeIngresosEnLinea> {
    const p = new URLSearchParams();
    if (desde) p.set('desde', desde);
    if (hasta) p.set('hasta', hasta);
    const q = p.toString();
    return this.http.get<InformeIngresosEnLinea>(`${this.base}/informes/ingresos${q ? `?${q}` : ''}`);
  }

  exportMatriculas(desde?: string, hasta?: string): Observable<Blob> {
    const p = new URLSearchParams();
    if (desde) p.set('desde', desde);
    if (hasta) p.set('hasta', hasta);
    const q = p.toString();
    return this.http.get(`${this.base}/informes/matriculas/export${q ? `?${q}` : ''}`, {
      responseType: 'blob',
    });
  }

  exportIngresos(desde?: string, hasta?: string): Observable<Blob> {
    const p = new URLSearchParams();
    if (desde) p.set('desde', desde);
    if (hasta) p.set('hasta', hasta);
    const q = p.toString();
    return this.http.get(`${this.base}/informes/ingresos/export${q ? `?${q}` : ''}`, {
      responseType: 'blob',
    });
  }
}
