import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, DestroyRef, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal, computed, effect } from '@angular/core';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { ForoAdminService, MensajeForoAdmin } from '../../core/services/foro-admin.service';
import { AuthService } from '../../core/services/auth.service';

interface ResumenForo {
  idPrograma: string;
  nombreProg: string;
  codigoProg: string;
  total: number;
  ultimo: string;
}

interface AlumnoForo {
  numDoc: number;
  nombre: string;
  total: number;
}

@Component({
  selector: 'app-foro-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './foro-admin.component.html',
  styleUrl: './foro-admin.component.scss',
})
export class ForoAdminComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('chatBody') chatBody!: ElementRef<HTMLDivElement>;

  private http    = inject(HttpClient);
  private base    = `${environment.apiUrl}/foro`;
  private route   = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  foroSvc         = inject(ForoAdminService);
  authSvc         = inject(AuthService);

  private cursoPendiente: string | null = null;
  private mensajesSub: Subscription | null = null;

  cursos          = signal<ResumenForo[]>([]);
  cursoActivo     = signal<ResumenForo | null>(null);
  cargandoCursos  = signal(false);
  filtroBusqueda  = signal('');
  filtroAutor     = signal('');
  incluirRespuestasStaff = signal(true);
  texto           = signal('');
  ultimoDestacadoId = signal<string | null>(null);
  mostrarIrAbajo  = signal(false);

  private stickToBottom = true;
  private prevCount = 0;
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;

  cursosFiltrados = computed(() => {
    const q = this.filtroBusqueda().toLowerCase();
    if (!q) return this.cursos();
    return this.cursos().filter((c) => c.nombreProg.toLowerCase().includes(q));
  });

  alumnosEnForo = computed((): AlumnoForo[] => {
    const map = new Map<number, AlumnoForo>();
    for (const m of this.foroSvc.mensajes()) {
      if (m.autorTipo !== 'alumno' || m.autorNumDoc == null) continue;
      const nd = m.autorNumDoc;
      const prev = map.get(nd);
      if (prev) prev.total += 1;
      else map.set(nd, { numDoc: nd, nombre: m.autorNombre, total: 1 });
    }
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  });

  mensajesFiltrados = computed(() => {
    const msgs = this.foroSvc.mensajes();
    const f = this.filtroAutor();
    if (!f) return msgs;
    if (f === '__staff__') return msgs.filter((m) => m.autorTipo !== 'alumno');
    if (f === '__alumnos__') return msgs.filter((m) => m.autorTipo === 'alumno');
    if (!f.startsWith('a:')) return msgs;

    const nd = Number(f.slice(2));
    if (!Number.isFinite(nd)) return msgs;

    if (!this.incluirRespuestasStaff()) {
      return msgs.filter((m) => m.autorTipo === 'alumno' && m.autorNumDoc === nd);
    }

    const result: MensajeForoAdmin[] = [];
    let capturarStaff = false;
    for (const m of msgs) {
      if (m.autorTipo === 'alumno' && m.autorNumDoc === nd) {
        result.push(m);
        capturarStaff = true;
      } else if (capturarStaff && m.autorTipo !== 'alumno') {
        result.push(m);
      } else if (m.autorTipo === 'alumno') {
        capturarStaff = false;
      }
    }
    return result;
  });

  hayFiltroActivo = computed(() => !!this.filtroAutor());

  constructor() {
    effect(() => {
      const msgs = this.mensajesFiltrados();
      const count = msgs.length;
      const last = count ? msgs[count - 1] : null;

      if (count > this.prevCount && last) {
        this.destacarMensaje(last._id);
        if (this.stickToBottom) {
          requestAnimationFrame(() => this.scrollAlFinal());
        } else {
          this.mostrarIrAbajo.set(true);
        }
      } else if (count !== this.prevCount && count > 0 && this.stickToBottom) {
        requestAnimationFrame(() => this.scrollAlFinal());
      }

      this.prevCount = count;
    });

    effect(() => {
      if (!this.foroSvc.cargando() && this.mensajesFiltrados().length > 0 && this.stickToBottom) {
        requestAnimationFrame(() => this.scrollAlFinal());
      }
    });
  }

  ngOnInit() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.cursoPendiente = params.get('curso');
      this.intentarSeleccionarPendiente();
    });
    this.cargarResumen();
  }

  ngOnDestroy() {
    if (this.highlightTimer) clearTimeout(this.highlightTimer);
    this.mensajesSub?.unsubscribe();
    this.foroSvc.disconnect();
  }

  ngAfterViewInit() {
    requestAnimationFrame(() => this.scrollAlFinal());
  }

  onChatScroll() {
    const el = this.chatBody?.nativeElement;
    if (!el) return;
    const cercaDelFinal = el.scrollHeight - el.scrollTop - el.clientHeight < 72;
    this.stickToBottom = cercaDelFinal;
    if (cercaDelFinal) this.mostrarIrAbajo.set(false);
  }

  irAlUltimo() {
    this.stickToBottom = true;
    this.mostrarIrAbajo.set(false);
    this.scrollAlFinal();
  }

  esDestacado(msg: MensajeForoAdmin) {
    return this.ultimoDestacadoId() === msg._id;
  }

  private scrollAlFinal() {
    try {
      const el = this.chatBody?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  private destacarMensaje(id: string) {
    this.ultimoDestacadoId.set(id);
    if (this.highlightTimer) clearTimeout(this.highlightTimer);
    this.highlightTimer = setTimeout(() => this.ultimoDestacadoId.set(null), 2800);
  }

  cargarResumen() {
    const activo = this.cursoActivo();
    this.cargandoCursos.set(true);
    this.http.get<ResumenForo[]>(`${this.base}/admin/resumen`).subscribe({
      next: (rows) => {
        this.cursos.set(rows);
        this.cargandoCursos.set(false);
        if (activo) {
          const actualizado = rows.find((x) => String(x.idPrograma) === String(activo.idPrograma));
          if (actualizado) this.cursoActivo.set(actualizado);
        }
        this.intentarSeleccionarPendiente();
      },
      error: () => this.cargandoCursos.set(false),
    });
  }

  private intentarSeleccionarPendiente() {
    if (!this.cursoPendiente) return;
    const id = this.cursoPendiente;
    const c = this.cursos().find((x) => String(x.idPrograma) === String(id));
    if (!c) return;
    this.seleccionarCurso(c);
    this.cursoPendiente = null;
  }

  seleccionarCurso(c: ResumenForo) {
    this.cursoActivo.set(c);
    this.texto.set('');
    this.filtroAutor.set('');
    this.incluirRespuestasStaff.set(true);
    this.stickToBottom = true;
    this.prevCount = 0;
    this.mostrarIrAbajo.set(false);
    this.foroSvc.joinForo(c.idPrograma, c.nombreProg);
    this.cargarMensajesHttp(c.idPrograma);
  }

  private cargarMensajesHttp(idPrograma: string) {
    const id = String(idPrograma);
    this.mensajesSub?.unsubscribe();

    const url =
      `${this.base}/admin/cursos/${encodeURIComponent(id)}/mensajes` +
      `?limit=200&_=${Date.now()}`;

    this.mensajesSub = this.http
      .get<{ mensajes: MensajeForoAdmin[] }>(url)
      .pipe(
        finalize(() => {
          if (String(this.cursoActivo()?.idPrograma) === id && this.foroSvc.cargando()) {
            this.foroSvc.cargando.set(false);
          }
        }),
      )
      .subscribe({
        next: (res) => {
          if (String(this.cursoActivo()?.idPrograma) !== id) return;
          const lista = Array.isArray(res?.mensajes) ? res.mensajes : [];
          if (lista.length) this.foroSvc.mensajes.set(lista);
        },
        error: () => {
          if (String(this.cursoActivo()?.idPrograma) !== id) return;
          if (!this.foroSvc.mensajes().length) {
            this.foroSvc.error.set('No se pudieron cargar los mensajes');
          }
        },
      });
  }

  actualizar() {
    this.cargarResumen();
    const c = this.cursoActivo();
    if (c) {
      this.foroSvc.rejoinForo();
      this.cargarMensajesHttp(c.idPrograma);
    }
  }

  enviar() {
    const c = this.cursoActivo();
    const t = this.texto().trim();
    if (!c || !t) return;
    this.stickToBottom = true;
    this.foroSvc.enviarMensaje(c.idPrograma, t, c.nombreProg);
    this.texto.set('');
  }

  onKeydown(ev: KeyboardEvent) {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); this.enviar(); }
  }

  eliminarMensaje(msg: MensajeForoAdmin) {
    if (!confirm('¿Eliminar este mensaje del foro?')) return;
    this.http.delete(`${this.base}/admin/mensajes/${msg._id}`).subscribe({
      next: () => {
        this.foroSvc.mensajes.update((prev) => prev.filter((m) => m._id !== msg._id));
        const cur = this.cursoActivo();
        if (cur) this.cursos.update((cs) => cs.map((c) => c.idPrograma === cur.idPrograma ? { ...c, total: Math.max(0, c.total - 1) } : c));
      },
    });
  }

  limpiarFiltroAutor() {
    this.filtroAutor.set('');
    this.incluirRespuestasStaff.set(true);
  }

  esFiltroAlumno() {
    return this.filtroAutor().startsWith('a:');
  }

  tipoBadgeClass(tipo: MensajeForoAdmin['autorTipo']) {
    if (tipo === 'admin') return 'badge-admin';
    if (tipo === 'instructor') return 'badge-instructor';
    return 'badge-alumno';
  }

  tipoLabel(tipo: MensajeForoAdmin['autorTipo']) {
    if (tipo === 'admin') return '🛡 Admin';
    if (tipo === 'instructor') return '👨‍🏫 Instructor';
    return '🎓 Alumno';
  }

  formatFecha(iso: string) {
    try { return new Date(iso).toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
  }

  inicialAvatar(nombre: string) {
    return (nombre || '?').charAt(0).toUpperCase();
  }
}
