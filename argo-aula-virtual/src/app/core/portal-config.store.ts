import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { catchError, of, tap } from 'rxjs';

import { AulaApiService } from './aula-api.service';
import { PortalConfig } from './models';

/** Config del portal cargada una sola vez (evita parpadeo de imágenes por defecto). */
@Injectable({ providedIn: 'root' })
export class PortalConfigStore {
  private api = inject(AulaApiService);
  private loadPromise: Promise<PortalConfig | null> | null = null;

  readonly config = signal<PortalConfig | null>(null);
  readonly ready = signal(false);

  load(): Promise<PortalConfig | null> {
    if (!this.loadPromise) {
      this.loadPromise = firstValueFrom(
        this.api.config().pipe(
          tap((c) => {
            this.config.set(c);
            this.ready.set(true);
          }),
          catchError(() => {
            this.ready.set(true);
            return of(null);
          }),
        ),
      );
    }
    return this.loadPromise;
  }
}
