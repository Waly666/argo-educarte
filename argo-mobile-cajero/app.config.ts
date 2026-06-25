import type { ExpoConfig } from 'expo/config';

/**
 * APK cajero/admin ARGO. En `.env`:
 *   EXPO_PUBLIC_API_BASE_URL=http://72.60.175.120:5002/api
 * En LAN local: http://192.168.x.x:3000/api
 *
 * Splash: Android 12+ solo admite color de fondo + logo centrado (no imagen full-screen).
 * Expo Go ignora el splash y muestra el icono en blanco — usar APK o `pnpm android`.
 */
const AZUL = '#6366F1';
const LOGO = './assets/branding/logo.png';
const ICON = './assets/branding/icon-app.png';
const SPLASH_IOS = './assets/branding/splash-full.png';

const splashPlugin = {
  backgroundColor: AZUL,
  image: LOGO,
  imageWidth: 240,
  resizeMode: 'contain' as const,
  android: {
    backgroundColor: AZUL,
    image: LOGO,
    imageWidth: 240,
    resizeMode: 'contain' as const,
  },
  ios: {
    backgroundColor: AZUL,
    image: SPLASH_IOS,
    resizeMode: 'cover' as const,
    enableFullScreenImage_legacy: true,
  },
};

const config: ExpoConfig = {
  owner: 'nis00227',
  name: 'Educarte Cajero',
  slug: 'argo-cajero-educarte',
  version: '0.1.2',
  orientation: 'portrait',
  icon: ICON,
  backgroundColor: AZUL,
  primaryColor: AZUL,
  userInterfaceStyle: 'light',
  scheme: 'argocajero',
  splash: {
    image: LOGO,
    resizeMode: 'contain',
    backgroundColor: AZUL,
  },
  android: {
    icon: ICON,
    splash: {
      image: LOGO,
      resizeMode: 'contain',
      backgroundColor: AZUL,
    },
    adaptiveIcon: {
      foregroundImage: ICON,
      backgroundColor: AZUL,
    },
    package: 'co.educarte.cajero',
  },
  androidNavigationBar: {
    backgroundColor: AZUL,
  },
  ios: {
    icon: ICON,
    splash: {
      image: SPLASH_IOS,
      resizeMode: 'cover',
      backgroundColor: AZUL,
    },
  },
  plugins: [
    'expo-font',
    ['expo-splash-screen', splashPlugin],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Educarte Cajero necesita acceso a fotos para adjuntar documentos y escanear cédulas.',
        cameraPermission:
          'Educarte Cajero usa la cámara para fotografiar la cédula (frente arriba, respaldo abajo).',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Educarte Cajero usa la cámara con marco guía para escanear la cédula del alumno.',
      },
    ],
    'expo-secure-store',
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: true,
          enableMinifyInReleaseBuilds: false,
          enableShrinkResourcesInReleaseBuilds: false,
        },
      },
    ],
  ],
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3000/api',
    eas: {
      projectId: '4d602122-ccf4-4cc0-867e-606749e3d936',
    },
  },
};

export default config;
