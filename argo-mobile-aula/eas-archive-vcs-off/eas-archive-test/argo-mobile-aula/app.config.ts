import type { ExpoConfig } from 'expo/config';

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
  name: 'Educarte Aula',
  slug: 'argo-aula-educarte',
  version: '0.1.0',
  orientation: 'portrait',
  icon: ICON,
  backgroundColor: AZUL,
  primaryColor: AZUL,
  userInterfaceStyle: 'light',
  scheme: 'educarteaula',
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
    package: 'co.educarte.aula',
    softwareKeyboardLayoutMode: 'resize',
  },
  plugins: [
    'expo-font',
    'expo-secure-store',
    ['expo-splash-screen', splashPlugin],
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
      projectId: '4a60b9ae-8f00-4ac1-91bb-5cf381d1b741',
    },
  },
};

export default config;
