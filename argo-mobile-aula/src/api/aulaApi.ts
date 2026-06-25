import { apiFetch, apiFetchText } from './client';
import type {
  CalendarioCohorte,
  CategoriaVirtual,
  CertificadoConsultaRes,
  CertificadoPortal,
  CohorteAlumno,
  CursoVirtual,
  EstadoInscripcionVirtual,
  EvaluacionCohorteAlumno,
  IntentoEvalCohorte,
  MaterialCohorteAlumno,
  MatriculaVirtualRes,
  PasarelaPublicaConfig,
  PagoEnLineaRes,
  PortalAuthRes,
  PortalConfig,
  ProgresoVirtualResp,
  RegistroVerificacionRes,
  ResultadoIntentoCohorte,
} from './types';

const B = '/aula-virtual';

type AuthPublicConfig = {
  nombreEmpresa?: string;
  urlLogo?: string | null;
};

/** Config del portal; si falla el endpoint del aula, completa marca desde /auth/config (recibos). */
export async function fetchPortalConfig(): Promise<PortalConfig> {
  let cfg: Partial<PortalConfig> = {};

  try {
    cfg = await apiFetch<PortalConfig>(`${B}/config`, { auth: false });
  } catch {
    /* endpoint aula-virtual/config puede no existir en servidores antiguos */
  }

  try {
    const auth = await apiFetch<AuthPublicConfig>('/auth/config', { auth: false });
    if (auth.nombreEmpresa?.trim()) {
      cfg.nombreCea = cfg.nombreCea?.trim() || auth.nombreEmpresa.trim();
    }
    if (auth.urlLogo) {
      cfg.urlLogo = cfg.urlLogo?.trim() || auth.urlLogo;
      cfg.urlLogoAbsoluta = cfg.urlLogoAbsoluta?.trim() || auth.urlLogo;
    }
  } catch {
    /* sin respaldo de recibos */
  }

  const nombreCea = String(cfg.nombreCea || '').trim();

  return {
    nombreCea: nombreCea || 'CEA',
    heroTitulo: cfg.heroTitulo || 'Aula virtual',
    heroSubtitulo: cfg.heroSubtitulo || '',
    urlLogo: cfg.urlLogo,
    urlLogoAbsoluta: cfg.urlLogoAbsoluta,
    registroAbierto: cfg.registroAbierto,
    emailVerificacionRegistro: cfg.emailVerificacionRegistro,
    turnstileSiteKey: cfg.turnstileSiteKey,
    formularioContactoActivo: cfg.formularioContactoActivo,
    formularioPqrActivo: cfg.formularioPqrActivo,
    site: cfg.site,
    nit: cfg.nit,
    direccion: cfg.direccion,
    ciudad: cfg.ciudad,
    telefono: cfg.telefono,
    telefonoWhatsapp: cfg.telefonoWhatsapp,
    email: cfg.email,
  };
}

export function fetchCategorias(): Promise<CategoriaVirtual[]> {
  return apiFetch<CategoriaVirtual[]>(`${B}/categorias`, { auth: false }).then((rows) =>
    Array.isArray(rows) ? rows : [],
  );
}

export function fetchCursos(q = '', idCategoria?: number | null): Promise<CursoVirtual[]> {
  const parts: string[] = [];
  if (q) parts.push(`q=${encodeURIComponent(q)}`);
  if (idCategoria != null) parts.push(`idCategoria=${idCategoria}`);
  const qs = parts.length ? `?${parts.join('&')}` : '';
  return apiFetch<CursoVirtual[]>(`${B}/cursos${qs}`, { auth: false }).then((rows) =>
    Array.isArray(rows) ? rows : [],
  );
}

export function fetchCurso(id: string | number): Promise<CursoVirtual> {
  return apiFetch<CursoVirtual>(`${B}/cursos/${encodeURIComponent(String(id))}`, { auth: false });
}

export function buscarAlumnoRegistro(numDoc: string | number) {
  return apiFetch<{
    numDoc: number;
    existeEnArgo: boolean;
    tieneCuentaPortal: boolean;
    emailPortal: string | null;
    alumno: Record<string, string | number | boolean> | null;
  }>(`${B}/auth/buscar-alumno?numDoc=${encodeURIComponent(String(numDoc))}`, { auth: false });
}

export function registro(body: Record<string, unknown>): Promise<PortalAuthRes> {
  return apiFetch<PortalAuthRes>(`${B}/auth/registro`, {
    method: 'POST',
    auth: false,
    headers: { 'Content-Type': 'application/json', 'X-ARGO-Cliente': 'mobile' },
    body: JSON.stringify(body),
  });
}

export function registroSolicitar(body: Record<string, unknown>): Promise<RegistroVerificacionRes> {
  return apiFetch<RegistroVerificacionRes>(`${B}/auth/registro/solicitar`, {
    method: 'POST',
    auth: false,
    headers: { 'Content-Type': 'application/json', 'X-ARGO-Cliente': 'mobile' },
    body: JSON.stringify(body),
  });
}

export function registroConfirmar(pendingId: string, codigo: string): Promise<PortalAuthRes> {
  return apiFetch<PortalAuthRes>(`${B}/auth/registro/confirmar`, {
    method: 'POST',
    auth: false,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pendingId, codigo }),
  });
}

export function registroReenviarCodigo(pendingId: string): Promise<RegistroVerificacionRes> {
  return apiFetch<RegistroVerificacionRes>(`${B}/auth/registro/reenviar-codigo`, {
    method: 'POST',
    auth: false,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pendingId }),
  });
}

export function fetchPerfil() {
  return apiFetch<{
    usuario: { email: string; numDoc: number; empresaId?: string | null; empresaNombre?: string | null };
  }>(`${B}/auth/perfil`);
}

