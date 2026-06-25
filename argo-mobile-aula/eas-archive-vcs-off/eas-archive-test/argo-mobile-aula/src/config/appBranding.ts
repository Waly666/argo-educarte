import type { ImageSourcePropType } from 'react-native';

/**
 * Marca embebida en la app (APK). No depende de red ni del servidor.
 */
export const APP_BRANDING = {
  tituloApp: 'AULA VIRTUAL',
  nombreEmpresa: 'FUNDACION EDUCARTE COLOMBIA',
  logo: require('../../assets/branding/logo.png') as ImageSourcePropType,
} as const;
