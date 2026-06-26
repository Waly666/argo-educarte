/** Variables CSS derivadas del tema del portal (sitio público). */

export interface PortalTemaLike {
  colorPrimario?: string;
  colorPrimarioOscuro?: string;
  colorAcento?: string;
  colorFondo?: string;
  colorSuperficie?: string;
  colorTexto?: string;
  colorTextoSecundario?: string;
  fuente?: string;
}

export const PORTAL_TEMA_FINSTRUVIAL: Required<Omit<PortalTemaLike, 'fuente'>> & { fuente: string } = {
  colorPrimario: '#3b82f6',
  colorPrimarioOscuro: '#1d4ed8',
  colorAcento: '#22d3ee',
  colorFondo: '#0b1224',
  colorSuperficie: '#121c33',
  colorTexto: '#eef3ff',
  colorTextoSecundario: '#9fb0d0',
  fuente: 'Plus Jakarta Sans',
};

/** Educarte — paleta institucional (referencia MISIÓN: verde bosque + crema + dorado). */
export const EDUCARTE_HERO_FONDO = '/images/fondo-hero-educarte.png';
/** Foto lateral del hero (persona); distinta de la textura FONDO_HERO. */
export const EDUCARTE_HERO_PERSONA = '/images/hero-estudiante.png';

export const PORTAL_TEMA_EDUCARTE: Required<Omit<PortalTemaLike, 'fuente'>> & { fuente: string } = {
  colorPrimario: '#0B4D3C',
  colorPrimarioOscuro: '#063828',
  colorAcento: '#C5A059',
  colorFondo: '#FDFBF7',
  colorSuperficie: '#FFFFFF',
  colorTexto: '#1A2E24',
  colorTextoSecundario: '#4A6358',
  fuente: 'Montserrat',
};

/** Plantilla Educarte anterior (índigo + Outfit) — instalaciones ya publicadas en MongoDB. */
export const PORTAL_TEMA_EDUCARTE_LEGACY: Required<Omit<PortalTemaLike, 'fuente'>> & { fuente: string } = {
  colorPrimario: '#6366F1',
  colorPrimarioOscuro: '#4338CA',
  colorAcento: '#14B8A6',
  colorFondo: '#F8FAFC',
  colorSuperficie: '#FFFFFF',
  colorTexto: '#0F172A',
  colorTextoSecundario: '#64748B',
  fuente: 'Outfit',
};

function matchesEducartePreset(t: PortalTemaLike, preset: typeof PORTAL_TEMA_EDUCARTE): boolean {
  return (
    hexKey(t.colorPrimario ?? '') === hexKey(preset.colorPrimario) &&
    hexKey(t.colorPrimarioOscuro ?? '') === hexKey(preset.colorPrimarioOscuro) &&
    hexKey(t.colorAcento ?? '') === hexKey(preset.colorAcento)
  );
}

