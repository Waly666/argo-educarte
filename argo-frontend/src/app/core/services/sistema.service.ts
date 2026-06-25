import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { environment } from '../../../environments/environment';

/** Restauración / reset: pueden tardar varios minutos (BD + respaldo previo). */
const OPERACION_CRITICA_TIMEOUT_MS = 30 * 60 * 1000;

export interface RespaldoMeta {
  archivo: string;
  fecha: string;
  tipo: 'manual' | 'auto' | 'pre-reset' | 'pre-restauracion' | string;
  usuario?: string | null;
  nota?: string;
  tamano: number;
  sha256?: string;
  cifrado?: boolean;
  colecciones?: number;
  totalDocs?: number;
  duracionMs?: number;
}

export interface ConfigRespaldos {
  autoHabilitado: boolean;
  horaAuto: string;
  retencionDias: number;
  cifradoActivo: boolean;
}

export interface CredencialesOperacion {
  password: string;
  codigoMfa?: string;
  confirmacion: string;
  /** Vacío o omitido = reset completo; ids de módulo = reset parcial. */
  modulos?: string[];
}

export interface ResultadoRestauracion {
  colecciones: number;
  docsRestaurados: number;
  archivosRestaurados: number;
  respaldoSeguridad: string | null;
  mensaje?: string;
}

export interface ModuloReset {
  id: string;
  etiqueta: string;
  descripcion: string;
  advertencias: string[];
}

export interface InfoReset {
  fraseConfirmacion: string;
  modulos: ModuloReset[];
}

export interface ResultadoReset {
  respaldoPrevio: string;
  coleccionesLimpiadas: number;
  coleccionesConservadas: number;
  usuariosEliminados: number;
  tipoReset?: 'completo' | 'parcial';
  modulos?: string[];
  mensaje?: string;
}

export interface ProgresoOperacion {
  activo: boolean;
  tipo: 'respaldo' | 'restauracion' | 'reset' | 'migracion' | null;
  fase: string;
  total: number;
  hecho: number;
  porcentaje: number | null;
  estado: 'idle' | 'corriendo' | 'ok' | 'error';
  mensaje: string;
  transcurridoMs: number;
}

export interface ErrorMigracion {
  hoja: string;
  fila: number;
  mensaje: string;
}

export type HojaMigracion = 'programas' | 'alumnos' | 'matriculas' | 'pagos' | 'certificados';

export interface OpcionesIntegridadMigracion {
  /** Certificados sin exigir alumno ni programa en catálogo. */
  certificadosHistoricos?: boolean;
  modoIntegridad?: 'completa' | 'historica';
}

export interface ReporteValidacion {
  hojas: HojaMigracion[];
  opcionesIntegridad?: { modoIntegridad: string; certificadosHistoricos: boolean };
  ignoradas: string[];
  totales: Record<string, number>;
  validos: Record<string, number>;
  errores: ErrorMigracion[];
}

export interface ResultadoImportacion {
  lote: string;
  hojas: HojaMigracion[];
  ignoradas?: string[];
  programas: { creados: number; omitidos: number };
  alumnos: { creados: number; actualizados: number; omitidos: number };
  matriculas: { creadas: number; omitidas: number };
  pagos: { creados: number; omitidos: number };
  certificados: { creados: number; omitidos: number };
  filasConError: number;
  errores: ErrorMigracion[];
}

export interface LoteMigracion {
  lote: string;
  fecha: string;
  usuario: string;
  archivo: string;
  resultado?: Partial<ResultadoImportacion>;
}

export interface TablaColeccion {
  nombre: string;
  total: number;
  critica: boolean;
}

export interface RegistrosTabla {
  coleccion: string;
  columnas: string[];
  filas: Record<string, string>[];
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
  critica: boolean;
}

export interface MetaLimpiezaTablas {
  fraseVaciar: string;
  fraseBorrar: string;
  coleccionesCriticas: string[];
}

export interface ResultadoLimpiezaTabla {
  coleccion: string;
  eliminados: number;
  solicitados?: number;
  mensaje?: string;
}

