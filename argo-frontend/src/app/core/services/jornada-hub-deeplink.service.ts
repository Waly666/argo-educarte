import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type JornadaHubTab = 'contratos' | 'jornadas' | 'clases' | 'certificados';

export interface JornadaHubDeepLink {
  contrato: string;
  tab?: JornadaHubTab;
  jornada?: string;
}

/** Permite abrir contrato/jornada en el hub aunque la URL no cambie (misma ruta + query). */
@Injectable({ providedIn: 'root' })
export class JornadaHubDeepLinkService {
  private readonly _nav = new Subject<JornadaHubDeepLink>();
  readonly nav$ = this._nav.asObservable();

  emit(link: JornadaHubDeepLink) {
    this._nav.next(link);
  }
}