/** Derivados Educarte — hero con textura FONDO_HERO y tonos de la pieza MISIÓN. */
export const EDUCARTE_DERIVED_CSS_VARS: Record<string, string> = {
  '--av-brand': '#0B4D3C',
  '--av-surface-2': '#F5F0E8',
  '--av-border': 'rgba(11, 77, 60, 0.14)',
  '--av-border-strong': 'rgba(11, 77, 60, 0.28)',
  '--av-dark-lead': '#4A6358',
  '--av-dark-body': '#4A6358',
  '--av-footer-muted': 'rgba(253, 251, 247, 0.82)',
  '--av-footer-text': '#FDFBF7',
  '--av-starfield-glow': 'transparent',
  '--av-starfield-top': '#FDFBF7',
  '--av-starfield-mid': '#F5F0E8',
  '--av-starfield-bottom': '#EBE4D6',
  '--av-starfield-bg': '#FDFBF7',
  '--av-starfield-accent-glow': 'transparent',
  '--av-starfield-accent-glow-radial': 'none',
  '--av-starfield-decor-opacity': '0',
  '--av-starfield-section-lead': '#1A2E24',
  '--av-hero-bg': `url("${EDUCARTE_HERO_FONDO}") center top / cover no-repeat, linear-gradient(180deg, rgba(253, 251, 247, 0.55) 0%, rgba(253, 251, 247, 0.92) 100%)`,
  '--av-hero-grad-start': '#FDFBF7',
  '--av-hero-grad-end': '#F5F0E8',
  '--av-page-hero-bg': `url("${EDUCARTE_HERO_FONDO}") center top / cover no-repeat, linear-gradient(180deg, rgba(253, 251, 247, 0.7) 0%, #F5F0E8 100%)`,
  '--av-page-hero-glow': 'rgba(197, 160, 89, 0.22)',
  '--av-page-hero-kicker-bg': 'rgba(197, 160, 89, 0.16)',
  '--av-page-hero-kicker-border': 'rgba(197, 160, 89, 0.38)',
  '--av-page-hero-kicker-text': '#063828',
  '--av-page-hero-text': '#063828',
  '--av-page-hero-lead': '#1A2E24',
  '--av-page-body-light-bg': '#FDFBF7',
  '--av-blog-page-bg': '#FDFBF7',
  '--av-section-light-bg': '#FFFFFF',
  '--av-quote-band-bg': '#063828',
  '--av-faq-bg': '#F5F0E8',
  '--av-faq-glow': 'transparent',
  '--av-faq-panel-bg': '#FFFFFF',
  '--av-faq-icon-bg': '#0B4D3C',
  '--av-faq-open-text': '#063828',
  '--av-footer-bg': '#063828',
  '--av-footer-glow-line': '#C5A059',
  '--av-footer-glow-animation': 'none',
  '--av-footer-glow-size': '100% 100%',
  '--av-footer-link-hover': '#F5E6C8',
  '--av-topbar-nav': '#FDFBF7',
  '--av-topbar-nav-muted': 'rgba(253, 251, 247, 0.94)',
  '--av-card-wave-a': '#C5A059',
  '--av-card-wave-b': '#0B4D3C',
  '--av-card-wave-light-a': '#0B4D3C',
  '--av-card-wave-light-b': '#C5A059',
  '--av-card-wave-dark-a': '#C5A059',
  '--av-card-wave-dark-b': '#0B4D3C',
  '--av-btn-accent-bg': '#C5A059',
  '--av-btn-gradient': '#0B4D3C',
  '--av-btn-gradient-alt': '#063828',
  '--av-btn-primary-shadow': 'rgba(11, 77, 60, 0.22)',
  '--av-btn-primary-shadow-hover': 'rgba(11, 77, 60, 0.32)',
  '--av-title-underline-light': '#C5A059',
  '--av-hero-info-card-bg': '#FFFFFF',
  '--av-hero-info-card-border': 'rgba(197, 160, 89, 0.35)',
  '--av-hero-info-card-title': '#063828',
  '--av-hero-accent-glow': 'rgba(197, 160, 89, 0.38)',
  '--av-hero-title-shimmer': '#0B4D3C',
  '--av-title-glow': 'rgba(197, 160, 89, 0.4)',
  '--av-fundacion-cta-bg': '#0B4D3C',
  '--av-section-light-link': '#063828',
  '--av-link-primary': '#0B4D3C',
  '--av-radius': '20px',
  '--av-app-phone-screen-bg': 'linear-gradient(180deg, #0B4D3C 0%, #063828 42%, #1A2E24 100%)',
  '--av-app-phone-bezel-bg': 'linear-gradient(145deg, #0B4D3C 0%, #063828 38%, #1A2E24 72%, #063828 100%)',
};
export const FINSTRUVIAL_DERIVED_CSS_VARS: Record<string, string> = {
  '--av-brand': '#c2410c',
  '--av-surface-2': '#1a2744',
  '--av-border-strong': 'rgba(148, 163, 184, 0.45)',
  '--av-dark-lead': '#b6c5e8',
  '--av-dark-body': '#a8b8d8',
  '--av-footer-muted': '#94a3b8',
  '--av-footer-text': '#cbd5e1',
  '--av-starfield-glow': 'rgba(37, 99, 235, 0.5)',
  '--av-starfield-top': '#101b3c',
  '--av-starfield-mid': '#0a1130',
  '--av-starfield-bottom': '#070d26',
  '--av-starfield-bg':
    'radial-gradient(ellipse 90% 70% at 50% 30%, rgba(37, 99, 235, 0.5), transparent 70%), linear-gradient(180deg, #101b3c 0%, #0a1130 55%, #070d26 100%)',
  '--av-starfield-accent-glow': 'rgba(34, 211, 238, 0.16)',
  '--av-starfield-accent-glow-radial':
    'radial-gradient(circle, rgba(34, 211, 238, 0.16) 0%, rgba(34, 211, 238, 0.05) 38%, transparent 68%)',
  '--av-starfield-section-lead': '#b6c5e8',
  '--av-hero-bg':
    'radial-gradient(ellipse 90% 70% at 50% 30%, rgba(37, 99, 235, 0.5), transparent 70%), linear-gradient(180deg, #101b3c 0%, #0a1130 55%, #070d26 100%)',
  '--av-hero-grad-start': 'rgba(29, 78, 216, 0.92)',
  '--av-hero-grad-end': '#0b1224',
  '--av-page-hero-bg': 'linear-gradient(135deg, #030712 0%, #0b1224 45%, #0f172a 100%)',
  '--av-card-wave-a': 'rgba(34, 211, 238, 0.75)',
  '--av-card-wave-b': 'rgba(59, 130, 246, 0.5)',
  '--av-card-wave-light-a': 'rgba(37, 99, 235, 0.65)',
  '--av-card-wave-light-b': 'rgba(34, 211, 238, 0.55)',
  '--av-card-wave-dark-a': 'rgba(186, 230, 253, 0.95)',
  '--av-card-wave-dark-b': 'rgba(34, 211, 238, 0.78)',
  '--av-btn-accent-bg': 'linear-gradient(135deg, #34d399, #14b8a6)',
  '--av-title-underline-light': 'linear-gradient(90deg, #1d4ed8, #0891b2)',
};

