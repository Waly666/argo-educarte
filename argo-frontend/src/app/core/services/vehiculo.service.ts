import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type {
  DocumentosRequeridosVehiculoRes,
  ValidacionDocumentosVehiculoRes,
} from './config-requisitos-documentos-vehiculos.service';

export interface VehiculoDto {
  _id?: string;
  placa: string;
  codigoMarca?: string;
  nombreMarca?: string;
  codigoLinea?: string | number;
  nombreLinea?: string;
  modelo?: string;
  idClase?: string | number;
  claseVehiculo?: string;
  idColor?: string | number;
  color?: string;
  tipoServicio?: string;
  carroceria?: string;
  modalidad?: string;
  cilindraje?: string;
  numeroMotor?: string;
  numeroChasis?: string;
  serie?: string;
  tonelaje?: string;
  pasajeros?: string;
  combustible?: string;
  numeroLicencia?: string;
  observaciones?: string;
  urlFoto?: string;
  estado?: string;
  fechaAudi?: string;
  userAddReg?: string;
  userChangeRecord?: string;
  fechaMod?: string;
  documentos?: DocVehiculoDto[];
}

export interface VehiculoIndicadores {
  docsVencidos?: number;
  docsPorVencer?: number;
  docsFaltantes?: number;
  totalDocumentos?: number;
  totalTiposCatalogo?: number;
  inspeccionPendiente?: boolean;
  inspeccionFecha?: string;
  ocupado?: boolean;
  sinFoto?: boolean;
  sinClase?: boolean;
}

export interface VehiculoListItem {
  _id: string;
  placa: string;
  codigoMarca?: string;
  nombreMarca?: string;
  codigoLinea?: string | number;
  nombreLinea?: string;
  modelo?: string;
  idClase?: string | number;
  claseVehiculo?: string;
  color?: string;
  tipoServicio?: string;
  carroceria?: string;
  modalidad?: string;
  combustible?: string;
  estado?: string;
  urlFoto?: string;
  indicadores?: VehiculoIndicadores;
}

export interface VehiculoListRes {
  items: VehiculoListItem[];
  total: number;
  page: number;
  pages: number;
}

export interface DocVehiculoDto {
  _id?: string;
  idDocVehi?: string | number;
  placa?: string;
  documento?: string;
  numero?: string;
  fechaExp?: string | null;
  fechaVence?: string | null;
  urlArchivo?: string;
  vencePronto?: boolean;
  vencido?: boolean;
  faltaFechaVence?: boolean;
  controlaVencimiento?: boolean;
}

export interface MarcaVehiculo {
  _id?: string;
  idMarca?: number;
  codigoMarca?: string;
  nombreMarca?: string;
}

export interface LineaVehiculo {
  _id?: string;
  idLinea?: number;
  codigoMarca?: string;
  codigoLinea?: string | number;
  nombreLinea?: string;
}

export interface ColorVehiculo {
  _id?: string;
  idcolor?: number;
  descripcion?: string;
}

export interface ClaseVehiculo {
  _id?: string;
  idClase?: number;
  descripcion?: string;
  carrocerias?: string;
  carroceriasLista?: string[];
  A1?: boolean;
  A2?: boolean;
  B1?: boolean;
  B2?: boolean;
  B3?: boolean;
  C1?: boolean;
  C2?: boolean;
  C3?: boolean;
}

export interface TipoDocumentoVehiculo {
  _id?: string;
  idDocVehi?: number;
  documentoVehi?: string;
}

export interface VehiculoMeta {
  tiposServicio: string[];
  modalidades: string[];
  combustibles: string[];
  estados: string[];
}

export interface VerificarPlacaRes {
  existe: boolean;
  vehiculo: { _id: string; placa: string; nombreMarca?: string; nombreLinea?: string; modelo?: string } | null;
}

export interface AlertaDocumentoVehiculo {
  placa: string;
  vehiculoId: string;
  idDocVehi: string;
  documento: string;
  fechaVence?: string | null;
  vencido?: boolean;
  vencePronto?: boolean;
  faltaFechaVence?: boolean;
  diasAvisoVencimiento?: number;
}

export interface AlertasDocumentosVehiculosRes {
  docsVencidos: number;
  docsPorVencer: number;
  totalAlertas: number;
  vehiculosAfectados: number;
  diasAvisoVencimiento: number;
  alertas: AlertaDocumentoVehiculo[];
}

export interface AlertaDocFaltanteVehiculo {
  placa: string;
  vehiculoId: string;
  idDocVehi: string;
  documento: string;
  claseVehiculo?: string;
}

export interface AlertasDocsFaltantesVehiculosRes {
  totalFaltantes: number;
  vehiculosAfectados: number;
  alertas: AlertaDocFaltanteVehiculo[];
}

const SKIP_FORM = new Set([
  '_id',
  'documentos',
  'fechaAudi',
  'userAddReg',
  'userChangeRecord',
  'fechaMod',
  'vencePronto',
  'vencido',
]);