export function actualizarEmpresa(empresaId: string | null) {
  return apiFetch<{ ok: boolean; empresaId: string | null; empresaNombre: string | null }>(
    `${B}/auth/empresa`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId }),
    },
  );
}

export function buscarEmpresas(q: string) {
  return apiFetch<{ _id: string; nombre: string; identificacion: string }[]>(
    `${B}/empresas/buscar?q=${encodeURIComponent(q)}`,
  );
}

export function buscarEmpresasPublico(q: string) {
  return apiFetch<{ _id: string; nombre: string; identificacion: string }[]>(
    `${B}/empresas/buscar-publico?q=${encodeURIComponent(q)}`,
    { auth: false },
  );
}

export function fetchMisCursos(): Promise<CursoVirtual[]> {
  return apiFetch<CursoVirtual[]>(`${B}/mis-cursos?_=${Date.now()}`);
}

export function fetchMisClasesPresenciales(): Promise<CohorteAlumno[]> {
  return apiFetch<CohorteAlumno[]>(`${B}/mis-clases-presenciales`);
}

export function fetchCalendarioCohorte(idCohorte: string): Promise<CalendarioCohorte> {
  return apiFetch<CalendarioCohorte>(
    `${B}/mis-clases-presenciales/${encodeURIComponent(idCohorte)}/calendario`,
  );
}

export function asistirMeet(idClase: string) {
  return apiFetch<{ registradas: number }>(`${B}/clases-cohorte/${encodeURIComponent(idClase)}/asistir-meet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
}

export function fetchEvaluacionesCohorte(idCohorte: string): Promise<EvaluacionCohorteAlumno[]> {
  return apiFetch<EvaluacionCohorteAlumno[]>(
    `${B}/mis-clases-presenciales/${encodeURIComponent(idCohorte)}/evaluaciones`,
  );
}

export function fetchMaterialesCohorte(idCohorte: string): Promise<MaterialCohorteAlumno[]> {
  return apiFetch<MaterialCohorteAlumno[]>(
    `${B}/mis-clases-presenciales/${encodeURIComponent(idCohorte)}/materiales`,
  );
}

export function iniciarIntentoCohorte(idEval: string): Promise<IntentoEvalCohorte> {
  return apiFetch<IntentoEvalCohorte>(
    `${B}/evaluaciones-cohorte/${encodeURIComponent(idEval)}/iniciar`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  );
}

export function enviarIntentoCohorte(
  idEval: string,
  respuestas: { idPregunta: string; seleccion: number[] }[],
): Promise<ResultadoIntentoCohorte> {
  return apiFetch<ResultadoIntentoCohorte>(
    `${B}/evaluaciones-cohorte/${encodeURIComponent(idEval)}/enviar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ respuestas }),
    },
  );
}

export function fetchProgreso(id: string | number): Promise<ProgresoVirtualResp> {
  return apiFetch<ProgresoVirtualResp>(`${B}/cursos/${encodeURIComponent(String(id))}/progreso`);
}

export function fetchInscripcion(id: string | number): Promise<EstadoInscripcionVirtual> {
  return apiFetch<EstadoInscripcionVirtual>(`${B}/cursos/${encodeURIComponent(String(id))}/inscripcion`);
}

export function matricularCurso(id: string | number): Promise<MatriculaVirtualRes> {
  return apiFetch<MatriculaVirtualRes>(`${B}/cursos/${encodeURIComponent(String(id))}/matricular`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
}

/** Misma config pública que el portal web (Wompi). */
export function fetchPasarelaPublica(): Promise<PasarelaPublicaConfig> {
  return apiFetch<PasarelaPublicaConfig>('/pasarela/config/publico', { auth: false });
}

export function iniciarPagoEnLinea(
  id: string | number,
  redirectUrl?: string,
): Promise<PagoEnLineaRes> {
  return apiFetch<PagoEnLineaRes>(`${B}/cursos/${encodeURIComponent(String(id))}/pagar-linea`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(redirectUrl ? { redirectUrl } : {}),
  });
}

export function consultarCertificados(numDoc: string | number): Promise<CertificadoConsultaRes> {
  return apiFetch<CertificadoConsultaRes>(
    `${B}/certificados/consulta?numDoc=${encodeURIComponent(String(numDoc))}`,
    { auth: false },
  );
}

export function fetchMisCertificados(): Promise<CertificadoPortal[]> {
  return apiFetch<CertificadoPortal[]>(`${B}/mis-certificados`);
}

export function certificadoHtmlPath(id: string): string {
  return `${B}/certificados/${encodeURIComponent(id)}/html?v=${Date.now()}`;
}

export function reciboHtmlPath(idIngreso: string): string {
  return `${B}/recibos/${encodeURIComponent(idIngreso)}/html?v=${Date.now()}`;
}

export function fetchForoMensajes(idPrograma: string) {
  return apiFetch<{ mensajes: import('./types').MensajeForo[] }>(
    `/foro/cursos/${encodeURIComponent(idPrograma)}/mensajes?limit=200`,
  );
}

export function enviarContacto(body: Record<string, unknown>) {
  return apiFetch<{ message: string }>(`${B}/contacto`, {
    method: 'POST',
    auth: false,
    headers: { 'Content-Type': 'application/json', 'X-ARGO-Cliente': 'mobile' },
    body: JSON.stringify(body),
  });
}

export function enviarPqr(body: Record<string, unknown>) {
  return apiFetch<{ message: string }>(`${B}/pqr`, {
    method: 'POST',
    auth: false,
    headers: { 'Content-Type': 'application/json', 'X-ARGO-Cliente': 'mobile' },
    body: JSON.stringify(body),
  });
}

export { apiFetchText };
