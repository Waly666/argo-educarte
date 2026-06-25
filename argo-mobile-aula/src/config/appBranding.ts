import type { ImageSourcePropType } from 'react-native';

/** Marca embebida en la app (APK). Fallback si no hay red o config del portal. */
export const APP_BRANDING = {
  tituloApp: 'Educarte Aula',
  nombreEmpresa: 'FUNDACION EDUCARTE COLOMBIA',
  heroTitulo: 'Educación y oportunidades que transforman comunidades.',
  heroSubtitulo:
    'Formación virtual, proyectos sociales y acompañamiento para personas y familias, con énfasis en el Cauca y en quienes más lo necesitan.',
  logo: require('../../assets/branding/logo.png') as ImageSourcePropType,
  heroLocal: require('../../assets/branding/hero_portal.png') as ImageSourcePropType,
} as const;
