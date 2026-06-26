import { ApplicationConfig, APP_INITIALIZER, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { PortalConfigStore } from './core/portal-config.store';
import { PortalThemeService } from './core/portal-theme.service';

function bootstrapPortalConfig(store: PortalConfigStore, theme: PortalThemeService) {
  return () => store.load().then((c) => theme.apply(c));
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: bootstrapPortalConfig,
      deps: [PortalConfigStore, PortalThemeService],
    },
  ],
};
