import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { PortalAuthService } from './portal-auth.service';

export interface MensajeForo {
  _id: string;
  idPrograma: string;
  autorNombre: string;
  autorTipo: 'alumno' | 'instructor' | 'admin';
  autorNumDoc?: number | null;
  texto: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ForoService {
  private auth = inject(PortalAuthService);
  private http = inject(HttpClient);

  private socket: Socket | null = null;
  private programaActual: string | null = null;
  private nombreActual = '';

  mensajes   = signal<MensajeForo[]>([]);
  conectado  = signal(false);
  cargando   = signal(false);
  error      = signal<string | null>(null);

  private socketUrl(): string {
    return environment.socketUrl || window.location.origin;
  }

  private ensureSocket(): Socket | null {
    const token = this.auth.token();
    if (!token) return null;

    if (!this.socket) {
      this.socket = io(`${this.socketUrl()}/foro`, {
        path: '/socket.io',
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 10,
      });

      this.socket.on('connect', () => {
        this.conectado.set(true);
        this.error.set(null);
      });
      this.socket.on('disconnect', () => this.conectado.set(false));

      this.socket.on('historial', (msgs: MensajeForo[]) => {
        this.mensajes.set(Array.isArray(msgs) ? msgs : []);
        this.cargando.set(false);
      });

      this.socket.on('nuevo-mensaje', (msg: MensajeForo) => {
        if (String(msg.idPrograma) !== String(this.programaActual)) return;
        this.mensajes.update((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      });

      this.socket.on('mensaje-eliminado', ({ _id }: { _id: string }) => {
        this.mensajes.update((prev) => prev.filter((m) => m._id !== _id));
      });

      this.socket.on('error-foro', ({ message }: { message: string }) => {
        this.error.set(message);
        this.cargando.set(false);
      });

      this.socket.on('connect_error', () => {
        this.conectado.set(false);
        if (!this.mensajes().length) {
          this.error.set('No se pudo conectar al foro en tiempo real.');
        }
        this.cargando.set(false);
      });
    }

    if (!this.socket.connected) this.socket.connect();
    return this.socket;
  }

  private emitJoin(id: string, nombrePrograma: string) {
    const socket = this.ensureSocket();
    if (!socket) return;

    const payload = { idPrograma: id, nombrePrograma };
    const join = () => socket.emit('join-foro', payload);
    if (socket.connected) join();
    else socket.once('connect', join);
  }

  private cargarMensajesHttp(idPrograma: string) {
    const id = String(idPrograma);
    const url =
      `${environment.apiUrl}/foro/cursos/${encodeURIComponent(id)}/mensajes` +
      `?limit=200&_=${Date.now()}`;

    this.http
      .get<{ mensajes: MensajeForo[] }>(url, { headers: this.auth.authHeader() })
      .subscribe({
        next: (res) => {
          if (String(this.programaActual) !== id) return;
          const lista = Array.isArray(res?.mensajes) ? res.mensajes : [];
          if (lista.length) this.mensajes.set(lista);
          this.cargando.set(false);
          this.error.set(null);
        },
        error: () => {
          if (String(this.programaActual) !== id) return;
          if (!this.mensajes().length) this.cargando.set(false);
        },
      });
  }

  joinForo(idPrograma: string, nombrePrograma = '') {
    const id = String(idPrograma);
    const nom = String(nombrePrograma || '');

    if (this.programaActual && this.programaActual !== id) {
      this.socket?.emit('leave-foro', { idPrograma: this.programaActual });
    }

    this.programaActual = id;
    this.nombreActual = nom;
    this.mensajes.set([]);
    this.cargando.set(true);
    this.error.set(null);

    this.emitJoin(id, nom);
    this.cargarMensajesHttp(id);
  }

  leaveForo() {
    if (this.programaActual && this.socket) {
      this.socket.emit('leave-foro', { idPrograma: this.programaActual });
    }
    this.programaActual = null;
    this.nombreActual = '';
    this.mensajes.set([]);
    this.cargando.set(false);
  }

  enviarMensaje(idPrograma: string, texto: string) {
    const socket = this.ensureSocket();
    if (!socket?.connected || !texto.trim()) return;
    socket.emit('enviar-mensaje', {
      idPrograma: String(idPrograma),
      texto: texto.trim(),
      nombrePrograma: this.nombreActual,
    });
  }
}
