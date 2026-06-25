import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PortalLandingConfig } from '../constants/portal-landing-defaults';
import { PortalSiteConfig } from '../constants/portal-site-defaults';

export type NivelVirtual = 'PRINCIPIANTE' | 'INTERMEDIO' | 'AVANZADO';
export const NIVELES_VIRTUAL: NivelVirtual[] = ['PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO'];

export interface VirtualConfig {
  idPrograma: string;
  publicadoPortal: boolean;
  modoCertificado: 'al_pagar' | 'al_aprobar';
  requierePagoParaCursar?: boolean;
  pctMinCompletitud: number;
  pctMinEvaluaciones: number;
  intentosMaxEval: number;
  indexHtml?: string;
  rutaPaquete?: string | null;
  idCategorias?: number[];
  nivel?: NivelVirtual | null;
  materiales?: MaterialVirtual[];
  sesionesMeet?: SesionMeet[];
}

export interface MaterialVirtual {
  _id?: string;
  titulo: string;
  tipo: string;
  url: string;
  orden?: number;
}

export interface SesionMeet {
  _id?: string;
  titulo: string;
  url: string;
  fecha?: string | null;
  obligatoria?: boolean;
}

export interface CategoriaVirtual {
  idCategoria: number;
  nombre: string;
  orden?: number;
  activo?: boolean;
}

export interface CursoVirtualAdmin {
  idPrograma: string;
  nombreProg: string;
  tarifaVirtual: number;
  descripcionVirtual?: string | null;
  horas?: number | null;
  urlPortadaVirtual?: string | null;
  urlPortadaAbsoluta?: string | null;
  idCategorias?: number[];
  categoriaNombres?: string[];
  categoriaNombre?: string | null;
  nivel?: NivelVirtual | null;
  autor?: string | null;
  publicadoPortal?: boolean;
  tienePaquete?: boolean;
  playerUrl?: string | null;
  config?: VirtualConfig;
}

export interface PortalAulaConfig {
  nombreEmpresa?: string;
  nit?: string;
  direccion?: string;
  ciudad?: string;
  telefono?: string;
  email?: string;
  heroTitulo: string;
  heroSubtitulo: string;
  acercaDeHtml?: string;
  landing?: PortalLandingConfig;
  telefonoWhatsapp?: string;
  emailContacto?: string;
  emailConfirmacion?: string;
  emailPqr?: string;
  site?: PortalSiteConfig;
  urlLogo?: string;
  urlLogoAbsoluta?: string | null;
  logoDesdeRecibos?: boolean;
  vistaPreviaEmpresa?: {
    nombreCea: string;
    nit?: string;
    direccion?: string;
    ciudad?: string;
    telefono?: string;
    email?: string;
  };
}

export interface UsuarioPortalAdmin {
  id: string;
  email: string;
  numDoc: number;
  activo: boolean;
  createdAt?: string;
  ultimoAcceso?: string | null;
  nombreCompleto?: string;
  celular?: string;
  tipoDoc?: string;
}

export interface UsuariosPortalRes {
  total: number;
  usuarios: UsuarioPortalAdmin[];
}

export interface CrearUsuarioPortalBody {
  email: string;
  password: string;
  alumno: {
    numDoc: number | string;
    tipoDoc?: string;
    apellido1?: string;
    apellido2?: string;
    nombre1?: string;
    nombre2?: string;
    celular?: string;
    expedida?: string;
  };
}

export interface CrearUsuarioPortalRes {
  ok: boolean;
  message: string;
  alumnoCreado: boolean;
  nombreCompleto: string;
  numDoc: number;
  usuarioPortal: {
    creado: boolean;
    actualizado: boolean;
    email: string;
    numDoc: number;
    passwordTemporal: string | null;
  };
}

export interface MatriculaVirtualAdminRes {
  yaMatriculado: boolean;
  message: string;
  usuarioPortal?: {
    creado: boolean;
    actualizado: boolean;
    email: string;
    numDoc: number;
    passwordTemporal: string | null;
  } | null;
  pago?: { pagado: boolean; saldo: number | null; valor: number | null };
}

export interface ProgresoAlumnoVirtualClase {
  numero: number;
  pct: number;
  aprobada: boolean;
}

export interface ProgresoAlumnoVirtualIntento {
  numero: number;
  nota: number;
  pctCompletitud: number;
  aprobado: boolean;
  fecha: string | null;
}

