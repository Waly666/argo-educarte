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

/** Portal público — estilo finstruvial.edu.co (starfield oscuro). */
export const FINSTRUVIAL_PUBLIC: ThemeColors = {
  primary: '#3b82f6',
  primaryDark: '#1d4ed8',
  accent: '#22d3ee',
  brand: '#c2410c',
  bg: '#0b1224',
  bgSoft: '#101b3c',
  card: '#121c33',
  cardElevated: '#1a2744',
  text: '#eef3ff',
  textSoft: '#9fb0d0',
  border: 'rgba(148, 163, 184, 0.28)',
  borderLight: 'rgba(148, 163, 184, 0.14)',
  headerBg: 'rgba(11, 18, 36, 0.96)',
  headerBorder: 'rgba(56, 189, 248, 0.18)',
  headerTitle: '#eef3ff',
  headerSubtitle: '#9fb0d0',
  ok: '#34d399',
  okSoft: 'rgba(52, 211, 153, 0.14)',
  warn: '#fbbf24',
  warnSoft: 'rgba(251, 191, 36, 0.14)',
  danger: '#f87171',
  dangerSoft: 'rgba(248, 113, 113, 0.14)',
  accentSoft: 'rgba(34, 211, 238, 0.12)',
  inputBg: '#0f1729',
  inputText: '#eef3ff',
  inputPlaceholder: '#64748b',
  tabBar: '#0b1224',
  tabBarActive: '#22d3ee',
  overlay: 'rgba(7, 13, 38, 0.72)',
  gold: '#fbbf24',
  goldSoft: 'rgba(251, 191, 36, 0.14)',
  violet: '#a78bfa',
  violetSoft: 'rgba(167, 139, 250, 0.14)',
  foroSoft: 'rgba(34, 211, 238, 0.12)',
  gradient: ['#101b3c', '#0b1224'],
  gradientHero: ['#101b3c', '#0a1130', '#070d26'],
  gradientGold: ['#422006', '#1a2744'],
  gradientViolet: ['#312e81', '#1a2744'],
  gradientForo: ['#0e7490', '#1a2744'],
  gradientPrimary: ['#3b82f6', '#1d4ed8'],
  gradientAccent: ['#34d399', '#14b8a6'],
  gradientDashHero: ['#ffffff', '#f5f3ff', '#ecfdf5'],
  starGlow: 'rgba(34, 211, 238, 0.22)',
};

/** Panel del estudiante — academia moderna (navy + teal, contraste claro al portal público). */
export const FINSTRUVIAL_DASHBOARD: ThemeColors = {
  primary: '#2563eb',
  primaryDark: '#1e3a8a',
  accent: '#0d9488',
  brand: '#ea580c',
  bg: '#eef2f7',
  bgSoft: '#e2e8f0',
  card: '#ffffff',
  cardElevated: '#ffffff',
  text: '#0f172a',
  textSoft: '#64748b',
  border: '#dbe3ef',
  borderLight: '#edf2f7',
  headerBg: '#0f172a',
  headerBorder: 'rgba(255,255,255,0.08)',
  headerTitle: '#f8fafc',
  headerSubtitle: 'rgba(248, 250, 252, 0.72)',
  ok: '#059669',
  okSoft: '#ecfdf5',
  warn: '#d97706',
  warnSoft: '#fffbeb',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  accentSoft: '#ccfbf1',
  inputBg: '#ffffff',
  inputText: '#0f172a',
  inputPlaceholder: '#94a3b8',
  tabBar: '#ffffff',
  tabBarActive: '#2563eb',
  overlay: 'rgba(15, 23, 42, 0.45)',
  gold: '#b45309',
  goldSoft: '#fef3c7',
  violet: '#6366f1',
  violetSoft: '#eef2ff',
  foroSoft: '#ecfeff',
  gradient: ['#eef2ff', '#eef2f7'],
  gradientHero: ['#1e3a8a', '#2563eb'],
  gradientGold: ['#fef3c7', '#fffbeb'],
  gradientViolet: ['#eef2ff', '#f5f3ff'],
  gradientForo: ['#ecfeff', '#f0fdfa'],
  gradientPrimary: ['#2563eb', '#1d4ed8'],
  gradientAccent: ['#14b8a6', '#0d9488'],
  gradientDashHero: ['#0f172a', '#1e3a8a', '#2563eb'],
  starGlow: 'rgba(37, 99, 235, 0.2)',
};

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
    gradientPrimary: [tema.colorPrimario || base.primary, tema.colorPrimarioOscuro || base.primaryDark],
  };
}

export type ThemeVariant = 'public' | 'dashboard';

export function themeForVariant(variant: ThemeVariant, tema?: PortalTemaConfig): ThemeColors {
  const base = variant === 'dashboard' ? FINSTRUVIAL_DASHBOARD : FINSTRUVIAL_PUBLIC;
  return mergePortalColors(base, variant === 'public' ? tema : undefined);
}

/** @deprecated use themeForVariant */
export function themeFromPortal(tema?: PortalTemaConfig) {
  return themeForVariant('public', tema);
}
