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

/** Portal público — tema Educarte (verde institucional + crema + dorado, ref. MISIÓN). */
export const EDUCARTE_PUBLIC: ThemeColors = {
  primary: '#0B4D3C',
  primaryDark: '#063828',
  accent: '#C5A059',
  brand: '#0B4D3C',
  bg: '#FDFBF7',
  bgSoft: '#F5F0E8',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  text: '#1A2E24',
  textSoft: '#4A6358',
  border: 'rgba(11, 77, 60, 0.16)',
  borderLight: 'rgba(197, 160, 89, 0.18)',
  headerBg: 'rgba(6, 56, 40, 0.96)',
  headerBorder: 'rgba(197, 160, 89, 0.28)',
  headerTitle: '#FDFBF7',
  headerSubtitle: 'rgba(253, 251, 247, 0.78)',
  ok: '#1A7A55',
  okSoft: 'rgba(26, 122, 85, 0.12)',
  warn: '#B8860B',
  warnSoft: 'rgba(197, 160, 89, 0.16)',
  danger: '#B91C1C',
  dangerSoft: 'rgba(185, 28, 28, 0.12)',
  accentSoft: 'rgba(197, 160, 89, 0.14)',
  inputBg: '#FFFFFF',
  inputText: '#1A2E24',
  inputPlaceholder: '#4A6358',
  tabBar: '#FDFBF7',
  tabBarActive: '#0B4D3C',
  overlay: 'rgba(26, 46, 36, 0.45)',
  gold: '#C5A059',
  goldSoft: 'rgba(197, 160, 89, 0.14)',
  violet: '#0B4D3C',
  violetSoft: 'rgba(11, 77, 60, 0.1)',
  foroSoft: 'rgba(197, 160, 89, 0.1)',
  gradient: ['#F5F0E8', '#FDFBF7'],
  gradientHero: ['#FDFBF7', '#F5F0E8', '#EBE4D6'],
  gradientGold: ['#F5F0E8', '#FDFBF7'],
  gradientViolet: ['#E8F0EC', '#FDFBF7'],
  gradientForo: ['#F5F0E8', '#FFFFFF'],
  gradientPrimary: ['#0B4D3C', '#063828'],
  gradientAccent: ['#C5A059', '#A8844A'],
  gradientDashHero: ['#063828', '#0B4D3C', '#C5A059'],
  starGlow: 'rgba(197, 160, 89, 0.28)',
};

/** Panel del estudiante — claro con acentos verde Educarte. */
export const EDUCARTE_DASHBOARD: ThemeColors = {
  primary: '#0B4D3C',
  primaryDark: '#063828',
  accent: '#C5A059',
  brand: '#0B4D3C',
  bg: '#F8FAFC',
  bgSoft: '#F5F0E8',
  card: '#ffffff',
  cardElevated: '#ffffff',
  text: '#1A2E24',
  textSoft: '#4A6358',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  headerBg: '#063828',
  headerBorder: 'rgba(255,255,255,0.1)',
  headerTitle: '#f8fafc',
  headerSubtitle: 'rgba(248, 250, 252, 0.78)',
  ok: '#059669',
  okSoft: '#ECFDF5',
  warn: '#B8860B',
  warnSoft: '#FFFBEB',
  danger: '#dc2626',
  dangerSoft: '#FEF2F2',
  accentSoft: 'rgba(197, 160, 89, 0.14)',
  inputBg: '#ffffff',
  inputText: '#1A2E24',
  inputPlaceholder: '#94a3b8',
  tabBar: '#ffffff',
  tabBarActive: '#0B4D3C',
  overlay: 'rgba(15, 23, 42, 0.45)',
  gold: '#C5A059',
  goldSoft: '#F5F0E8',
  violet: '#0B4D3C',
  violetSoft: '#E8F0EC',
  foroSoft: '#F5F0E8',
  gradient: ['#F5F0E8', '#F8FAFC'],
  gradientHero: ['#063828', '#0B4D3C'],
  gradientGold: ['#F5F0E8', '#FFFBEB'],
  gradientViolet: ['#E8F0EC', '#F5F0E8'],
  gradientForo: ['#F5F0E8', '#FFFFFF'],
  gradientPrimary: ['#0B4D3C', '#063828'],
  gradientAccent: ['#C5A059', '#A8844A'],
  gradientDashHero: ['#063828', '#0B4D3C', '#C5A059'],
  starGlow: 'rgba(197, 160, 89, 0.22)',
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