function hexKey(hex: string): string | null {
  const n = normalizeHex(hex);
  return n ? n.toLowerCase() : null;
}

/** true si los 7 colores + fuente coinciden con la plantilla oficial Finstruvial. */
export function isFinstruvialTema(tema: PortalTemaLike | null | undefined): boolean {
  const t = resolveTema(tema);
  const f = PORTAL_TEMA_FINSTRUVIAL;
  return (
    hexKey(t.colorPrimario) === hexKey(f.colorPrimario) &&
    hexKey(t.colorPrimarioOscuro) === hexKey(f.colorPrimarioOscuro) &&
    hexKey(t.colorAcento) === hexKey(f.colorAcento) &&
    hexKey(t.colorFondo) === hexKey(f.colorFondo) &&
    hexKey(t.colorSuperficie) === hexKey(f.colorSuperficie) &&
    hexKey(t.colorTexto) === hexKey(f.colorTexto) &&
    hexKey(t.colorTextoSecundario) === hexKey(f.colorTextoSecundario) &&
    String(t.fuente || f.fuente).trim().toLowerCase() === f.fuente.toLowerCase()
  );
}

/** true si los colores + fuente coinciden con la plantilla Educarte (Colombia). */
export function isEducarteTema(tema: PortalTemaLike | null | undefined): boolean {
  if (!tema) return false;
  const t = resolveTema(tema);
  const fuente = String(t.fuente || '').trim().toLowerCase();
  if (fuente === 'outfit' || fuente === 'montserrat') return true;
  if (matchesEducartePreset(t, PORTAL_TEMA_EDUCARTE)) return true;
  return matchesEducartePreset(t, PORTAL_TEMA_EDUCARTE_LEGACY);
}

