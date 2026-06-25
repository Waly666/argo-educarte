import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: 'light' | 'dark' | 'auto';
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      getResponse: (widgetId?: string) => string;
      remove: (widgetId?: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

const SCRIPT_ID = 'cf-turnstile-script';
let scriptLoading: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise((resolve, reject) => {
    if (document.getElementById(SCRIPT_ID)) {
      window.onloadTurnstileCallback = () => resolve();
      return;
    }
    window.onloadTurnstileCallback = () => resolve();
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback';
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error('No se pudo cargar Turnstile'));
    document.head.appendChild(s);
  });
  return scriptLoading;
}

@Component({
  selector: 'argo-turnstile',
  standalone: true,
  template: `<div #host class="turnstile-host"></div>`,
  styles: [
    `
      .turnstile-host {
        min-height: 65px;
        margin: 0.75rem 0;
      }
    `,
  ],
})
export class TurnstileComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) siteKey = '';
  @Output() tokenChange = new EventEmitter<string>();

  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;

  private widgetId: string | null = null;

  async ngAfterViewInit() {
    if (!this.siteKey?.trim()) return;
    try {
      await loadTurnstileScript();
      this.widgetId = window.turnstile!.render(this.host.nativeElement, {
        sitekey: this.siteKey.trim(),
        theme: 'auto',
        callback: (token) => this.tokenChange.emit(token),
        'expired-callback': () => this.tokenChange.emit(''),
        'error-callback': () => this.tokenChange.emit(''),
      });
    } catch {
      this.tokenChange.emit('');
    }
  }

  ngOnDestroy() {
    if (this.widgetId && window.turnstile) {
      try {
        window.turnstile.remove(this.widgetId);
      } catch {
        /* ignore */
      }
    }
  }

  reset() {
    if (this.widgetId && window.turnstile) {
      window.turnstile.reset(this.widgetId);
      this.tokenChange.emit('');
    }
  }

  getToken(): string {
    if (!this.widgetId || !window.turnstile) return '';
    return window.turnstile.getResponse(this.widgetId) || '';
  }
}
