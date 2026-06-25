import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface FspTramo {
  desdeSmmlv: number;
  hastaSmmlv: number | null;
  pct: number;
}

export interface RetencionTramo {
  hastaUvt: number | null;
  baseUvt: number;
  pct: number;
}

export interface ConfigNomina {
  vigenciaAno?: number;
  vigenciaLabel?: string;
  smlmv?: number;
  uvt?: number;
  auxilioTransporteMensual?: number;
  saludEmpleadoPct?: number;
  pensionEmpleadoPct?: number;
  saludEmpleadorPct?: number;
  pensionEmpleadorPct?: number;
  senaPct?: number;
  icbfPct?: number;
  ccfPct?: number;
  arlRiesgoPct?: Record<string, number>;
  arlRiesgoDefault?: number;
  multiploSalarioAuxilio?: number;
  retencionUmbralExentoSmmlv?: number;
  provisionCesantiasPct?: number;
  provisionPrimaPct?: number;
  provisionVacacionesPct?: number;
  provisionIntCesantiasPct?: number;
  fspTramos?: FspTramo[];
  retencionTramos?: RetencionTramo[];
  _fuente?: string;
  _actualizadoEn?: string | null;
}

export interface ConfigRecibo {
  _id?: string;
  clave?: string;
  nombreEmpresa?: string;
  nombreSede?: string;
  nit?: string;
  urlLogoDataUrl?: string | null;
  direccion?: string;
  ciudad?: string;
  departamento?: string;
  telefono?: string;
  email?: string;
  urlLogo?: string;
  prefijoFactura?: string;
  consecutivoFactura?: number;
  prefijoComprobanteIngreso?: string;
  consecutivoComprobanteIngreso?: number;
  usarPrefijoComprobanteIngreso?: boolean;
  usarSegundoPrefijoComprobanteIngreso?: boolean;
  segundoPrefijoComprobanteIngreso?: string;
  prefijoComprobanteEgreso?: string;
  consecutivoComprobanteEgreso?: number;
  usarPrefijoComprobanteEgreso?: boolean;
  usarSegundoPrefijoComprobanteEgreso?: boolean;
  segundoPrefijoComprobanteEgreso?: string;
  slogan1?: string;
  mensajeEncabezado?: string;
  mensajeEncabezadoEgreso?: string;
  mensajePie?: string;
  mensajePieEgreso?: string;
  mensajeCreacionAlumnoTitulo?: string;
  mensajeCreacionAlumno?: string;
  anchoReciboMm?: number;
  mostrarQr?: boolean;
  formatoComprobanteIngreso?: 'validadora' | 'media_carta';
  formatoComprobanteEgreso?: 'validadora' | 'media_carta';
  /** Rebaja de valor al crear matrícula (ficha alumno → Servicios). */
  permitirAjusteValorMatricula?: boolean;
  /** Cuotas personalizadas por semestre (presencial/mixta). */
  permitirAjusteCuotasSemestre?: boolean;
}

export interface ReciboOpcionesMatricula {
  permitirAjusteValorMatricula?: boolean;
  permitirAjusteCuotasSemestre?: boolean;
}

export interface GeorefProveedorOpcion {
  id: string;
  label: string;
}

export interface ConfigGeoref {
  proveedor?: string;
  hereAppId?: string;
  apiKeyConfigurada?: boolean;
  apiKeyEnmascarada?: string;
  _actualizadoEn?: string | null;
}

export interface GeorefMapaConfig {
  proveedor?: string;
  hereApiKey?: string;
}

export interface GeorefPruebaResultado {
  config: ConfigGeoref;
  resultado: {
    municipio: string;
    depto: string;
    codMunicipio: string | null;
    fuente: string;
    proveedor?: string;
    etiquetaMapa?: string | null;
  };
}

export interface ConfigFacturacion {
  proveedor?: string;
  ambiente?: string;
  baseUrl?: string;
  clientId?: string;
  clientSecretEnmascarado?: string;
  secretConfigurado?: boolean;
  username?: string;
  passwordEnmascarado?: string;
  passwordConfigurado?: boolean;
  numberingRangeId?: number | null;
  modoEmision?: string;
  valorIncluyeIva?: boolean;
  sendEmail?: boolean;
  activo?: boolean;
  emisorNit?: string;
  emisorDv?: string;
  emisorRazonSocial?: string;
  emisorResponsabilidadFiscal?: string;
  emisorRegimen?: string;
  emisorActividadEconomica?: string;
  emisorMunicipioCodigo?: string;
  ivaPorDefecto?: number;
  prefijoDesarrollo?: string;
  credencialesCompletas?: boolean;
  listoParaFactus?: boolean;
  _actualizadoEn?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private http = inject(HttpClient);

  obtenerRecibo(): Observable<ConfigRecibo> {
    return this.http.get<ConfigRecibo>(`${environment.apiUrl}/config/recibo`);
  }

  /** Encabezado operativo (institución + datos de la sede) para documentos de caja. */
  obtenerReciboEncabezado(idSede?: string | null): Observable<ConfigRecibo> {
    const params = idSede ? { idSede } : undefined;
    return this.http.get<ConfigRecibo>(`${environment.apiUrl}/config/recibo/encabezado`, { params });
  }

