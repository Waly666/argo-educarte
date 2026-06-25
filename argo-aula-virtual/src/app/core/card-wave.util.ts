/** Selectores de bloques tipo “card” en todo el portal */
export const CARD_WAVE_SELECTORS = [
  '.card-lift',
  '.servicio-chip',
  '.dark-card',
  '.catalog-card',
  '.oferta-card',
  '.info-card',
  '.paso-card',
  '.faq-item',
  '.carrera-nodo',
  '.fund-card',
  '.fund-servicio',
  '.fund-about__bloque',
  '.fund-about__stat',
  '.fund-about__logo-wrap',
  '.fund-contacto__item',
  '.site-footer__contact-card',
  '.acerca-panel',
  '.acerca-valor',
  '.acerca-contact-list li',
  '.contacto-form',
  '.consulta-card',
  '.dash-stat-card',
  '.dash-score-card',
  '.dash-cert-card',
  '.dash-profile-card',
  '.aula-gate-card',
  '.detail-buy-card',
  '.registro-card',
  '.auth.card',
  '.empty-cursos.card',
  '.nav a',
].join(',');

/** Botones CTA del portal — ondas verde / fucsia */
export const BUTTON_WAVE_SELECTORS = [
  '.btn',
  '.dash-btn',
  '.btn-verify',
].join(',');

/** No aplicar ondas a filtros/chips de navegación ni toggles */
const CARD_WAVE_SKIP = '.cat-chips, .cat-chips *, .user-chip, .card-wave-ring';

const BUTTON_WAVE_SKIP =
  '.menu-toggle, .faq-pregunta, .nav-backdrop, .pilares-tabs, .cat-chips, .dash-mobile-menu-btn, .card-wave-ring';

function isDisabled(el: HTMLElement): boolean {
  if (el instanceof HTMLButtonElement && el.disabled) return true;
  return el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
}

function appendWaveRings(host: HTMLElement): void {
  const ring1 = document.createElement('span');
  ring1.className = 'card-wave-ring';
  ring1.setAttribute('aria-hidden', 'true');

  const ring2 = document.createElement('span');
  ring2.className = 'card-wave-ring card-wave-ring--2';
  ring2.setAttribute('aria-hidden', 'true');

  host.prepend(ring1, ring2);
}

export function mountCardWaveRings(host: HTMLElement): void {
  if (host.classList.contains('card-wave-host')) return;
  if (host.closest(CARD_WAVE_SKIP)) return;
  if (host.classList.contains('card-wave-ring')) return;

  host.classList.add('card-wave-host');
  appendWaveRings(host);
}

export function mountButtonWaveRings(host: HTMLElement): void {
  if (host.classList.contains('btn-wave-host')) return;
  if (host.closest(BUTTON_WAVE_SKIP)) return;
  if (host.classList.contains('card-wave-ring')) return;
  if (isDisabled(host)) return;

  const alreadyWaves = host.classList.contains('card-wave-host');
  host.classList.add('card-wave-host', 'btn-wave-host');
  if (!alreadyWaves) appendWaveRings(host);
}

export function mountAllCardWaves(root: ParentNode = document): number {
  let n = 0;
  root.querySelectorAll(CARD_WAVE_SELECTORS).forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.closest(CARD_WAVE_SKIP)) return;
    mountCardWaveRings(el);
    n++;
  });
  root.querySelectorAll(BUTTON_WAVE_SELECTORS).forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.closest(BUTTON_WAVE_SKIP)) return;
    if (el.classList.contains('btn-wave-host')) return;
    mountButtonWaveRings(el);
    n++;
  });
  return n;
}
