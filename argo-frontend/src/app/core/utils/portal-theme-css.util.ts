import {
  buildPortalThemeCssVars as buildAvThemeVars,
  isEducarteTema,
  isLightColor,
  PORTAL_TEMA_FINSTRUVIAL,
  withAlpha,
  type PortalTemaLike,
} from './portal-theme-css-base.util';

export {
  EDUCARTE_DERIVED_CSS_VARS,
  FINSTRUVIAL_DERIVED_CSS_VARS,
  isEducarteTema,
  isFinstruvialTema,
  isLightColor,
  PORTAL_TEMA_EDUCARTE,
  PORTAL_TEMA_FINSTRUVIAL,
  withAlpha,
  type PortalTemaLike,
} from './portal-theme-css-base.util';

/** Variables --av-* + --pv-* para la vista previa del editor. */
export function buildPortalThemeCssVars(tema: PortalTemaLike | null | undefined): Record<string, string> {
  const av = buildAvThemeVars(tema);
  const primary = av['--av-primary'];
  const accent = av['--av-accent'];
  const bg = av['--av-bg'];
  const light = isLightColor(bg);
  const educarte = isEducarteTema(tema);
  const heroEnd = av['--av-hero-grad-end'] || bg;

  return {
    ...av,
    '--pv-primary': primary,
    '--pv-primary-dark': av['--av-primary-dark'],
    '--pv-accent': accent,
    '--pv-bg': bg,
    '--pv-surface': av['--av-surface'],
    '--pv-text': av['--av-text'],
    '--pv-dim': av['--av-dim'],
    '--pv-font': av['--av-font-sans'],
    '--pv-hero-start': av['--av-hero-grad-start'],
    '--pv-hero-end': heroEnd,
    '--pv-hero-glow': withAlpha(primary, educarte ? 0.48 : light ? 0.28 : 0.55),
    '--pv-hero-accent-glow': withAlpha(accent, educarte ? 0.32 : light ? 0.2 : 0.25),
    '--pv-hero-text': educarte ? '#f8fafc' : av['--av-text'],
    '--pv-hero-dim': educarte ? 'rgba(226, 232, 240, 0.86)' : av['--av-dim'],
    '--pv-nav-active-bg': educarte ? 'rgba(20, 184, 166, 0.14)' : av['--av-primary-a22'],
    '--pv-topbar-bg': educarte ? 'rgba(7, 5, 26, 0.94)' : av['--av-surface'],
    '--pv-topbar-text': educarte ? 'rgba(226, 232, 240, 0.82)' : av['--av-dim'],
    '--pv-highlight-ring': av['--av-accent-a35'],
    '--pv-quote-band': av['--av-quote-band-bg'],
    '--pv-faq-bg': av['--av-faq-bg'],
    '--pv-footer-bg': av['--av-footer-bg'],
  };
}
