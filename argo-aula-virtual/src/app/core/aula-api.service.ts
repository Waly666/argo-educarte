import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  CalendarioCohorte,
  CategoriaVirtual,
  CohorteAlumno,
  CursoVirtual,
  CertificadoConsultaRes,
  CertificadoPortal,
  BlogPost,
  EstadoInscripcionVirtual,
  EvaluacionCohorteAlumno,
  IntentoEvalCohorte,
  MaterialCohorteAlumno,
  MatriculaVirtualRes,
  PortalAuthRes,
  PortalConfig,
  ProgresoVirtualResp,
  RegistroVerificacionRes,
  ResultadoIntentoCohorte,
} from './models';
import { rewriteCertificadoHtmlForPreview } from './certificado-mobile-html';
import { PortalAuthService } from './portal-auth.service';

@Injectable({ providedIn: 'root' })
export class AulaApiService {
  private http = inject(HttpClient);
  private auth = inject(PortalAuthService);
  private base = `${environment.apiUrl}/aula-virtual`;

  config(): Observable<PortalConfig> {
    return this.http.get<PortalConfig>(`${this.base}/config`);
  }

  listarBlog(): Observable<BlogPost[]> {
    return this.http.get<BlogPost[]>(`${this.base}/blog`);
  }

  blogPost(slug: string): Observable<BlogPost> {
    return this.http.get<BlogPost>(`${this.base}/blog/${encodeURIComponent(slug)}`);
  }

  categorias(): Observable<CategoriaVirtual[]> {
    return this.http.get<CategoriaVirtual[]>(`${this.base}/categorias`);
  }

  cursos(q = '', idCategoria?: number | null): Observable<CursoVirtual[]> {
    const parts: string[] = [];
    if (q) parts.push(`q=${encodeURIComponent(q)}`);
    if (idCategoria != null) parts.push(`idCategoria=${idCategoria}`);
    const params = parts.length ? `?${parts.join('&')}` : '';
    return this.http.get<CursoVirtual[]>(`${this.base}/cursos${params}`);
  }

  curso(id: string | number): Observable<CursoVirtual> {
    return this.http.get<CursoVirtual>(`${this.base}/cursos/${id}`);
  }

  login(email: string, password: string, turnstileToken?: string): Observable<PortalAuthRes> {
    return this.http.post<PortalAuthRes>(`${this.base}/auth/login`, {
      email,
      password,
      turnstileToken: turnstileToken || undefined,
    });
  }

  buscarAlumno(numDoc: string | number, turnstileToken?: string) {
    const q = new URLSearchParams({ numDoc: String(numDoc) });
    if (turnstileToken) q.set('turnstileToken', turnstileToken);
    return this.http.get<{
      numDoc: number;
      existeEnArgo: boolean;
      tieneCuentaPortal: boolean;
      emailPortal: string | null;
      alumno: Record<string, string | number | boolean> | null;
    }>(`${this.base}/auth/buscar-alumno?${q.toString()}`);
  }

  registro(body: Record<string, unknown>, turnstileToken?: string): Observable<PortalAuthRes> {
    return this.http.post<PortalAuthRes>(`${this.base}/auth/registro`, {
      ...body,
      turnstileToken: turnstileToken || undefined,
    });
  }

  registroSolicitar(
    body: Record<string, unknown>,
    turnstileToken?: string,
  ): Observable<RegistroVerificacionRes> {
    return this.http.post<RegistroVerificacionRes>(`${this.base}/auth/registro/solicitar`, {
      ...body,
      turnstileToken: turnstileToken || undefined,
    });
  }

  registroConfirmar(pendingId: string, codigo: string): Observable<PortalAuthRes> {
    return this.http.post<PortalAuthRes>(`${this.base}/auth/registro/confirmar`, { pendingId, codigo });
  }

  registroReenviarCodigo(pendingId: string): Observable<RegistroVerificacionRes> {
    return this.http.post<RegistroVerificacionRes>(`${this.base}/auth/registro/reenviar-codigo`, {
      pendingId,
    });
  }

