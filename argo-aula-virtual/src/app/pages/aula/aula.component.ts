import { CommonModule } from '@angular/common';
import { Component, ElementRef, computed, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';

import { AulaApiService } from '../../core/aula-api.service';
import { ForoChatComponent } from '../../components/foro-chat/foro-chat.component';
import {
  CalendarioCohorte,
  CertificadoPortal,
  ClaseProgresoVirtual,
  CohorteAlumno,
  CursoVirtual,
  EvaluacionCohorteAlumno,
  IntentoEvalCohorte,
  IntentoEvalVirtual,
  MaterialCohorteAlumno,
  PortalConfig,
  ReciboPortal,
  ResultadoIntentoCohorte,
} from '../../core/models';
import { PortalAuthService } from '../../core/portal-auth.service';
import { PortalSeoService } from '../../core/portal-seo.service';
import { resolveUploadUrl, resolveUploadsPath } from '../../core/upload-url.util';
import { environment } from '../../../environments/environment';

export type PanelAula = 'tablero' | 'cursos' | 'presenciales' | 'puntajes' | 'certificados' | 'perfil' | 'foro';

@Component({
  selector: 'av-aula',
  standalone: true,
  imports: [CommonModule, RouterLink, ForoChatComponent],
  templateUrl: './aula.component.html',
  styleUrl: './aula.component.scss',
})
export class AulaComponent implements OnInit, OnDestroy {
  auth = inject(PortalAuthService);
  private api = inject(AulaApiService);
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);
  private seo = inject(PortalSeoService);

  cursos = signal<CursoVirtual[]>([]);
  cohortes = signal<CohorteAlumno[]>([]);
  calendarioActivo = signal<CalendarioCohorte | null>(null);
  cohorteAbierta = signal<string | null>(null);
  evaluacionesCohorte = signal<EvaluacionCohorteAlumno[]>([]);
  materialesCohorte = signal<MaterialCohorteAlumno[]>([]);
  intentoActivo = signal<IntentoEvalCohorte | null>(null);
  respuestasIntento = signal<Record<string, number[]>>({});
  resultadoIntento = signal<ResultadoIntentoCohorte | null>(null);
  enviandoIntento = signal(false);
  certificados = signal<CertificadoPortal[]>([]);
  certificadosLoading = signal(false);
  certificadoError = signal('');
  reciboError = signal('');
  portalConfig = signal<PortalConfig | null>(null);
  panel = signal<PanelAula>('tablero');
  sidebarCollapsed = signal(false);
  mobileNavOpen = signal(false);

  safePlayerUrl = signal<SafeResourceUrl | null>(null);
  playerTitulo = signal('');
  playerForoId = signal<string | null>(null);
  playerForoNombre = signal('');
  cursoActivo = signal<CursoVirtual | null>(null);
  avisoPlayer = signal('');

  playerFrame = viewChild<ElementRef<HTMLIFrameElement>>('playerFrame');

  totalInscritos = computed(() => this.cursos().length);
  totalEnProgreso = computed(() => this.cursos().filter((c) => this.enProgreso(c)).length);
  totalCompletados = computed(() => this.cursos().filter((c) => this.completado(c)).length);
  totalCertificados = computed(() => this.certificados().length);

  cursosContinuar = computed(() =>
    [...this.cursos()]
      .filter((c) => this.enProgreso(c) || (this.pct(c) === 0 && c.tienePaquete))
      .sort((a, b) => this.pct(b) - this.pct(a))
      .slice(0, 4),
  );

  cursosConPuntajes = computed(() =>
    [...this.cursos()]
      .filter((c) => this.tieneHistorialPuntajes(c))
      .sort((a, b) => (this.mejorNota(b) ?? -1) - (this.mejorNota(a) ?? -1)),
  );

  cursosParaPuntajes = computed(() =>
    [...this.cursos()].sort((a, b) => this.pct(b) - this.pct(a) || String(a.nombreProg).localeCompare(String(b.nombreProg), 'es')),
  );

  resumenPuntajesGlobal = computed(() => {
    const cs = this.cursos();
    let leccionesAprobadas = 0;
    let leccionesTotal = 0;
    let leccionesConNota = 0;
    let intentosEval = 0;
    let sumaAvance = 0;
    let cursosConActividad = 0;

    for (const c of cs) {
      sumaAvance += this.pct(c);
      if (this.pct(c) > 0 || this.tieneHistorialPuntajes(c)) cursosConActividad++;
      leccionesAprobadas += c.progreso?.clasesAprobadas ?? 0;
      leccionesTotal += c.progreso?.totalClases ?? this.clasesDetalle(c).length;
      leccionesConNota += this.leccionesConNotaCount(c);
      intentosEval += c.progreso?.intentosEval ?? this.intentosDe(c).length;
    }

    return {
      cursos: cs.length,
      cursosConActividad,
      promedioAvance: cs.length ? Math.round(sumaAvance / cs.length) : 0,
      leccionesAprobadas,
      leccionesTotal,
      leccionesConNota,
      intentosEval,
    };
  });

  private onMessage = (ev: MessageEvent) => this.handleIframeMessage(ev);
  private onVisibility = () => {
    if (document.visibilityState === 'visible' && this.auth.isLoggedIn()) {
      this.cargarCursos();
      this.cargarCertificados();
    }
  };

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private initTimers: ReturnType<typeof setTimeout>[] = [];

  ngOnInit() {
    this.api.config().subscribe({
      next: (c) => {
        this.portalConfig.set(c);
        this.seo.applyAula(c);
      },
      error: () => {
        this.portalConfig.set(null);
        this.seo.applyAula(null);
      },
    });
    if (!this.auth.isLoggedIn()) return;
    this.cargarCursos();
    this.cargarCertificados();
    this.cargarCohortes();
    window.addEventListener('message', this.onMessage);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  ngOnDestroy() {
    window.removeEventListener('message', this.onMessage);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.detenerPoll();
    this.initTimers.forEach(clearTimeout);
  }

  irPanel(p: PanelAula) {
    this.panel.set(p);
    this.mobileNavOpen.set(false);
  }

  toggleMobileNav() {
    this.mobileNavOpen.update((v) => !v);
  }

  cerrarMobileNav() {
    this.mobileNavOpen.set(false);
  }

  tituloPanel(): string {
    const labels: Record<PanelAula, string> = {
      tablero: 'Tablero',
      cursos: 'Tus cursos',
      presenciales: 'Mis clases presenciales',
      puntajes: 'Mis puntajes',
      certificados: 'Certificados',
      perfil: 'Perfil',
      foro: 'Foro de cursos',
    };
    return labels[this.panel()] || 'Mi aula';
  }

  toggleSidebar() {
    this.sidebarCollapsed.update((v) => !v);
  }

  pct(c: CursoVirtual): number {
    return c.progreso?.pctCompletitud ?? 0;
  }

  completado(c: CursoVirtual): boolean {
    const p = c.progreso;
    return !!(p?.aprobado || p?.certificadoEmitido || this.pct(c) >= 100);
  }

  enProgreso(c: CursoVirtual): boolean {
    return this.pct(c) > 0 && !this.completado(c);
  }

  portada(c: CursoVirtual): string | null {
    return resolveUploadUrl(c.urlPortadaAbsoluta || c.urlPortadaVirtual);
  }

  portalLogo(): string | null {
    const cfg = this.portalConfig();
    return resolveUploadUrl(cfg?.urlLogoAbsoluta || cfg?.urlLogo);
  }

  etiquetas(c: CursoVirtual): string[] {
    if (c.categoriaNombres?.length) return c.categoriaNombres.slice(0, 2);
    if (c.categoriaNombre) return [c.categoriaNombre];
    if (c.nivel) return [c.nivel];
    return ['Curso virtual'];
  }

  fechaInicio(c: CursoVirtual): string {
    const f = c.matricula?.fechaMat;
    if (!f) return '—';
    const d = new Date(f);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-CO', { dateStyle: 'medium' });
  }

  saludo(): string {
    const u = this.auth.user();
    return u?.nombreCompleto?.trim() || u?.email?.split('@')[0] || 'estudiante';
  }

  intentosDe(c: CursoVirtual): IntentoEvalVirtual[] {
    return c.progreso?.intentos || [];
  }

  clasesConNota(c: CursoVirtual): ClaseProgresoVirtual[] {
    return this.clasesDetalle(c).filter((cl) => cl.pct > 0);
  }

  clasesDetalle(c: CursoVirtual): ClaseProgresoVirtual[] {
    const total = Math.max(c.progreso?.totalClases ?? 0, ...(c.progreso?.clases || []).map((cl) => cl.numero), 7);
    const map = new Map((c.progreso?.clases || []).map((cl) => [cl.numero, cl]));
    const out: ClaseProgresoVirtual[] = [];
    for (let i = 1; i <= total; i++) {
      out.push(map.get(i) ?? { numero: i, pct: 0, aprobada: false });
    }
    return out;
  }

  leccionesConNotaCount(c: CursoVirtual): number {
    return this.clasesConNota(c).length;
  }

  promedioLecciones(c: CursoVirtual): number | null {
    const p = c.progreso?.promedioClases;
    return p != null ? p : null;
  }

  pctMinCompletitud(c: CursoVirtual): number {
    return c.reglas?.pctMinCompletitud ?? c.pctMinCompletitud ?? 80;
  }

  intentosMaxEval(c: CursoVirtual): number {
    return c.reglas?.intentosMaxEval ?? c.intentosMaxEval ?? 3;
  }

  intentosRestantes(c: CursoVirtual): number {
    return c.reglas?.intentosRestantes ?? Math.max(0, this.intentosMaxEval(c) - (c.progreso?.intentosEval ?? 0));
  }

  cumpleCompletitud(c: CursoVirtual): boolean {
    if (c.reglas?.cumpleCompletitud != null) return c.reglas.cumpleCompletitud;
    return this.pct(c) >= this.pctMinCompletitud(c);
  }

  cumpleNotaEval(c: CursoVirtual): boolean {
    if (c.reglas?.cumpleNota != null) return c.reglas.cumpleNota;
    const mn = this.mejorNota(c);
    return mn != null && mn >= this.notaMinima(c);
  }

  ultimaNotaEval(c: CursoVirtual): number | null {
    const p = c.progreso;
    if (p?.ultimaNotaEval != null && p.ultimaNotaEval > 0) return p.ultimaNotaEval;
    const intentos = this.intentosDe(c);
    if (!intentos.length) return null;
    return intentos[intentos.length - 1].nota;
  }

  sumaPuntajesLecciones(c: CursoVirtual): number {
    return this.clasesDetalle(c).reduce((acc, cl) => acc + cl.pct, 0);
  }

  estadoCursoPuntajes(c: CursoVirtual): string {
    if (c.progreso?.certificadoEmitido) return 'Certificado emitido';
    if (c.progreso?.aprobado) return 'Aprobado';
    if (this.pct(c) > 0 || this.tieneHistorialPuntajes(c)) return 'En progreso';
    return 'Sin iniciar';
  }

  tonoEstadoCurso(c: CursoVirtual): string {
    if (c.progreso?.certificadoEmitido) return 'cyan';
    if (c.progreso?.aprobado) return 'green';
    if (this.pct(c) > 0 || this.tieneHistorialPuntajes(c)) return 'amber';
    return 'soft';
  }

  tieneHistorialPuntajes(c: CursoVirtual): boolean {
    return (
      this.intentosDe(c).length > 0 ||
      this.clasesConNota(c).length > 0 ||
      c.progreso?.mejorNotaEval != null ||
      (c.progreso?.ultimaNotaEval != null && c.progreso.ultimaNotaEval > 0)
    );
  }

  mejorNota(c: CursoVirtual): number | null {
    const p = c.progreso;
    if (p?.mejorNotaEval != null) return p.mejorNotaEval;
    const intentos = this.intentosDe(c);
    if (!intentos.length) return null;
    return Math.max(...intentos.map((i) => i.nota));
  }

  notaMinima(c: CursoVirtual): number {
    return c.reglas?.pctMinEvaluaciones ?? 60;
  }

  notaClaseAprobada(): number {
    return 70;
  }

  fechaIntento(f?: string | null): string {
    if (!f) return '—';
    const d = new Date(f);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  }

  claseNotaTone(pct: number): 'ok' | 'mid' | 'low' {
    if (pct >= this.notaClaseAprobada()) return 'ok';
    if (pct >= 50) return 'mid';
    return 'low';
  }

  notaTone(nota: number, min = 60): 'ok' | 'mid' | 'low' {
    if (nota >= min) return 'ok';
    if (nota >= min - 15) return 'mid';
    return 'low';
  }

  cargarCursos() {
    this.api.misCursos().subscribe({
      next: (rows) => this.cursos.set(rows),
      error: () => this.cursos.set([]),
    });
  }

  cargarCohortes() {
    this.api.misClasesPresenciales().subscribe({
      next: (rows) => this.cohortes.set(rows || []),
      error: () => this.cohortes.set([]),
    });
  }

  tienePresenciales = computed(() => this.cohortes().length > 0);

  abrirCalendario(c: CohorteAlumno) {
    if (this.cohorteAbierta() === c.idCohorte) {
      this.cohorteAbierta.set(null);
      this.calendarioActivo.set(null);
      this.evaluacionesCohorte.set([]);
      this.materialesCohorte.set([]);
      return;
    }
    this.cohorteAbierta.set(c.idCohorte);
    this.calendarioActivo.set(null);
    this.evaluacionesCohorte.set([]);
    this.materialesCohorte.set([]);
    this.api.calendarioCohorte(c.idCohorte).subscribe({
      next: (cal) => this.calendarioActivo.set(cal),
      error: () => this.calendarioActivo.set(null),
    });
    this.api.evaluacionesCohorte(c.idCohorte).subscribe({
      next: (rows) => this.evaluacionesCohorte.set(rows || []),
      error: () => this.evaluacionesCohorte.set([]),
    });
    this.api.materialesCohorte(c.idCohorte).subscribe({
      next: (rows) => this.materialesCohorte.set(rows || []),
      error: () => this.materialesCohorte.set([]),
    });
  }

  /* ---- Evaluaciones del alumno ---- */

  iniciarEvaluacion(ev: EvaluacionCohorteAlumno) {
    this.resultadoIntento.set(null);
    this.api.iniciarIntentoCohorte(ev.idEvaluacion).subscribe({
      next: (it) => {
        this.respuestasIntento.set({});
        this.intentoActivo.set(it);
      },
      error: () => {},
    });
  }

  estaSeleccionada(idPregunta: string, idx: number): boolean {
    return (this.respuestasIntento()[idPregunta] || []).includes(idx);
  }

  toggleOpcion(idPregunta: string, idx: number, tipo: string) {
    const actual = { ...this.respuestasIntento() };
    const prev = actual[idPregunta] || [];
    if (tipo === 'MULTIPLE') {
      actual[idPregunta] = prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx];
    } else {
      actual[idPregunta] = [idx];
    }
    this.respuestasIntento.set(actual);
  }

  enviarEvaluacion() {
    const it = this.intentoActivo();
    if (!it) return;
    const respuestas = it.preguntas.map((p) => ({
      idPregunta: p.idPregunta,
      seleccion: this.respuestasIntento()[p.idPregunta] || [],
    }));
    this.enviandoIntento.set(true);
    this.api.enviarIntentoCohorte(it.idEvaluacion, respuestas).subscribe({
      next: (r) => {
        this.enviandoIntento.set(false);
        this.intentoActivo.set(null);
        this.resultadoIntento.set(r);
        const id = this.cohorteAbierta();
        if (id) {
          this.api.evaluacionesCohorte(id).subscribe({
            next: (rows) => this.evaluacionesCohorte.set(rows || []),
          });
        }
      },
      error: () => this.enviandoIntento.set(false),
    });
  }

  cerrarIntento() {
    this.intentoActivo.set(null);
  }

  cerrarResultado() {
    this.resultadoIntento.set(null);
  }

  entrarMeet(idClase: string, url?: string) {
    if (url) window.open(url, '_blank', 'noopener');
    this.api.asistirMeet(idClase).subscribe({
      next: () => {
        const cohorteId = this.cohorteAbierta();
        if (cohorteId) {
          this.api.calendarioCohorte(cohorteId).subscribe({
            next: (cal) => this.calendarioActivo.set(cal),
          });
        }
        this.cargarCohortes();
      },
      error: () => {},
    });
  }

  cargarCertificados() {
    this.certificadosLoading.set(true);
    this.api.misCertificados().subscribe({
      next: (rows) => {
        this.certificados.set(rows || []);
        this.certificadosLoading.set(false);
      },
      error: () => {
        this.certificados.set([]);
        this.certificadosLoading.set(false);
      },
    });
  }

  certificadoDeCurso(idPrograma: string | number): CertificadoPortal | undefined {
    return this.certificados().find((c) => String(c.idProg) === String(idPrograma));
  }

  verCertificado(cert: CertificadoPortal) {
    this.certificadoError.set('');
    this.api.abrirCertificado(cert._id, (msg) => this.certificadoError.set(msg));
  }

  imprimirCertificado(cert: CertificadoPortal) {
    this.verCertificado(cert);
  }

  reciboDeCurso(c: CursoVirtual): ReciboPortal | null {
    return c.pago?.recibo || null;
  }

  imprimirRecibo(idIngreso: string | null | undefined) {
    this.reciboError.set('');
    this.api.abrirRecibo(idIngreso || '', (msg) => this.reciboError.set(msg));
  }

  imprimirReciboCert(cert: CertificadoPortal) {
    this.imprimirRecibo(cert.recibo?.idIngreso);
  }

  imprimirReciboCurso(c: CursoVirtual) {
    this.imprimirRecibo(this.idReciboCurso(c));
  }

  idReciboCurso(c: CursoVirtual): string | null {
    const cert = this.certificadoDeCurso(c.idPrograma);
    return cert?.recibo?.idIngreso || this.reciboDeCurso(c)?.idIngreso || null;
  }

  fechaCert(f?: string | null): string {
    if (!f) return '—';
    const d = new Date(f);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-CO', { dateStyle: 'medium' });
  }

  tituloCert(cert: CertificadoPortal): string {
    return cert.encabezado || cert.nomCert || cert.programaDescr || 'Certificado';
  }

  puedeCursar(c: CursoVirtual): boolean {
    if (c.puedeCursar === false) return false;
    if (c.accesoBloqueadoPago) return false;
    if (c.requierePagoParaCursar && c.pago && !c.pago.pagado) return false;
    return !!c.tienePaquete;
  }

  abrir(curso: CursoVirtual) {
    if (!this.puedeCursar(curso)) {
      this.avisoPlayer.set('Complete el pago en el CEA para acceder a este curso.');
      return;
    }
    if (!curso.playerUrl) return;
    this.mobileNavOpen.set(false);
    const full = this.resolverPlayerUrl(curso.playerUrl);
    this.safePlayerUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(full));
    this.playerTitulo.set(curso.nombreProg);
    this.playerForoId.set(String(curso.idPrograma));
    this.playerForoNombre.set(curso.nombreProg);
    this.cursoActivo.set(curso);
    this.avisoPlayer.set('');
    this.iniciarPoll(curso);
  }

  cerrarPlayer() {
    this.detenerPoll();
    this.initTimers.forEach(clearTimeout);
    this.initTimers = [];

    const curso = this.cursoActivo();
    const frame = this.playerFrame()?.nativeElement;
    if (frame?.contentWindow) {
      frame.contentWindow.postMessage({ type: 'ARGO_SYNC_REQUEST' }, '*');
    }

    const finalizar = () => {
      this.safePlayerUrl.set(null);
      this.playerTitulo.set('');
      this.playerForoId.set(null);
      this.playerForoNombre.set('');
      this.cursoActivo.set(null);
      this.avisoPlayer.set('');
      this.cargarCursos();
      this.cargarCertificados();
    };

    if (curso) {
      setTimeout(() => {
        this.api.progreso(curso.idPrograma).subscribe({
          next: (data) => {
            this.aplicarProgreso(String(curso.idPrograma), data.progreso, data.reglas);
            finalizar();
          },
          error: () => finalizar(),
        });
      }, 700);
      return;
    }

    finalizar();
  }

  onIframeLoad() {
    this.enviarInitAlIframe();
    this.initTimers.forEach(clearTimeout);
    this.initTimers = [
      setTimeout(() => this.enviarInitAlIframe(), 600),
      setTimeout(() => this.enviarInitAlIframe(), 1800),
    ];
  }

  logout() {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }

  // ── Foro de cursos ──
  foroIdPrograma  = signal<string | null>(null);
  foroNombreCurso = signal('');

  seleccionarForoCurso(c: CursoVirtual) {
    this.foroIdPrograma.set(String(c.idPrograma));
    this.foroNombreCurso.set(c.nombreProg);
  }

  String = String;

  // ── Empresa en perfil ──
  empresaEditando   = signal(false);
  empresaBusqueda   = signal('');
  empresaSugerencias = signal<{ _id: string; nombre: string; identificacion: string }[]>([]);
  empresaDropdownOpen = signal(false);
  empresaCargando   = signal(false);
  empresaMsgOk      = signal<string | null>(null);
  empresaMsgErr     = signal<string | null>(null);

  iniciarCambioEmpresa() {
    this.empresaEditando.set(true);
    this.empresaBusqueda.set('');
    this.empresaSugerencias.set([]);
    this.empresaDropdownOpen.set(false);
    this.empresaMsgOk.set(null);
    this.empresaMsgErr.set(null);
  }

  cancelarCambioEmpresa() {
    this.empresaEditando.set(false);
    this.empresaBusqueda.set('');
    this.empresaSugerencias.set([]);
    this.empresaDropdownOpen.set(false);
  }

  buscarEmpresaPerfil(q: string) {
    this.empresaBusqueda.set(q);
    if (!q.trim() || q.trim().length < 2) { this.empresaSugerencias.set([]); this.empresaDropdownOpen.set(false); return; }
    this.empresaCargando.set(true);
    this.api.buscarEmpresas(q.trim()).subscribe({
      next: (rows) => { this.empresaSugerencias.set(rows); this.empresaDropdownOpen.set(rows.length > 0); this.empresaCargando.set(false); },
      error: () => this.empresaCargando.set(false),
    });
  }

  onEmpresaBlurPerfil() { setTimeout(() => this.empresaDropdownOpen.set(false), 200); }

  seleccionarEmpresaPerfil(e: { _id: string; nombre: string; identificacion: string }) {
    this.empresaDropdownOpen.set(false);
    this.empresaSugerencias.set([]);
    this.empresaCargando.set(true);
    this.api.actualizarEmpresa(e._id).subscribe({
      next: (res) => {
        this.auth.updateEmpresa(res.empresaId, res.empresaNombre);
        this.empresaMsgOk.set(`Empresa vinculada: ${res.empresaNombre}`);
        this.empresaMsgErr.set(null);
        this.empresaEditando.set(false);
        this.empresaCargando.set(false);
      },
      error: (err) => {
        this.empresaMsgErr.set(err?.error?.message || 'Error al guardar la empresa.');
        this.empresaMsgOk.set(null);
        this.empresaCargando.set(false);
      },
    });
  }

  quitarEmpresa() {
    this.api.actualizarEmpresa(null).subscribe({
      next: () => { this.auth.updateEmpresa(null, null); },
      error: () => {},
    });
  }

  private resolverPlayerUrl(raw: string): string {
    const rel = resolveUploadsPath(raw);
    if (rel) return rel;
    return raw.startsWith('/') ? raw : `/${raw.replace(/^\/+/, '')}`;
  }

  private enviarInitAlIframe() {
    const curso = this.cursoActivo();
    const token = this.auth.token();
    const frame = this.playerFrame()?.nativeElement;
    if (!curso || !token || !frame?.contentWindow) return;

    const payload = {
      type: 'ARGO_INIT',
      apiUrl: `${environment.apiUrl}/aula-virtual`,
      token,
      idPrograma: String(curso.idPrograma),
      storagePrefix: curso.storagePrefix || undefined,
    };
    frame.contentWindow.postMessage(payload, '*');
    frame.contentWindow.postMessage({ type: 'ARGO_SYNC_REQUEST' }, '*');
  }

  private iniciarPoll(curso: CursoVirtual) {
    this.detenerPoll();
    this.pollTimer = setInterval(() => this.refrescarProgreso(curso.idPrograma), 10000);
  }

  private detenerPoll() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private refrescarProgreso(idPrograma: string | number) {
    this.api.progreso(idPrograma).subscribe({
      next: (data) => this.aplicarProgreso(String(idPrograma), data.progreso, data.reglas),
    });
    this.enviarInitAlIframe();
  }

  private aplicarProgreso(
    idPrograma: string,
    progreso: CursoVirtual['progreso'],
    reglas: CursoVirtual['reglas'],
  ) {
    if (!progreso) return;
    const curso = this.cursoActivo();
    if (curso && String(curso.idPrograma) === idPrograma) {
      this.cursoActivo.set({ ...curso, progreso, reglas: reglas ?? curso.reglas });
    }
    this.cursos.update((rows) =>
      rows.map((c) =>
        String(c.idPrograma) === idPrograma ? { ...c, progreso, reglas: reglas ?? c.reglas } : c,
      ),
    );
  }

  private handleIframeMessage(ev: MessageEvent) {
    const data = ev.data;
    if (!data || data.type !== 'ARGO_PROGRESO_ACTUALIZADO') return;
    const curso = this.cursoActivo();
    if (!curso || String(data.idPrograma) !== String(curso.idPrograma)) return;

    if (data.progreso) {
      this.aplicarProgreso(String(curso.idPrograma), data.progreso, data.reglas);
    }

    if (data.certificado?.emitido) {
      this.avisoPlayer.set(`¡Certificado emitido! Código: ${data.certificado.codigoCert || '—'}`);
      this.cargarCertificados();
    } else if (data.aviso) {
      this.avisoPlayer.set(data.aviso);
    }
  }
}
