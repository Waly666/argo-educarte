import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ForoAdminService } from './foro-admin.service';
import { ForoSocketService } from './foro-socket.service';

export interface ForoMensajeAlerta {
  id: string;
  idPrograma: string;
  nombrePrograma: string;
  autorNombre: string;
  texto: string;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class ForoMensajeAlertService {
  private router = inject(Router);
  private foroAdmin = inject(ForoAdminService);
  private foroSocket = inject(ForoSocketService);

  private vistos = new Set<string>();
  private activo = false;
  private readonly onForoNuevoMensaje = (msg: ForoMensajeAlerta) => this.recibir(msg);

  private readonly _alertas = signal<ForoMensajeAlerta[]>([]);
  readonly alertas = this._alertas.asReadonly();

  conectar() {
    const socket = this.foroSocket.connect();
    if (!socket) return;

    this.activo = true;
    socket.off('foro-nuevo-mensaje', this.onForoNuevoMensaje);
    socket.on('foro-nuevo-mensaje', this.onForoNuevoMensaje);
  }

  desconectar() {
    this.activo = false;
    this._alertas.set([]);
  }

  private recibir(raw: Partial<ForoMensajeAlerta> & { _id?: string } | null | undefined) {
    if (!raw) return;
    const id = String(raw.id || raw._id || '');
    if (!id || this.vistos.has(id)) return;

    const idPrograma = String(raw.idPrograma || '');
    if (!idPrograma) return;

    if (this.foroAdmin.cursoActivo() === idPrograma) return;

    const alerta: ForoMensajeAlerta = {
      id,
      idPrograma,
      nombrePrograma: String(raw.nombrePrograma || idPrograma),
      autorNombre: String(raw.autorNombre || 'Alumno'),
      texto: String(raw.texto || '').trim(),
      createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
    };

    if (!alerta.texto) return;
    if (this._alertas().some((a) => a.id === id)) return;

    this._alertas.update((list) => [alerta, ...list].slice(0, 8));
  }

  abrir(alerta: ForoMensajeAlerta) {
    this.descartar(alerta.id);
    void this.router.navigate(['/app/aula-virtual/foro'], {
      queryParams: { curso: alerta.idPrograma },
    });
  }

  descartar(id: string) {
    const key = String(id || '');
    if (key) this.vistos.add(key);
    this._alertas.update((list) => list.filter((a) => a.id !== key));
  }

  descartarTodas() {
    const actuales = this._alertas();
    if (!actuales.length) return;
    for (const a of actuales) this.vistos.add(a.id);
    this._alertas.set([]);
  }
}
