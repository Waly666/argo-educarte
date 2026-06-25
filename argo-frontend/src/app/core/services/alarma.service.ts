import { Injectable, computed, signal } from '@angular/core';

const USER_KEY = 'argo_user';

@Injectable({ providedIn: 'root' })
export class AlarmaService {
  private _alarmas = signal<string[]>(this.readAlarmas());

  alarmas = computed(() => this._alarmas());

  setAlarmas(list: string[] | undefined | null): void {
    const a = list?.length ? [...list] : [];
    this._alarmas.set(a);
  }

  tiene(clave?: string | string[] | null): boolean {
    if (!clave) return true;
    const keys = Array.isArray(clave) ? clave : [clave];
    const alarmas = this._alarmas();
    if (!alarmas.length) return false;
    if (alarmas.includes('*')) return true;
    return keys.some((k) => this.tieneUna(alarmas, k));
  }

  private tieneUna(alarmas: string[], clave: string): boolean {
    if (alarmas.includes(clave)) return true;
    const base = clave.split('.')[0];
    return alarmas.includes(base);
  }

  private readAlarmas(): string[] {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return [];
      const u = JSON.parse(raw) as { alarmas?: string[] };
      return u?.alarmas?.length ? [...u.alarmas] : [];
    } catch {
      return [];
    }
  }
}