function normalizeHex(hex: string): string | null {
  const raw = String(hex || '').trim().replace('#', '');
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return raw
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return raw;
  return null;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function mixHex(a: string, b: string, weightB: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return a;
  const w = Math.max(0, Math.min(1, weightB));
  const ch = (i: number) => Math.round(ra[i] * (1 - w) + rb[i] * w);
  return `#${[ch(0), ch(1), ch(2)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

function darkenHex(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const f = (n: number) => Math.max(0, Math.min(255, Math.round(n * (1 - amount))));
  return `#${[f(rgb[0]), f(rgb[1]), f(rgb[2])].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

export function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return lum > 0.58;
}

function resolveTema(tema: PortalTemaLike | null | undefined) {
  return { ...PORTAL_TEMA_FINSTRUVIAL, ...tema };
}

/** Genera todas las variables --av-* aplicadas en :root al cargar el portal. */
export function buildPortalThemeCssVars(tema: PortalTemaLike | null | undefined): Record<string, string> {
  const t = resolveTema(tema);
  const primary = t.colorPrimario;
  const primaryDark = t.colorPrimarioOscuro;
  const accent = t.colorAcento;
  const bg = t.colorFondo;
  const surface = t.colorSuperficie;
  const text = t.colorTexto;
  const dim = t.colorTextoSecundario;
  const light = isLightColor(bg);
  const fontStack = `'${t.fuente}', system-ui, sans-serif`;
  const surface2 = mixHex(surface, primaryDark, 0.28);
  const pageHeroStart = darkenHex(bg, 0.35);
  const footerEnd = darkenHex(bg, 0.55);

  const starfieldTop = light ? bg : surface;
  const starfieldBottom = light ? withAlpha(primary, 0.08) : primaryDark;
  const heroStart = light ? withAlpha(primary, 0.18) : withAlpha(primaryDark, 0.92);
  const starfieldMid = light ? bg : mixHex(bg, surface, 0.45);
  const starfieldBottomGeneric = light ? withAlpha(primaryDark, 0.12) : darkenHex(bg, 0.18);

  const vars: Record<string, string> = {
    '--av-primary': primary,
    '--av-primary-dark': primaryDark,
    '--av-accent': accent,
    '--av-bg': bg,
    '--av-surface': surface,
    '--av-surface-2': surface2,
    '--av-text': text,
    '--av-dim': dim,
    '--av-text-muted': dim,
    '--av-brand': primary,
    '--av-ink': light ? mixHex('#0f172a', primaryDark, 0.15) : '#0f172a',
    '--av-ink-muted': light ? mixHex('#475569', dim, 0.2) : dim,
    '--av-dark-lead': dim,
    '--av-dark-body': mixHex(dim, text, 0.35),
    '--av-footer-muted': dim,
    '--av-footer-text': mixHex(dim, text, 0.45),
    '--av-border': withAlpha(dim, 0.35),
    '--av-border-strong': withAlpha(accent, 0.35),
    '--av-font-sans': fontStack,
    '--av-font-display': fontStack,

    '--av-starfield-top': starfieldTop,
    '--av-starfield-mid': light ? bg : starfieldMid,
    '--av-starfield-bottom': light ? withAlpha(primary, 0.08) : starfieldBottomGeneric,
    '--av-starfield-glow': withAlpha(primary, light ? 0.2 : 0.5),
    '--av-starfield-accent-glow': withAlpha(accent, light ? 0.14 : 0.2),
    '--av-starfield-section-lead': dim,
    '--av-hero-grad-start': heroStart,
    '--av-hero-grad-end': bg,

    '--av-page-hero-bg': `linear-gradient(135deg, ${pageHeroStart} 0%, ${bg} 45%, ${surface2} 100%)`,
    '--av-page-hero-glow': withAlpha(accent, 0.18),
    '--av-page-hero-kicker-bg': withAlpha(accent, 0.12),
    '--av-page-hero-kicker-border': withAlpha(accent, 0.3),
    '--av-page-hero-kicker-text': accent,

    '--av-section-light-bg': `color-mix(in srgb, ${primary} 5.5%, #f8fafc)`,
    '--av-section-light-text': '#0f172a',
    '--av-section-light-muted': mixHex('#475569', primaryDark, 0.12),
    '--av-section-light-link': primaryDark,
    '--av-section-light-border': withAlpha(primary, 0.35),
    '--av-section-light-chip-border': withAlpha(primary, 0.28),
    '--av-section-light-chip-hover': withAlpha(primary, 0.12),

    '--av-section-white-kicker': mixHex(primaryDark, accent, 0.25),

    '--av-quote-band-bg': `linear-gradient(90deg, ${primaryDark}, ${mixHex(primaryDark, accent, 0.55)})`,

    '--av-faq-bg': `radial-gradient(ellipse 85% 65% at 50% 20%, ${withAlpha(primary, 0.42)}, transparent 70%), linear-gradient(180deg, ${starfieldTop} 0%, ${bg} 55%, ${starfieldBottom} 100%)`,
    '--av-faq-glow': withAlpha(accent, 0.12),
    '--av-faq-panel-bg': `linear-gradient(165deg, ${withAlpha(surface, 0.72)}, ${withAlpha(bg, 0.72)})`,
    '--av-faq-panel-border': withAlpha(dim, 0.28),
    '--av-faq-open-text': accent,
    '--av-faq-icon-bg': `linear-gradient(150deg, ${accent}, ${primaryDark})`,
    '--av-faq-icon-shadow': withAlpha(accent, 0.35),

    '--av-footer-bg': `radial-gradient(ellipse 70% 60% at 0% 100%, ${withAlpha(primary, 0.14)}, transparent), radial-gradient(ellipse 50% 40% at 100% 0%, ${withAlpha(accent, 0.1)}, transparent), linear-gradient(180deg, ${bg} 0%, ${surface2} 55%, ${footerEnd} 100%)`,
    '--av-footer-glow-line': `linear-gradient(90deg, ${primary}, ${accent}, ${mixHex(accent, primary, 0.4)}, ${primary})`,
    '--av-footer-link-hover': accent,
    '--av-footer-badge-bg': withAlpha(accent, 0.1),
    '--av-footer-badge-border': withAlpha(accent, 0.28),
    '--av-footer-badge-text': accent,

    '--av-card-wave-a': withAlpha(accent, 0.75),
    '--av-card-wave-b': withAlpha(primary, 0.5),
    '--av-card-wave-dark-a': withAlpha(accent, 0.88),
    '--av-card-wave-dark-b': withAlpha(primary, 0.65),
    '--av-card-wave-light-a': withAlpha(primary, 0.65),
    '--av-card-wave-light-b': withAlpha(accent, 0.55),

    '--av-btn-primary-shadow': withAlpha(primary, 0.28),
    '--av-btn-primary-shadow-hover': withAlpha(primary, 0.38),
    '--av-btn-outline-hover-bg': withAlpha(accent, 0.08),
    '--av-btn-outline-hover-bg-soft': withAlpha(accent, 0.06),
    '--av-btn-accent-bg': `linear-gradient(135deg, ${mixHex(accent, '#34d399', 0.35)}, ${accent})`,
    '--av-btn-gradient': `linear-gradient(135deg, ${primaryDark} 0%, ${accent} 100%)`,
    '--av-btn-gradient-alt': `linear-gradient(135deg, ${mixHex(primaryDark, bg, 0.35)}, ${primaryDark})`,

    '--av-hero-accent-glow': withAlpha(accent, 0.45),
    '--av-hero-title-shimmer': mixHex(accent, '#ffffff', 0.75),
    '--av-hero-info-card-bg': `linear-gradient(145deg, ${mixHex('#e0f2fe', accent, 0.35)} 0%, ${mixHex('#dbeafe', primary, 0.3)} 48%, ${mixHex('#bfdbfe', primaryDark, 0.25)} 100%)`,
    '--av-hero-info-card-border': withAlpha(accent, 0.45),
    '--av-hero-info-card-glow': withAlpha(accent, 0.12),
    '--av-hero-info-card-glow-hover': withAlpha(accent, 0.28),
    '--av-hero-info-card-border-hover': withAlpha(accent, 0.85),
    '--av-hero-info-card-title': `linear-gradient(90deg, ${darkenHex(primaryDark, 0.12)} 0%, ${primaryDark} 55%, ${mixHex(primaryDark, accent, 0.4)} 100%)`,

    '--av-title-glow': withAlpha(accent, 0.35),
    '--av-title-underline-light': `linear-gradient(90deg, ${primaryDark}, ${mixHex(primaryDark, accent, 0.45)})`,
    '--av-link-primary': primaryDark,

    '--av-page-body-light-bg': `linear-gradient(180deg, ${mixHex('#eef2ff', primary, 0.08)} 0%, ${mixHex('#f0f9ff', accent, 0.06)} 40%, ${mixHex('#ecfeff', accent, 0.04)} 100%)`,
    '--av-blog-page-bg': `linear-gradient(180deg, ${mixHex('#eef2ff', primary, 0.08)} 0%, #f8fafc 20%, #fff 100%)`,

    '--av-app-phone-screen-bg': `linear-gradient(180deg, ${surface} 0%, ${bg} 100%)`,
    '--av-app-phone-bezel-bg': `linear-gradient(145deg, ${mixHex(surface, '#ffffff', 0.08)} 0%, ${darkenHex(bg, 0.15)} 55%, ${surface2} 100%)`,

    '--av-primary-a06': withAlpha(primary, 0.06),
    '--av-primary-a12': withAlpha(primary, 0.12),
    '--av-primary-a15': withAlpha(primary, 0.15),
    '--av-primary-a18': withAlpha(primary, 0.18),
    '--av-primary-a22': withAlpha(primary, 0.22),
    '--av-primary-a28': withAlpha(primary, 0.28),
    '--av-primary-a30': withAlpha(primary, 0.3),
    '--av-primary-a35': withAlpha(primary, 0.35),
    '--av-primary-a38': withAlpha(primary, 0.38),
    '--av-primary-a42': withAlpha(primary, 0.42),
    '--av-primary-a45': withAlpha(primary, 0.45),
    '--av-primary-a50': withAlpha(primary, 0.5),

    '--av-accent-a08': withAlpha(accent, 0.08),
    '--av-accent-a12': withAlpha(accent, 0.12),
    '--av-accent-a14': withAlpha(accent, 0.14),
    '--av-accent-a18': withAlpha(accent, 0.18),
    '--av-accent-a22': withAlpha(accent, 0.22),
    '--av-accent-a25': withAlpha(accent, 0.25),
    '--av-accent-a28': withAlpha(accent, 0.28),
    '--av-accent-a30': withAlpha(accent, 0.3),
    '--av-accent-a35': withAlpha(accent, 0.35),
    '--av-accent-a45': withAlpha(accent, 0.45),
    '--av-accent-a85': withAlpha(accent, 0.85),

    '--av-app-mobile-glow': `radial-gradient(circle, ${withAlpha(accent, 0.22)} 0%, ${withAlpha(primary, 0.08)} 45%, transparent 70%)`,
    '--av-app-mobile-icon-bg': withAlpha(accent, 0.12),
    '--av-app-mobile-icon-border': withAlpha(accent, 0.25),
    '--av-app-mobile-download-shadow': withAlpha(primary, 0.35),
    '--av-app-mobile-download-shadow-hover': withAlpha(primary, 0.45),

    '--dash-primary': primary,
    '--dash-primary-hover': primaryDark,
    '--dash-accent': accent,

    '--av-fundacion-cta-bg': `linear-gradient(120deg, ${primary} 0%, ${mixHex(primaryDark, accent, 0.5)} 50%, ${mixHex(accent, '#ea580c', 0.35)} 100%)`,
  };

  vars['--av-starfield-bg'] =
    `radial-gradient(ellipse 90% 70% at 50% 30%, ${vars['--av-starfield-glow']}, transparent 70%), linear-gradient(180deg, ${vars['--av-starfield-top']} 0%, ${vars['--av-starfield-mid']} 55%, ${vars['--av-starfield-bottom']} 100%)`;
  vars['--av-starfield-accent-glow-radial'] =
    `radial-gradient(circle, ${withAlpha(accent, 0.16)} 0%, ${withAlpha(accent, 0.05)} 38%, transparent 68%)`;
  vars['--av-hero-bg'] =
    `radial-gradient(ellipse 85% 65% at 18% 42%, ${vars['--av-starfield-glow']}, transparent 68%), linear-gradient(135deg, ${vars['--av-hero-grad-start']} 0%, ${vars['--av-hero-grad-end']} 78%)`;

  if (isFinstruvialTema(t)) {
    return { ...vars, ...FINSTRUVIAL_DERIVED_CSS_VARS };
  }
  if (isEducarteTema(t)) {
    return { ...vars, ...EDUCARTE_DERIVED_CSS_VARS };
  }
  return vars;
}