  guardarRecibo(data: ConfigRecibo): Observable<ConfigRecibo> {
    return this.http.put<ConfigRecibo>(`${environment.apiUrl}/config/recibo`, data);
  }

  /** Opciones de matrícula expuestas a caja (sin permiso config.recibos). */
  obtenerReciboOpcionesMatricula(): Observable<ReciboOpcionesMatricula> {
    return this.http.get<ReciboOpcionesMatricula>(
      `${environment.apiUrl}/config/recibo/opciones-matricula`,
    );
  }

  obtenerNomina(): Observable<ConfigNomina> {
    return this.http.get<ConfigNomina>(`${environment.apiUrl}/config/nomina`);
  }

  guardarNomina(data: ConfigNomina): Observable<ConfigNomina> {
    return this.http.put<ConfigNomina>(`${environment.apiUrl}/config/nomina`, data);
  }

  restaurarNominaDefaults(): Observable<ConfigNomina> {
    return this.http.post<ConfigNomina>(`${environment.apiUrl}/config/nomina/restaurar`, {});
  }

  listarProveedoresGeoref(): Observable<GeorefProveedorOpcion[]> {
    return this.http.get<GeorefProveedorOpcion[]>(`${environment.apiUrl}/config/georef/proveedores`);
  }

  obtenerGeoref(): Observable<ConfigGeoref> {
    return this.http.get<ConfigGeoref>(`${environment.apiUrl}/config/georef`);
  }

  /** Proveedor y credenciales para capas del mapa (usuarios autenticados). */
  obtenerGeorefMapa(): Observable<GeorefMapaConfig> {
    return this.http.get<GeorefMapaConfig>(`${environment.apiUrl}/config/georef/mapa`);
  }

  guardarGeoref(data: Partial<ConfigGeoref> & { hereApiKey?: string }): Observable<ConfigGeoref> {
    return this.http.put<ConfigGeoref>(`${environment.apiUrl}/config/georef`, data);
  }

  probarGeoref(lat: number, lng: number): Observable<GeorefPruebaResultado> {
    return this.http.post<GeorefPruebaResultado>(`${environment.apiUrl}/config/georef/probar`, { lat, lng });
  }

  catalogosFacturacion(): Observable<{
    proveedores: { id: string; label: string }[];
    ambientes: { id: string; label: string }[];
    modosEmision: { id: string; label: string }[];
  }> {
    return this.http.get<{
      proveedores: { id: string; label: string }[];
      ambientes: { id: string; label: string }[];
      modosEmision: { id: string; label: string }[];
    }>(`${environment.apiUrl}/config/facturacion/catalogos`);
  }

  obtenerFacturacion(): Observable<ConfigFacturacion> {
    return this.http.get<ConfigFacturacion>(`${environment.apiUrl}/config/facturacion`);
  }

  guardarFacturacion(
    data: Partial<ConfigFacturacion> & { clientSecret?: string; password?: string },
  ): Observable<ConfigFacturacion> {
    return this.http.put<ConfigFacturacion>(`${environment.apiUrl}/config/facturacion`, data);
  }

  probarFacturacion(): Observable<{ ok: boolean; message: string; modo?: string; expiresIn?: number }> {
    return this.http.post<{ ok: boolean; message: string; modo?: string; expiresIn?: number }>(
      `${environment.apiUrl}/config/facturacion/probar`,
      {},
    );
  }

  listarRangosFacturacion(): Observable<{
    ok: boolean;
    rangos: FactusRangoNumeracion[];
    sugeridoId?: number | null;
    sugeridoLabel?: string | null;
  }> {
    return this.http.get<{
      ok: boolean;
      rangos: FactusRangoNumeracion[];
      sugeridoId?: number | null;
      sugeridoLabel?: string | null;
    }>(`${environment.apiUrl}/config/facturacion/rangos`);
  }

  probarEmisionFacturacion(numberingRangeId?: number | null): Observable<FactusPruebaEmisionResultado> {
    return this.http.post<FactusPruebaEmisionResultado>(
      `${environment.apiUrl}/config/facturacion/probar-emision`,
      numberingRangeId != null ? { numberingRangeId } : {},
    );
  }

  limpiarPendientesFacturacion(todasPendientes = true): Observable<{
    eliminadas: number;
    omitidas: number;
    referencias: string[];
    message: string;
  }> {
    return this.http.post<{
      eliminadas: number;
      omitidas: number;
      referencias: string[];
      message: string;
    }>(`${environment.apiUrl}/config/facturacion/limpiar-pendientes-factus`, {
      todasPendientes,
    });
  }
}

export interface FactusRangoNumeracion {
  id: number;
  prefix: string;
  resolutionNumber: string;
  from: number | null;
  to: number | null;
  current?: number | null;
  isActive: boolean;
  esFacturaVenta?: boolean;
  documentType: string | null;
  label: string;
}

export interface FactusPruebaEmisionResultado {
  ok: boolean;
  message: string;
  referenceCode?: string;
  numeroFactura?: string;
  cufe?: string;
  isValidated?: boolean;
  urlPdf?: string;
  urlQr?: string;
  errors?: Record<string, string> | null;
}
