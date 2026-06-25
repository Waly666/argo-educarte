import { AfterViewInit, Directive, ElementRef, inject, input, OnDestroy } from '@angular/core';

@Directive({
  selector: 'h1[avAnimateTitle], h2[avAnimateTitle], h3[avAnimateTitle]',
  standalone: true,
})
export class AnimateTitleDirective implements AfterViewInit, OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private obs?: IntersectionObserver;

  /** Retraso extra en ms. */
  titleDelay = input<number | string>(0);

  /** Animar al cargar (hero h1) sin esperar scroll. */
  immediate = input(false);

  ngAfterViewInit() {
    const node = this.el.nativeElement;
    const tag = node.tagName.toLowerCase();
    node.classList.add('title-reveal', `title-reveal--${tag}`);

    const raw = this.titleDelay();
    const delay = typeof raw === 'number' ? `${raw}ms` : raw;
    if (delay && delay !== '0' && delay !== '0ms') {
      node.style.setProperty('--title-delay', delay);
    }

    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced || this.immediate()) {
      window.setTimeout(() => node.classList.add('is-visible'), this.immediate() ? 50 : 0);
      return;
    }

    this.obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          node.classList.add('is-visible');
          this.obs?.unobserve(node);
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -24px 0px' },
    );
    this.obs.observe(node);
  }

  ngOnDestroy() {
    this.obs?.disconnect();
  }
}
