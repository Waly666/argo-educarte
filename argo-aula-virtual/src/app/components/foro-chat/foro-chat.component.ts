import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ForoService, MensajeForo } from '../../core/foro.service';
import { PortalAuthService } from '../../core/portal-auth.service';

@Component({
  selector: 'av-foro-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './foro-chat.component.html',
  styleUrl: './foro-chat.component.scss',
})
export class ForoChatComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  @Input() idPrograma!: string;
  @Input() nombreCurso = '';

  @ViewChild('chatBody') chatBody!: ElementRef<HTMLDivElement>;

  foro = inject(ForoService);
  auth = inject(PortalAuthService);

  texto = signal('');
  filtro = signal<'todos' | 'mios'>('todos');
  enviando = signal(false);
  ultimoDestacadoId = signal<string | null>(null);
  mostrarIrAbajo = signal(false);

  private stickToBottom = true;
  private prevCount = 0;
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;

  mensajesFiltrados = computed(() => {
    const msgs = this.foro.mensajes();
    if (this.filtro() === 'mios') {
      const numDoc = this.auth.user()?.numDoc;
      return msgs.filter((m) => m.autorNumDoc === numDoc);
    }
    return msgs;
  });

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
      if (!this.foro.cargando() && this.mensajesFiltrados().length > 0 && this.stickToBottom) {
        requestAnimationFrame(() => this.scrollAlFinal());
      }
    });
  }

  ngOnInit() {
    this.stickToBottom = true;
    this.prevCount = 0;
    if (this.idPrograma) {
      this.foro.joinForo(this.idPrograma, this.nombreCurso);
    }
  }

  ngAfterViewInit() {
    requestAnimationFrame(() => this.scrollAlFinal());
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['idPrograma'] && !changes['idPrograma'].firstChange) {
      this.stickToBottom = true;
      this.prevCount = 0;
      this.mostrarIrAbajo.set(false);
      this.foro.joinForo(this.idPrograma, this.nombreCurso);
    }
  }

  ngOnDestroy() {
    if (this.highlightTimer) clearTimeout(this.highlightTimer);
    this.foro.leaveForo();
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

  enviar() {
    const t = this.texto().trim();
    if (!t || this.enviando()) return;
    this.stickToBottom = true;
    this.foro.enviarMensaje(this.idPrograma, t);
    this.texto.set('');
  }

  onKeydown(ev: KeyboardEvent) {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      this.enviar();
    }
  }

  esDestacado(msg: MensajeForo) {
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

  esPropio(msg: MensajeForo) {
    return msg.autorNumDoc != null && msg.autorNumDoc === this.auth.user()?.numDoc;
  }

  inicialAvatar(nombre: string) {
    return (nombre || '?').charAt(0).toUpperCase();
  }

  tipoBadge(tipo: MensajeForo['autorTipo']) {
    if (tipo === 'admin') return '🛡 Admin';
    if (tipo === 'instructor') return '👨‍🏫 Instructor';
    return '';
  }

  trackMsg(_: number, msg: MensajeForo) {
    return msg._id;
  }

  formatHora(iso: string) {
    try {
      return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  formatFecha(iso: string) {
    try {
      return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  }
}