@Injectable({ providedIn: 'root' })
export class VehiculoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/vehiculos`;

  meta(): Observable<VehiculoMeta> {
    return this.http.get<VehiculoMeta>(`${this.base}/meta`);
  }

  listarMarcas(q?: string): Observable<MarcaVehiculo[]> {
    let params = new HttpParams();
    if (q) params = params.set('q', q);
    return this.http.get<MarcaVehiculo[]>(`${this.base}/marcas`, { params });
  }

  listarLineas(codigoMarca: string, q?: string): Observable<LineaVehiculo[]> {
    let params = new HttpParams().set('codigoMarca', codigoMarca);
    if (q) params = params.set('q', q);
    return this.http.get<LineaVehiculo[]>(`${this.base}/lineas`, { params });
  }

  listarColores(q?: string): Observable<ColorVehiculo[]> {
    let params = new HttpParams();
    if (q) params = params.set('q', q);
    return this.http.get<ColorVehiculo[]>(`${this.base}/colores`, { params });
  }

  listarClases(): Observable<ClaseVehiculo[]> {
    return this.http.get<ClaseVehiculo[]>(`${this.base}/clases`);
  }

  listarTiposDocumento(): Observable<TipoDocumentoVehiculo[]> {
    return this.http.get<TipoDocumentoVehiculo[]>(`${this.base}/tipos-documento`);
  }

  verificarPlaca(placa: string, excluirId?: string): Observable<VerificarPlacaRes> {
    let params = new HttpParams();
    if (excluirId) params = params.set('excluirId', excluirId);
    return this.http.get<VerificarPlacaRes>(`${this.base}/verificar-placa/${encodeURIComponent(placa)}`, {
      params,
    });
  }

  listar(opts?: {
    q?: string;
    page?: number;
    limit?: number;
    sort?: string;
    dir?: 'asc' | 'desc';
  }): Observable<VehiculoListRes> {
    let params = new HttpParams();
    if (opts?.q) params = params.set('q', opts.q);
    if (opts?.page) params = params.set('page', String(opts.page));
    if (opts?.limit) params = params.set('limit', String(opts.limit));
    if (opts?.sort) params = params.set('sort', opts.sort);
    if (opts?.dir) params = params.set('dir', opts.dir);
    return this.http.get<VehiculoListRes>(this.base, { params });
  }

  /** Alertas globales de vencimiento — cualquier usuario autenticado. */
  alertasDocumentos(): Observable<AlertasDocumentosVehiculosRes> {
    return this.http.get<AlertasDocumentosVehiculosRes>(`${this.base}/alertas-documentos`);
  }

  alertasDocumentosFaltantes(): Observable<AlertasDocsFaltantesVehiculosRes> {
    return this.http.get<AlertasDocsFaltantesVehiculosRes>(`${this.base}/alertas-documentos-faltantes`);
  }

  obtener(id: string): Observable<VehiculoDto> {
    return this.http.get<VehiculoDto>(`${this.base}/${id}`);
  }

  crear(dto: VehiculoDto, foto?: File): Observable<VehiculoDto> {
    return this.http.post<VehiculoDto>(this.base, this.toForm(dto, foto));
  }

  actualizar(id: string, dto: VehiculoDto, foto?: File): Observable<VehiculoDto> {
    return this.http.put<VehiculoDto>(`${this.base}/${id}`, this.toForm(dto, foto));
  }

  eliminar(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}`);
  }

  documentosRequeridos(id: string): Observable<DocumentosRequeridosVehiculoRes> {
    return this.http.get<DocumentosRequeridosVehiculoRes>(`${this.base}/${id}/documentos-requeridos`);
  }

  validarDocumentos(id: string): Observable<ValidacionDocumentosVehiculoRes> {
    return this.http.get<ValidacionDocumentosVehiculoRes>(`${this.base}/${id}/documentos-validacion`);
  }

  crearDocumento(
    vehiculoId: string,
    data: Partial<DocVehiculoDto>,
    archivo?: File,
  ): Observable<DocVehiculoDto> {
    return this.http.post<DocVehiculoDto>(
      `${this.base}/${vehiculoId}/documentos`,
      this.toDocForm(data, archivo),
    );
  }

  actualizarDocumento(
    vehiculoId: string,
    docId: string,
    data: Partial<DocVehiculoDto>,
    archivo?: File,
  ): Observable<DocVehiculoDto> {
    return this.http.put<DocVehiculoDto>(
      `${this.base}/${vehiculoId}/documentos/${docId}`,
      this.toDocForm(data, archivo),
    );
  }

  eliminarDocumento(vehiculoId: string, docId: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${vehiculoId}/documentos/${docId}`);
  }

  private toForm(data: VehiculoDto, foto?: File): FormData {
    const form = new FormData();
    Object.entries(data || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || SKIP_FORM.has(k)) return;
      form.append(k, String(v));
    });
    if (foto) form.append('foto', foto);
    return form;
  }

  private toDocForm(data: Partial<DocVehiculoDto>, archivo?: File): FormData {
    const form = new FormData();
    Object.entries(data || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || k === '_id' || k === 'placa') return;
      form.append(k, String(v));
    });
    if (archivo) form.append('archivo', archivo);
    return form;
  }
}