export interface ProgresoAlumnoVirtualItem {
  idMatricula: string;
  alumnoId: string | null;
  numDoc: number | string;
  nombreCompleto: string;
  celular: string | null;
  correo: string | null;
  emailPortal: string | null;
  fechaMat?: string;
  pago: {
    pagado: boolean;
    saldo: number;
    valorMat: number;
    pagada: string;
  };
  progreso: {
    pctCompletitud: number;
    promedioClases: number | null;
    clasesAprobadas: number;
    totalClases: number | null;
    clases: ProgresoAlumnoVirtualClase[];
    mejorNotaEval: number | null;
    ultimaNotaEval: number | null;
    intentosEval: number;
    intentosRestantes: number;
    intentos: ProgresoAlumnoVirtualIntento[];
    aprobado: boolean;
    cumpleCompletitud: boolean;
    cumpleNota: boolean;
    certificadoEmitido: boolean;
    sinIniciar: boolean;
    contadorSyncs: number;
    fechaUltimaActividad: string | null;
  };
  certificado: {
    codigoCert: string | null;
    fechaEmision: string | null;
    generadoAutoVirtual: boolean;
  } | null;
  portal: {
    activo: boolean;
    ultimoAcceso: string | null;
  };
  conexion: {
    codigo: string;
    label: string;
    enLinea: boolean;
  };
}

export interface ProgresoAlumnosVirtualRes {
  items: ProgresoAlumnoVirtualItem[];
  total: number;
  skip: number;
  limit: number;
  reglas: {
    modoCertificado: string;
    pctMinCompletitud: number;
    pctMinEvaluaciones: number;
    intentosMaxEval: number;
  } | null;
}

/** Payload al guardar curso: config virtual + ficha comercial editable. */
export interface GuardarCursoVirtualBody extends Partial<VirtualConfig> {
  descripcionVirtual?: string | null;
  horas?: number | null;
}

export interface BlogImagen {
  url: string;
  leyenda?: string;
}

