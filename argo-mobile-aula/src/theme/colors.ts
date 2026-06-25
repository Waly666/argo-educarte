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
  foroSoft: string;
  gradient: [string, string];
  gradientHero: [string, string] | [string, string, string];
  gradientGold: [string, string];
  gradientViolet: [string, string];
  gradientForo: [string, string];
  gradientPrimary: [string, string];
  gradientAccent: [string, string];
  gradientDashHero: [string, string, string];
  starGlow: string;
};

/** Portal público — tema Educarte (índigo + teal, hero oscuro como el sitio web). */
export const EDUCARTE_PUBLIC: ThemeColors = {
  primary: '#6366F1',
  primaryDark: '#4338CA',
  accent: '#14B8A6',
  brand: '#6366F1',
  bg: '#07051a',
  bgSoft: '#12102e',
  card: '#1a2744',
  cardElevated: '#1e1b4b',
  text: '#f8fafc',
  textSoft: 'rgba(226, 232, 240, 0.86)',
  border: 'rgba(99, 102, 241, 0.28)',
  borderLight: 'rgba(148, 163, 184, 0.14)',
  headerBg: 'rgba(7, 5, 26, 0.96)',
  headerBorder: 'rgba(99, 102, 241, 0.22)',
  headerTitle: '#f8fafc',
  headerSubtitle: 'rgba(226, 232, 240, 0.72)',
  ok: '#34d399',
  okSoft: 'rgba(52, 211, 153, 0.14)',
  warn: '#fbbf24',
  warnSoft: 'rgba(251, 191, 36, 0.14)',
  danger: '#f87171',
  dangerSoft: 'rgba(248, 113, 113, 0.14)',
  accentSoft: 'rgba(20, 184, 166, 0.14)',
  inputBg: '#12102e',
  inputText: '#f8fafc',
  inputPlaceholder: '#94a3b8',
  tabBar: '#07051a',
  tabBarActive: '#14B8A6',
  overlay: 'rgba(7, 5, 26, 0.72)',
  gold: '#fbbf24',
  goldSoft: 'rgba(251, 191, 36, 0.14)',
  violet: '#6366F1',
  violetSoft: 'rgba(99, 102, 241, 0.18)',
  foroSoft: 'rgba(20, 184, 166, 0.12)',
  gradient: ['#12102e', '#07051a'],
  gradientHero: ['#07051a', '#1e1b4b', '#312e81'],
  gradientGold: ['#422006', '#1a2744'],
  gradientViolet: ['#312e81', '#1e1b4b'],
  gradientForo: ['#0f766e', '#1a2744'],
  gradientPrimary: ['#6366F1', '#4338CA'],
  gradientAccent: ['#14B8A6', '#0d9488'],
  gradientDashHero: ['#07051a', '#1e1b4b', '#4338CA'],
  starGlow: 'rgba(99, 102, 241, 0.35)',
};

/** Panel del estudiante — claro con acentos Educarte. */
export const EDUCARTE_DASHBOARD: ThemeColors = {
  primary: '#6366F1',
  primaryDark: '#4338CA',
  accent: '#14B8A6',
  brand: '#6366F1',
  bg: '#F8FAFC',
  bgSoft: '#EEF2FF',
  card: '#ffffff',
  cardElevated: '#ffffff',
  text: '#0F172A',
  textSoft: '#64748B',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  headerBg: '#4338CA',
  headerBorder: 'rgba(255,255,255,0.1)',
  headerTitle: '#f8fafc',
  headerSubtitle: 'rgba(248, 250, 252, 0.78)',
  ok: '#059669',
  okSoft: '#ECFDF5',
  warn: '#d97706',
  warnSoft: '#FFFBEB',
  danger: '#dc2626',
  dangerSoft: '#FEF2F2',
  accentSoft: '#CCFBF1',
  inputBg: '#ffffff',
  inputText: '#0F172A',
  inputPlaceholder: '#94a3b8',
  tabBar: '#ffffff',
  tabBarActive: '#6366F1',
  overlay: 'rgba(15, 23, 42, 0.45)',
  gold: '#b45309',
  goldSoft: '#FEF3C7',
  violet: '#6366F1',
  violetSoft: '#EEF2FF',
  foroSoft: '#ECFEFF',
  gradient: ['#EEF2FF', '#F8FAFC'],
  gradientHero: ['#4338CA', '#6366F1'],
  gradientGold: ['#FEF3C7', '#FFFBEB'],
  gradientViolet: ['#EEF2FF', '#F5F3FF'],
  gradientForo: ['#ECFEFF', '#F0FDFA'],
  gradientPrimary: ['#6366F1', '#4338CA'],
  gradientAccent: ['#14B8A6', '#0D9488'],
  gradientDashHero: ['#4338CA', '#6366F1', '#14B8A6'],
  starGlow: 'rgba(99, 102, 241, 0.25)',
};

/** @deprecated alias */
export const FINSTRUVIAL_PUBLIC = EDUCARTE_PUBLIC;
/** @deprecated alias */
export const FINSTRUVIAL_DASHBOARD = EDUCARTE_DASHBOARD;

function mergePortalColors(base: ThemeColors, tema?: PortalTemaConfig): ThemeColors {
  if (!tema) return base;
  return {
    ...base,
    primary: tema.colorPrimario || base.primary,
    primaryDark: tema.colorPrimarioOscuro || base.primaryDark,
    accent: tema.colorAcento || base.accent,
    bg: tema.colorFondo || base.bg,
    card: tema.colorSuperficie || base.card,
    text: tema.colorTexto || base.text,
    textSoft: tema.colorTextoSecundario || base.textSoft,
    brand: tema.colorPrimario || base.brand,
    gradientPrimary: [tema.colorPrimario || base.primary, tema.colorPrimarioOscuro || base.primaryDark],
    gradientHero: [
      tema.colorPrimarioOscuro || base.gradientHero[0],
      tema.colorPrimario || base.gradientHero[1],
      base.gradientHero[2] || base.bg,
    ],
  };
}

export type ThemeVariant = 'public' | 'dashboard';

export function themeForVariant(variant: ThemeVariant, tema?: PortalTemaConfig): ThemeColors {
  const base = variant === 'dashboard' ? EDUCARTE_DASHBOARD : EDUCARTE_PUBLIC;
  return mergePortalColors(base, variant === 'public' ? tema : undefined);
}

export function themeFromPortal(tema?: PortalTemaConfig) {
  return themeForVariant('public', tema);
}