@Injectable({ providedIn: 'root' })
export class SistemaService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/sistema`;

  // ----- Respaldos -----
  listarRespaldos(): Observable<{ respaldos: RespaldoMeta[]; config: ConfigRespaldos }> {
    return this.http.get<{ respaldos: RespaldoMeta[]; config: ConfigRespaldos }>(`${this.base}/respaldos`);
  }

  crearRespaldo(nota = ''): Observable<RespaldoMeta> {
    return this.http.post<RespaldoMeta>(`${this.base}/respaldos`, { nota });
  }

  descargarRespaldo(archivo: string): Observable<Blob> {
    return this.http.get(`${this.base}/respaldos/${encodeURIComponent(archivo)}/descargar`, {
      responseType: 'blob',
    });
  }

  eliminarRespaldo(archivo: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/respaldos/${encodeURIComponent(archivo)}`);
  }

  restaurarRespaldo(archivo: string, cred: CredencialesOperacion): Observable<ResultadoRestauracion> {
    return this.http
      .post<ResultadoRestauracion>(
        `${this.base}/respaldos/${encodeURIComponent(archivo)}/restaurar`,
        cred,
      )
      .pipe(timeout(OPERACION_CRITICA_TIMEOUT_MS));
  }

  restaurarSubido(file: File, cred: CredencialesOperacion): Observable<ResultadoRestauracion> {
    const fd = new FormData();
    fd.append('archivo', file);
    fd.append('password', cred.password);
    fd.append('codigoMfa', cred.codigoMfa || '');
    fd.append('confirmacion', cred.confirmacion);
    return this.http
      .post<ResultadoRestauracion>(`${this.base}/respaldos/restaurar-subido`, fd)
      .pipe(timeout(OPERACION_CRITICA_TIMEOUT_MS));
  }

  guardarConfigRespaldos(cfg: Partial<ConfigRespaldos>): Observable<ConfigRespaldos> {
    return this.http.put<ConfigRespaldos>(`${this.base}/respaldos/config`, cfg);
  }

  progresoOperacion(): Observable<ProgresoOperacion> {
    return this.http.get<ProgresoOperacion>(`${this.base}/respaldos/progreso`);
  }

  // ----- Puesta en cero -----
  infoReset(): Observable<InfoReset> {
    return this.http.get<InfoReset>(`${this.base}/reset-empresa`);
  }

  resetEmpresa(cred: CredencialesOperacion): Observable<ResultadoReset> {
    return this.http
      .post<ResultadoReset>(`${this.base}/reset-empresa`, cred)
      .pipe(timeout(OPERACION_CRITICA_TIMEOUT_MS));
  }

  // ----- Migración -----
  descargarPlantilla(hojas: HojaMigracion[], opts?: OpcionesIntegridadMigracion): Observable<Blob> {
    const params: Record<string, string> = { hojas: hojas.join(',') };
    if (opts?.certificadosHistoricos) {
      params['certificadosHistoricos'] = 'true';
      params['modoIntegridad'] = 'historica';
    }
    return this.http.get(`${this.base}/migracion/plantilla`, {
      responseType: 'blob',
      params,
    });
  }

  validarMigracion(
    file: File,
    hojas: HojaMigracion[],
    opts?: OpcionesIntegridadMigracion,
  ): Observable<ReporteValidacion> {
    const fd = new FormData();
    fd.append('archivo', file);
    fd.append('hojas', hojas.join(','));
    if (opts?.certificadosHistoricos) {
      fd.append('certificadosHistoricos', 'true');
      fd.append('modoIntegridad', 'historica');
    }
    return this.http.post<ReporteValidacion>(`${this.base}/migracion/validar`, fd);
  }

  importarMigracion(
    file: File,
    hojas: HojaMigracion[],
    actualizarExistentes: boolean,
    opts?: OpcionesIntegridadMigracion,
  ): Observable<ResultadoImportacion> {
    const fd = new FormData();
    fd.append('archivo', file);
    fd.append('hojas', hojas.join(','));
    fd.append('actualizarExistentes', String(actualizarExistentes));
    if (opts?.certificadosHistoricos) {
      fd.append('certificadosHistoricos', 'true');
      fd.append('modoIntegridad', 'historica');
    }
    return this.http.post<ResultadoImportacion>(`${this.base}/migracion/importar`, fd);
  }

  lotesMigracion(): Observable<LoteMigracion[]> {
    return this.http.get<LoteMigracion[]>(`${this.base}/migracion/lotes`);
  }

  // ----- Limpieza de tablas (soporte) -----
  metaLimpiezaTablas(): Observable<MetaLimpiezaTablas> {
    return this.http.get<MetaLimpiezaTablas>(`${this.base}/tablas/meta`);
  }

  listarTablas(): Observable<{ tablas: TablaColeccion[] }> {
    return this.http.get<{ tablas: TablaColeccion[] }>(`${this.base}/tablas`);
  }

  registrosTabla(
    nombre: string,
    page = 1,
    limit = 50,
    buscar = '',
  ): Observable<RegistrosTabla> {
    return this.http.get<RegistrosTabla>(`${this.base}/tablas/${encodeURIComponent(nombre)}/registros`, {
      params: {
        page: String(page),
        limit: String(limit),
        ...(buscar.trim() ? { buscar: buscar.trim() } : {}),
      },
    });
  }

  vaciarTabla(nombre: string, cred: CredencialesOperacion): Observable<ResultadoLimpiezaTabla> {
    return this.http.delete<ResultadoLimpiezaTabla>(
      `${this.base}/tablas/${encodeURIComponent(nombre)}/vaciar`,
      { body: cred },
    );
  }

  borrarRegistrosTabla(
    nombre: string,
    ids: string[],
    cred: CredencialesOperacion,
  ): Observable<ResultadoLimpiezaTabla> {
    return this.http.delete<ResultadoLimpiezaTabla>(
      `${this.base}/tablas/${encodeURIComponent(nombre)}/registros`,
      { body: { ...cred, ids } },
    );
  }
}
