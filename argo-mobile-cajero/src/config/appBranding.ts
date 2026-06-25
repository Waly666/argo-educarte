import type { ImageSourcePropType } from 'react-native';

/** Índigo Educarte (splash, login y cabeceras). */
export const CAJERO_AZUL_REY = '#6366F1';
export const CAJERO_AZUL_REY_CLARO = '#818CF8';
/** Tiempo mínimo del splash de arranque antes del login (ms). */
export const SPLASH_MIN_MS = 2200;
/**
 * Marca embebida en la app (APK). Mismo logo que el aula virtual.
 * Para otra empresa: reemplace assets/branding/logo.png y regenere el APK.
 */
export const APP_BRANDING = {
  tituloApp: 'EDUCARTE CAJERO',
  nombreEmpresa: 'FUNDACION EDUCARTE COLOMBIA',
  logo: require('../../assets/branding/logo.png') as ImageSourcePropType,
} as const;
