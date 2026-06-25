import { effect, Injectable, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

/**
 * Una sola conexión Socket.IO al namespace /foro para todo el ERP
 * (alertas en cabecera + pantalla de moderación del foro).
 */
@Injectable({ providedIn: 'root' })
export class ForoSocketService {
  private auth = inject(AuthService);
  private socket: Socket | null = null;

  constructor() {
    effect(() => {
      if (!this.auth.token()) this.cerrarConexion();
    });
  }

  private socketUrl(): string {
    const base = environment.apiUrl.replace('/api', '');
    return base || window.location.origin;
  }

  /** Obtiene la conexión compartida (la crea o reconecta si hace falta). */
  connect(): Socket | null {
    const token = this.auth.token();
    if (!token) return null;

    if (this.socket) {
      if (!this.socket.connected) this.socket.connect();
      return this.socket;
    }

    this.socket = io(`${this.socketUrl()}/foro`, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });

    return this.socket;
  }

  /** Cierra la conexión al cerrar sesión (evita reconexiones en segundo plano). */
  cerrarConexion(): void {
    if (!this.socket) return;
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
  }

  get connected(): boolean {
    return !!this.socket?.connected;
  }

  emitJoin(idPrograma: string, nombrePrograma = ''): void {
    const s = this.connect();
    if (!s) return;

    const payload = { idPrograma: String(idPrograma), nombrePrograma: String(nombrePrograma || '') };
    const join = () => s.emit('join-foro', payload);

    if (s.connected) join();
    else s.once('connect', join);
  }

  emitLeave(idPrograma: string): void {
    this.socket?.emit('leave-foro', { idPrograma: String(idPrograma) });
  }
}
