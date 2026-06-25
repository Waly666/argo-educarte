export const colors = {
  primary: '#3578F0',
  primaryDark: '#2563D4',
  primaryLight: '#6B9AF5',
  accent: '#06b6d4',
  accentSoft: '#e8eaf6',
  bg: '#eef2ff',
  bgAlt: '#f8fafc',
  card: '#ffffff',
  text: '#1e1b4b',
  textSoft: '#64748b',
  border: '#e2e8f0',
  danger: '#dc2626',
  dangerBg: '#fef2f2',
  warn: '#ea580c',
  warnBg: '#fff7ed',
  ok: '#16a34a',
  okBg: '#f0fdf4',
  shadow: '#3578F0',
};

export function themeColors(highContrast: boolean) {
  if (!highContrast) return colors;
  return {
    ...colors,
    bg: '#0f172a',
    bgAlt: '#1e293b',
    card: '#1e293b',
    text: '#f8fafc',
    textSoft: '#cbd5e1',
    border: '#475569',
    primary: '#93c5fd',
    primaryDark: '#60a5fa',
    primaryLight: '#bfdbfe',
    accent: '#67e8f9',
    accentSoft: '#164e63',
    shadow: '#000000',
  };
}
