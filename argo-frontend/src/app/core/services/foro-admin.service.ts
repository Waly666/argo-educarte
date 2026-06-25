import { Injectable, inject, signal } from '@angular/core';
import type { Socket } from 'socket.io-client';
import { ForoSocketService } from './foro-socket.service';

export interface MensajeForoAdmin {
  _id: string;
  idPrograma: string;
  nombrePrograma?: string;
  autorNombre: string;
  autorTipo: 'alumno' | 'instructor' | 'admin';
  autorNumDoc?: number | null;
  texto: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ForoAdminService {
  private foroSocket = inject(ForoSocketService);

  private programaActual: string | null = null;
  private nombreProgramaActual = '';
  private listenersReady = false;

  mensajes       = signal<MensajeForoAdmin[]>([]);
  conectado      = signal(false);
  cargando       = signal(false);
  error          = signal<string | null>(null);
  enviando       = signal(false);
  /** Curso cuyo chat está abierto (para suprimir alertas duplicadas). */
  cursoActivo    = signal<string | null>(null);

  private ensureListeners(socket: Socket) {
    if (this.listenersReady) return;
    this.listenersReady = true;

    socket.on('connect', () => this.conectado.set(true));
    socket.on('disconnect', () => this.conectado.set(false));
    this.conectado.set(socket.connected);

    socket.on('historial', (msgs: MensajeForoAdmin[]) => {
      this.mensajes.set(Array.isArray(msgs) ? msgs : []);
      this.cargando.set(false);
    });

    socket.on('nuevo-mensaje', (msg: MensajeForoAdmin) => {
      if (String(msg.idPrograma) !== String(this.programaActual)) return;
      this.mensajes.update((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on('mensaje-eliminado', ({ _id }: { _id: string }) => {
      this.mensajes.update((prev) => prev.filter((m) => m._id !== _id));
    });

    socket.on('error-foro', ({ message }: { message: string }) => {
      this.error.set(message);
      this.enviando.set(false);
      this.cargando.set(false);
    });

    socket.on('connect_error', () => this.conectado.set(false));
  }

  joinForo(idPrograma: string, nombrePrograma = '') {
    const id = String(idPrograma);
    const nom = String(nombrePrograma || '');

    const socket = this.foroSocket.connect();
    if (!socket) {
      this.error.set('No hay sesión activa');
      return;
    }

    this.ensureListeners(socket);

    if (this.programaActual && this.programaActual !== id) {
      this.foroSocket.emitLeave(this.programaActual);
    }

    this.programaActual = id;
    this.nombreProgramaActual = nom;
    this.cursoActivo.set(id);
    this.mensajes.set([]);
    this.cargando.set(true);
    this.error.set(null);

    this.foroSocket.emitJoin(id, nom);
  }

  rejoinForo() {
    if (!this.programaActual) return;
    this.mensajes.set([]);
    this.cargando.set(true);
    this.error.set(null);
    this.foroSocket.emitJoin(this.programaActual, this.nombreProgramaActual);
  }

  enviarMensaje(idPrograma: string, texto: string, nombrePrograma = '') {
    const socket = this.foroSocket.connect();
    if (!socket?.connected || !texto.trim() || this.enviando()) return;
    this.enviando.set(true);
    socket.emit('enviar-mensaje', { idPrograma, texto: texto.trim(), nombrePrograma });
    socket.once('nuevo-mensaje', () => this.enviando.set(false));
    setTimeout(() => this.enviando.set(false), 3000);
  }

  /** Sale del curso actual sin cerrar el socket compartido (alertas siguen activas). */
  disconnect() {
    if (this.programaActual) {
      this.foroSocket.emitLeave(this.programaActual);
    }
    this.programaActual = null;
    this.nombreProgramaActual = '';
    this.cursoActivo.set(null);
    this.mensajes.set([]);
    this.cargando.set(false);
  }
}
