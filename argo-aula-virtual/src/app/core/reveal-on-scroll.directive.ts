import { AfterViewInit, Directive, ElementRef, inject, input, OnDestroy } from '@angular/core';

@Directive({
  selector: '[avRevealOnScroll]',
  standalone: true,
})
export class RevealOnScrollDirective implements AfterViewInit, OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private obs?: IntersectionObserver;

  /** Retraso en ms (útil para stagger en listas). */
  revealDelay = input<number | string>(0);

  ngAfterViewInit() {
    const node = this.el.nativeElement;
    node.classList.add('reveal');

    const raw = this.revealDelay();
    const delay = typeof raw === 'number' ? `${raw}ms` : raw;
    if (delay && delay !== '0' && delay !== '0ms') {
      node.style.setProperty('--reveal-delay', delay);
    }

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.classList.add('is-visible');
      return;
    }

    this.obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          node.classList.add('is-visible');
          this.obs?.unobserve(node);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -32px 0px' },
    );
    this.obs.observe(node);
  }

  ngOnDestroy() {
    this.obs?.disconnect();
  }
}