  perfil(): Observable<{ usuario: { email: string; numDoc: number; empresaId?: string | null; empresaNombre?: string | null } }> {
    return this.http.get<{ usuario: { email: string; numDoc: number; empresaId?: string | null; empresaNombre?: string | null } }>(`${this.base}/auth/perfil`, {
      headers: this.auth.authHeader(),
    });
  }

  buscarEmpresas(q: string): Observable<{ _id: string; nombre: string; identificacion: string }[]> {
    return this.http.get<{ _id: string; nombre: string; identificacion: string }[]>(
      `${this.base}/empresas/buscar?q=${encodeURIComponent(q)}`,
      { headers: this.auth.authHeader() },
    );
  }

  buscarEmpresasPublico(q: string): Observable<{ _id: string; nombre: string; identificacion: string }[]> {
    return this.http.get<{ _id: string; nombre: string; identificacion: string }[]>(
      `${this.base}/empresas/buscar-publico?q=${encodeURIComponent(q)}`,
    );
  }

  actualizarEmpresa(empresaId: string | null): Observable<{ ok: boolean; empresaId: string | null; empresaNombre: string | null }> {
    return this.http.patch<{ ok: boolean; empresaId: string | null; empresaNombre: string | null }>(
      `${this.base}/auth/empresa`,
      { empresaId },
      { headers: this.auth.authHeader() },
    );
  }

  misCursos(): Observable<CursoVirtual[]> {
    return this.http.get<CursoVirtual[]>(`${this.base}/mis-cursos`, {
      headers: this.auth.authHeader(),
    });
  }

  misClasesPresenciales(): Observable<CohorteAlumno[]> {
    return this.http.get<CohorteAlumno[]>(`${this.base}/mis-clases-presenciales`, {
      headers: this.auth.authHeader(),
    });
  }

  calendarioCohorte(idCohorte: string): Observable<CalendarioCohorte> {
    return this.http.get<CalendarioCohorte>(
      `${this.base}/mis-clases-presenciales/${idCohorte}/calendario`,
      { headers: this.auth.authHeader() },
    );
  }

  asistirMeet(idClase: string): Observable<{ registradas: number }> {
    return this.http.post<{ registradas: number }>(
      `${this.base}/clases-cohorte/${idClase}/asistir-meet`,
      {},
      { headers: this.auth.authHeader() },
    );
  }

  evaluacionesCohorte(idCohorte: string): Observable<EvaluacionCohorteAlumno[]> {
    return this.http.get<EvaluacionCohorteAlumno[]>(
      `${this.base}/mis-clases-presenciales/${idCohorte}/evaluaciones`,
      { headers: this.auth.authHeader() },
    );
  }

  materialesCohorte(idCohorte: string): Observable<MaterialCohorteAlumno[]> {
    return this.http.get<MaterialCohorteAlumno[]>(
      `${this.base}/mis-clases-presenciales/${idCohorte}/materiales`,
      { headers: this.auth.authHeader() },
    );
  }

  iniciarIntentoCohorte(idEval: string): Observable<IntentoEvalCohorte> {
    return this.http.post<IntentoEvalCohorte>(
      `${this.base}/evaluaciones-cohorte/${idEval}/iniciar`,
      {},
      { headers: this.auth.authHeader() },
    );
  }

  enviarIntentoCohorte(
    idEval: string,
    respuestas: { idPregunta: string; seleccion: number[] }[],
  ): Observable<ResultadoIntentoCohorte> {
    return this.http.post<ResultadoIntentoCohorte>(
      `${this.base}/evaluaciones-cohorte/${idEval}/enviar`,
      { respuestas },
      { headers: this.auth.authHeader() },
    );
  }

  progreso(id: string | number): Observable<ProgresoVirtualResp> {
    return this.http.get<ProgresoVirtualResp>(`${this.base}/cursos/${id}/progreso`, {
      headers: this.auth.authHeader(),
    });
  }

  inscripcion(id: string | number): Observable<EstadoInscripcionVirtual> {
    return this.http.get<EstadoInscripcionVirtual>(`${this.base}/cursos/${id}/inscripcion`, {
      headers: this.auth.authHeader(),
    });
  }

