import type { PortalTemaConfig } from '../api/types';

export type ThemeColors = {
  primary: string;
  primaryDark: string;
  accent: string;
  brand: string;
  bg: string;
  bgSoft: string;
  card: string;
  cardElevated: string;
  text: string;
  textSoft: string;
  border: string;
  borderLight: string;
  headerBg: string;
  headerBorder: string;
  headerTitle: string;
  headerSubtitle: string;
  ok: string;
  okSoft: string;
  warn: string;
  warnSoft: string;
  danger: string;
  dangerSoft: string;
  accentSoft: string;
  inputBg: string;
  inputText: string;
  inputPlaceholder: string;
  tabBar: string;
  tabBarActive: string;
  overlay: string;
  gold: string;
  goldSoft: string;
  violet: string;
  violetSoft: string;
  sky: string;
  skySoft: string;
  coral: string;
  coralSoft: string;
  mint: string;
  mintSoft: string;
  foroSoft: string;
  gradient: [string, string];
  gradientHero: [string, string] | [string, string, string];
  gradientGold: [string, string];
  gradientViolet: [string, string];
  gradientForo: [string, string];
  gradientPrimary: [string, string];
  gradientAccent: [string, string];
  gradientWarm: [string, string];
  gradientSky: [string, string];
  gradientDashHero: [string, string, string] | [string, string, string, string];
  gradientCourse: [string, string] | [string, string, string];
  starGlow: string;
};

export type AccentSwatch = { color: string; soft: string };

const PUBLIC_BASE: ThemeColors = {
  primary: '#6366F1',
  primaryDark: '#4338CA',
  accent: '#14B8A6',
  brand: '#6366F1',
  bg: '#F8FAFC',
  bgSoft: '#FDFBF7',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  text: '#0F172A',
  textSoft: '#64748B',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  headerBg: '#4338CA',
  headerBorder: 'rgba(99, 102, 241, 0.22)',
  headerTitle: '#F8FAFC',
  headerSubtitle: 'rgba(248, 250, 252, 0.78)',
  ok: '#10B981',
  okSoft: '#ECFDF5',
  warn: '#F59E0B',
  warnSoft: '#FFFBEB',
  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  accentSoft: '#CCFBF1',
  inputBg: '#FFFFFF',
  inputText: '#0F172A',
  inputPlaceholder: '#94A3B8',
  tabBar: '#FFFFFF',
  tabBarActive: '#6366F1',
  overlay: 'rgba(15, 23, 42, 0.45)',
  gold: '#F59E0B',
  goldSoft: '#FEF3C7',
  violet: '#8B5CF6',
  violetSoft: '#EDE9FE',
  sky: '#38BDF8',
  skySoft: '#E0F2FE',
  coral: '#F472B6',
  coralSoft: '#FCE7F3',
  mint: '#34D399',
  mintSoft: '#D1FAE5',
  foroSoft: '#ECFEFF',
  gradient: ['#FDFBF7', '#F8FAFC'],
  gradientHero: ['#6366F1', '#8B5CF6', '#38BDF8'],
  gradientGold: ['#FBBF24', '#F59E0B'],
  gradientViolet: ['#EDE9FE', '#F5F3FF'],
  gradientForo: ['#ECFEFF', '#F0FDFA'],
  gradientPrimary: ['#6366F1', '#4338CA'],
  gradientAccent: ['#14B8A6', '#0D9488'],
  gradientWarm: ['#F472B6', '#F59E0B'],
  gradientSky: ['#38BDF8', '#6366F1'],
  gradientDashHero: ['#6366F1', '#8B5CF6', '#38BDF8', '#14B8A6'],
  gradientCourse: ['#8B5CF6', '#38BDF8', '#14B8A6'],
  starGlow: 'rgba(139, 92, 246, 0.28)',
};

/** Portal público — crema + índigo + morado + cielo + menta + coral. */
export const EDUCARTE_PUBLIC: ThemeColors = { ...PUBLIC_BASE };

/** Panel del estudiante — mismos acentos, fondo con lavanda suave. */
export const EDUCARTE_DASHBOARD: ThemeColors = {
  ...PUBLIC_BASE,
  bgSoft: '#EEF2FF',
  gradient: ['#EEF2FF', '#F8FAFC'],
  gradientHero: ['#4338CA', '#6366F1', '#38BDF8'],
  starGlow: 'rgba(99, 102, 241, 0.25)',
};

/** @deprecated alias */
export const FINSTRUVIAL_PUBLIC = EDUCARTE_PUBLIC;
/** @deprecated alias */
export const FINSTRUVIAL_DASHBOARD = EDUCARTE_DASHBOARD;

/** Paleta rotativa para iconos, chips y tarjetas. */
export function accentSwatch(index: number, colors: ThemeColors = EDUCARTE_PUBLIC): AccentSwatch {
  const palette: AccentSwatch[] = [
    { color: colors.primary, soft: colors.violetSoft },
    { color: colors.violet, soft: colors.violetSoft },
    { color: colors.sky, soft: colors.skySoft },
    { color: colors.accent, soft: colors.accentSoft },
    { color: colors.coral, soft: colors.coralSoft },
    { color: colors.mint, soft: colors.mintSoft },
    { color: colors.gold, soft: colors.goldSoft },
  ];
  const i = ((index % palette.length) + palette.length) % palette.length;
  return palette[i]!;
}

function isDarkHex(hex?: string): boolean {
  const h = (hex || '').replace('#', '').trim();
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return false;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum < 0.42;
}

/** Solo aplica del portal colores de superficie/texto claros; la app mantiene acentos juveniles. */
function mergePortalColors(base: ThemeColors, tema?: PortalTemaConfig): ThemeColors {
  if (!tema) return base;
  const next = { ...base };
  if (tema.colorFondo && !isDarkHex(tema.colorFondo)) next.bg = tema.colorFondo;
  if (tema.colorSuperficie && !isDarkHex(tema.colorSuperficie)) {
    next.card = tema.colorSuperficie;
    next.cardElevated = tema.colorSuperficie;
  }
  if (tema.colorTexto && !isDarkHex(tema.colorTexto)) next.text = tema.colorTexto;
  if (tema.colorTextoSecundario) next.textSoft = tema.colorTextoSecundario;
  return next;
}

export type ThemeVariant = 'public' | 'dashboard';

export function themeForVariant(variant: ThemeVariant, tema?: PortalTemaConfig): ThemeColors {
  const base = variant === 'dashboard' ? EDUCARTE_DASHBOARD : EDUCARTE_PUBLIC;
  return mergePortalColors(base, variant === 'public' ? tema : undefined);
}

export function themeFromPortal(tema?: PortalTemaConfig) {
  return themeForVariant('public', tema);
}
