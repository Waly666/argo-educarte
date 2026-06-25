import { Injectable, NgZone, inject } from '@angular/core';

import { mountAllCardWaves } from './card-wave.util';

@Injectable({ providedIn: 'root' })
export class CardWaveService {
  private zone = inject(NgZone);
  private observer?: MutationObserver;
  private debounceId: ReturnType<typeof setTimeout> | null = null;
  private root: HTMLElement | null = null;

  /** Monta ondas en cards dentro de `root` y observa cambios del DOM (tabs, listas). */
  bind(root: HTMLElement): void {
    this.unbind();
    this.root = root;
    this.refresh();

    this.zone.runOutsideAngular(() => {
      this.observer = new MutationObserver(() => this.scheduleRefresh());
      this.observer.observe(root, { childList: true, subtree: true });
    });
  }

  unbind(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    if (this.debounceId) {
      clearTimeout(this.debounceId);
      this.debounceId = null;
    }
    this.root = null;
  }

  refresh(): void {
    if (!this.root) return;
    mountAllCardWaves(this.root);
  }

  private scheduleRefresh(): void {
    if (this.debounceId) clearTimeout(this.debounceId);
    this.debounceId = setTimeout(() => {
      this.debounceId = null;
      this.refresh();
    }, 120);
  }
}