  matricular(id: string | number): Observable<MatriculaVirtualRes> {
    return this.http.post<MatriculaVirtualRes>(
      `${this.base}/cursos/${id}/matricular`,
      {},
      { headers: this.auth.authHeader() },
    );
  }

  pasarelaPublica(): Observable<{ activo: boolean; ambiente?: string; publicKey?: string | null }> {
    return this.http.get<{ activo: boolean; ambiente?: string; publicKey?: string | null }>(
      `${environment.apiUrl}/pasarela/config/publico`,
    );
  }

  iniciarPagoEnLinea(
    id: string | number,
    redirectUrl?: string,
  ): Observable<{ checkoutUrl: string; montoCop: number; reference: string }> {
    return this.http.post<{ checkoutUrl: string; montoCop: number; reference: string }>(
      `${this.base}/cursos/${id}/pagar-linea`,
      redirectUrl ? { redirectUrl } : {},
      { headers: this.auth.authHeader() },
    );
  }

  consultarCertificados(numDoc: string | number, turnstileToken?: string): Observable<CertificadoConsultaRes> {
    const q = new URLSearchParams({ numDoc: String(numDoc) });
    if (turnstileToken) q.set('turnstileToken', turnstileToken);
    return this.http.get<CertificadoConsultaRes>(`${this.base}/certificados/consulta?${q.toString()}`);
  }

  enviarContacto(
    body: {
      nombre: string;
      email: string;
      telefono?: string;
      asunto?: string;
      mensaje: string;
      origen?: string;
    },
    turnstileToken?: string,
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/contacto`, {
      ...body,
      turnstileToken: turnstileToken || undefined,
    });
  }

  enviarPqr(
    body: {
      nombre: string;
      email: string;
      telefono?: string;
      numDoc?: string;
      tipo: string;
      mensaje: string;
    },
    turnstileToken?: string,
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/pqr`, {
      ...body,
      turnstileToken: turnstileToken || undefined,
    });
  }

  misCertificados(): Observable<CertificadoPortal[]> {
    return this.http.get<CertificadoPortal[]>(`${this.base}/mis-certificados`, {
      headers: this.auth.authHeader(),
    });
  }

  certificadoHtml(id: string): Observable<string> {
    return this.http.get(`${this.base}/certificados/${id}/html`, {
      headers: this.auth.authHeader(),
      responseType: 'text',
    });
  }

  abrirCertificado(id: string, onError?: (msg: string) => void): void {
    this.certificadoHtml(id).subscribe({
      next: (html) => {
        const w = window.open('', '_blank', 'width=920,height=720');
        if (!w) {
          onError?.('Permita ventanas emergentes para ver el certificado.');
          return;
        }
        const adapted = rewriteCertificadoHtmlForPreview(html);
        w.document.open();
        w.document.write(adapted);
        w.document.close();
        w.focus();
      },
      error: (e) => onError?.(e?.error?.message || 'No se pudo cargar el certificado.'),
    });
  }

  reciboHtml(idIngreso: string): Observable<string> {
    return this.http.get(`${this.base}/recibos/${idIngreso}/html`, {
      headers: this.auth.authHeader(),
      responseType: 'text',
    });
  }

  abrirRecibo(idIngreso: string, onError?: (msg: string) => void): void {
    if (!idIngreso) {
      onError?.('No hay recibo de pago disponible.');
      return;
    }
    const w = window.open('', '_blank', 'width=420,height=720');
    if (!w) {
      onError?.('Permita ventanas emergentes para ver el recibo.');
      return;
    }
    try {
      w.document.open();
      w.document.write('<p style="font-family:sans-serif;padding:1rem">Cargando recibo…</p>');
      w.document.close();
    } catch {
      /* ventana en blanco */
    }

    this.reciboHtml(idIngreso).subscribe({
      next: (html) => {
        try {
          w.document.open();
          w.document.write(html);
          w.document.close();
          w.focus();
        } catch {
          w.close();
          onError?.('No se pudo mostrar el recibo.');
        }
      },
      error: (e) => {
        try {
          w.close();
        } catch {
          /* ignore */
        }
        onError?.(e?.error?.message || 'No se pudo cargar el recibo de pago.');
      },
    });
  }
}
