import type { ExpoConfig } from 'expo/config';

// La URL del backend va en .env como EXPO_PUBLIC_API_URL (ver .env.example).
const config: ExpoConfig = {
  name: 'Asistencia Escolar',
  slug: 'asistencia-escolar',
  version: '1.0.0',
  scheme: 'asistencia',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  backgroundColor: '#F4F3EE',
  ios: {
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription: 'La cámara se usa para escanear carnets QR y fotografiar constancias.',
      NSPhotoLibraryUsageDescription: 'Se usa para adjuntar la foto de una constancia de justificación.',
    },
  },
  android: {
    package: 'pe.edu.asistenciaescolar',
    adaptiveIcon: {
      backgroundColor: '#14213D',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-sqlite',
    'expo-secure-store',
    'expo-font',
    [
      'expo-splash-screen',
      { backgroundColor: '#F4F3EE', image: './assets/splash-icon.png', imageWidth: 120 },
    ],
    [
      'expo-image-picker',
      { cameraPermission: 'La cámara se usa para fotografiar la constancia de justificación.' },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'La cámara se usa para escanear el QR de los carnets de asistencia.',
        recordAudioAndroid: false,
      },
    ],
    // Solo un beep corto al escanear: no hace falta audio en segundo plano.
    ['expo-audio', { enableBackgroundPlayback: false }],
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
