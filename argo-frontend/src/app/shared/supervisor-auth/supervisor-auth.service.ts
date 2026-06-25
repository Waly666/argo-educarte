import { Injectable, signal } from '@angular/core';

import { AutorizacionSupervisorDto } from '../../core/services/supervisor-auth.types';

export interface SupervisorAuthOptions {
  title?: string;
  message?: string;
  confirmLabel?: string;
}

export interface SupervisorAuthState extends Required<Omit<SupervisorAuthOptions, never>> {
  username: string;
  password: string;
  error: string | null;
}

/**
 * Diálogo reutilizable para pedir credenciales de un administrador que autoriza
 * una operación sensible (anular comprobantes, certificados, etc.).
 * Devuelve `{ autorizadoUsername, autorizadoPassword }` o `null` si se cancela.
 */
@Injectable({ providedIn: 'root' })
export class SupervisorAuthService {
  readonly state = signal<SupervisorAuthState | null>(null);

  private resolver: ((value: AutorizacionSupervisorDto | null) => void) | null = null;

  solicitar(options: SupervisorAuthOptions = {}): Promise<AutorizacionSupervisorDto | null> {
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.state.set({
        title: options.title ?? 'Autorización de administrador',
        message:
          options.message ??
          'Ingrese usuario y contraseña de un administrador para autorizar esta operación.',
        confirmLabel: options.confirmLabel ?? 'Autorizar',
        username: '',
        password: '',
        error: null,
      });
    });
  }

  setUsername(value: string): void {
    const s = this.state();
    if (s) this.state.set({ ...s, username: value, error: null });
  }

  setPassword(value: string): void {
    const s = this.state();
    if (s) this.state.set({ ...s, password: value, error: null });
  }

  confirm(): void {
    const s = this.state();
    if (!s) return;
    const u = s.username.trim();
    const p = s.password;
    if (!u || !p) {
      this.state.set({ ...s, error: 'Indique usuario y contraseña del administrador.' });
      return;
    }
    this.finish({ autorizadoUsername: u, autorizadoPassword: p });
  }

  cancel(): void {
    this.finish(null);
  }

  private finish(value: AutorizacionSupervisorDto | null): void {
    this.state.set(null);
    const r = this.resolver;
    this.resolver = null;
    r?.(value);
  }
}
