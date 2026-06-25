import { AfterViewInit, Directive, ElementRef, inject } from '@angular/core';

import { mountCardWaveRings } from './card-wave.util';

/** Compatibilidad: monta ondas en el host (el servicio global cubre el resto del sitio). */
@Directive({
  selector:
    'article.card-lift, a.card-lift, article.catalog-card, article.servicio-chip, a.servicio-chip',
  standalone: true,
})
export class CardWaveDirective implements AfterViewInit {
  private el = inject(ElementRef<HTMLElement>);

  ngAfterViewInit(): void {
    mountCardWaveRings(this.el.nativeElement);
  }
}