export interface BlogPostAdmin {
  _id: string;
  titulo: string;
  slug: string;
  contenido: string;
  imagenes: BlogImagen[];
  autorNombre: string;
  autorId?: string | null;
  publicado: boolean;
  publicadoAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AulaVirtualAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/aula-virtual/admin`;

  listarCursos(): Observable<CursoVirtualAdmin[]> {
    return this.http.get<CursoVirtualAdmin[]>(`${this.base}/cursos`);
  }

  listarCategorias(): Observable<CategoriaVirtual[]> {
    return this.http.get<CategoriaVirtual[]>(`${this.base}/categorias`);
  }

  crearCategoria(body: Partial<CategoriaVirtual>): Observable<{ categoria: CategoriaVirtual; message: string }> {
    return this.http.post<{ categoria: CategoriaVirtual; message: string }>(`${this.base}/categorias`, body);
  }

  actualizarCategoria(
    id: number,
    body: Partial<CategoriaVirtual>,
  ): Observable<{ categoria: CategoriaVirtual; message: string }> {
    return this.http.put<{ categoria: CategoriaVirtual; message: string }>(`${this.base}/categorias/${id}`, body);
  }

  eliminarCategoria(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/categorias/${id}`);
  }

  listarUsuarios(q = ''): Observable<UsuariosPortalRes> {
    const params = q ? `?q=${encodeURIComponent(q)}` : '';
    return this.http.get<UsuariosPortalRes>(`${this.base}/usuarios${params}`);
  }

  eliminarUsuario(id: string): Observable<{ ok: boolean; message: string }> {
    return this.http.delete<{ ok: boolean; message: string }>(`${this.base}/usuarios/${id}`);
  }

  crearUsuario(body: CrearUsuarioPortalBody): Observable<CrearUsuarioPortalRes> {
    return this.http.post<CrearUsuarioPortalRes>(`${this.base}/usuarios`, body);
  }

  guardarConfig(id: string | number, body: GuardarCursoVirtualBody): Observable<{ config: VirtualConfig }> {
    return this.http.put<{ config: VirtualConfig }>(`${this.base}/cursos/${id}`, body);
  }

  subirPaquete(id: string | number, file: File): Observable<{ message: string; playerPath?: string }> {
    const fd = new FormData();
    fd.append('paquete', file);
    return this.http.post<{ message: string; playerPath?: string }>(`${this.base}/cursos/${id}/paquete`, fd);
  }

  subirPortada(id: string | number, file: File): Observable<{ urlPortadaVirtual: string; message: string }> {
    const fd = new FormData();
    fd.append('portada', file);
    return this.http.post<{ urlPortadaVirtual: string; message: string }>(`${this.base}/cursos/${id}/portada`, fd);
  }

  quitarPortada(id: string | number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/cursos/${id}/portada`);
  }

  subirMaterial(
    id: string | number,
    file: File,
    titulo?: string,
  ): Observable<{ message: string; config: VirtualConfig }> {
    const fd = new FormData();
    fd.append('archivo', file);
    if (titulo) fd.append('titulo', titulo);
    return this.http.post<{ message: string; config: VirtualConfig }>(
      `${this.base}/cursos/${id}/materiales`,
      fd,
    );
  }

  eliminarMaterial(id: string | number, materialId: string): Observable<{ config: VirtualConfig }> {
    return this.http.delete<{ config: VirtualConfig }>(`${this.base}/cursos/${id}/materiales/${materialId}`);
  }

  obtenerPortal(): Observable<PortalAulaConfig> {
    return this.http.get<PortalAulaConfig>(`${this.base}/portal`);
  }

  guardarPortal(body: PortalAulaConfig): Observable<{ config: PortalAulaConfig; message: string }> {
    return this.http.put<{ config: PortalAulaConfig; message: string }>(`${this.base}/portal`, body);
  }

  subirLogoPortal(file: File): Observable<{ config: PortalAulaConfig; message: string }> {
    const fd = new FormData();
    fd.append('logo', file);
    return this.http.post<{ config: PortalAulaConfig; message: string }>(`${this.base}/portal/logo`, fd);
  }

  quitarLogoPortal(): Observable<{ config: PortalAulaConfig; message: string }> {
    return this.http.delete<{ config: PortalAulaConfig; message: string }>(`${this.base}/portal/logo`);
  }

  subirImagenHeroPortal(file: File): Observable<{ config: PortalAulaConfig; message: string }> {
    const fd = new FormData();
    fd.append('imagen', file);
    return this.http.post<{ config: PortalAulaConfig; message: string }>(`${this.base}/portal/hero-imagen`, fd);
  }

  quitarImagenHeroPortal(): Observable<{ config: PortalAulaConfig; message: string }> {
    return this.http.delete<{ config: PortalAulaConfig; message: string }>(`${this.base}/portal/hero-imagen`);
  }

  matricularAlumno(
    idPrograma: string | number,
    body: {
      numDoc: number | string;
      email?: string;
      password?: string;
      crearUsuarioPortal?: boolean;
      observaciones?: string;
    },
  ): Observable<MatriculaVirtualAdminRes> {
    return this.http.post<MatriculaVirtualAdminRes>(`${this.base}/cursos/${idPrograma}/matricular`, body);
  }

  reintegrarBridge(idPrograma: string | number): Observable<{
    message: string;
    bridgeInyectado: number;
    bridgePaginas: number;
    storagePrefix?: string | null;
  }> {
    return this.http.post<{
      message: string;
      bridgeInyectado: number;
      bridgePaginas: number;
      storagePrefix?: string | null;
    }>(`${this.base}/cursos/${idPrograma}/reintegrar-bridge`, {});
  }

  listarProgresoAlumnos(
    idPrograma: string | number,
    params?: { q?: string; filtro?: string; skip?: number; limit?: number },
  ): Observable<ProgresoAlumnosVirtualRes> {
    const sp = new URLSearchParams();
    if (params?.q) sp.set('q', params.q);
    if (params?.filtro) sp.set('filtro', params.filtro);
    if (params?.skip != null) sp.set('skip', String(params.skip));
    if (params?.limit != null) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return this.http.get<ProgresoAlumnosVirtualRes>(
      `${this.base}/cursos/${idPrograma}/progreso-alumnos${qs ? `?${qs}` : ''}`,
    );
  }

  listarBlogPosts(): Observable<BlogPostAdmin[]> {
    return this.http.get<BlogPostAdmin[]>(`${this.base}/blog`);
  }

  obtenerBlogPost(id: string): Observable<BlogPostAdmin> {
    return this.http.get<BlogPostAdmin>(`${this.base}/blog/${id}`);
  }

  crearBlogPost(body: Partial<BlogPostAdmin>): Observable<{ post: BlogPostAdmin; message: string }> {
    return this.http.post<{ post: BlogPostAdmin; message: string }>(`${this.base}/blog`, body);
  }

  actualizarBlogPost(
    id: string,
    body: Partial<BlogPostAdmin>,
  ): Observable<{ post: BlogPostAdmin; message: string }> {
    return this.http.put<{ post: BlogPostAdmin; message: string }>(`${this.base}/blog/${id}`, body);
  }

  eliminarBlogPost(id: string): Observable<{ ok: boolean; message: string }> {
    return this.http.delete<{ ok: boolean; message: string }>(`${this.base}/blog/${id}`);
  }

  subirImagenBlog(file: File): Observable<{ url: string; message: string }> {
    const fd = new FormData();
    fd.append('imagen', file);
    return this.http.post<{ url: string; message: string }>(`${this.base}/blog/imagen`, fd);
  }
}
