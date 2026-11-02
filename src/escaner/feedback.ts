// Beep + vibración según el resultado del escaneo.
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect } from 'react';
import { Platform, Vibration } from 'react-native';

import type { TipoResultado } from './resolver';

const BEEP = require('../../assets/sonidos/beep.wav');

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function vibrar(tipo: TipoResultado) {
  if (Platform.OS === 'web') return;
  try {
    if (tipo === 'ok') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (tipo === 'duplicado') {
      // Vibración corta doble.
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await espera(140);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (tipo === 'otra_seccion') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      // Inválido: vibración larga.
      Vibration.vibrate(500);
    }
  } catch {
    // Algunos equipos no tienen motor de vibración: no es un error.
  }
}

export function useFeedbackEscaneo() {
  const player = useAudioPlayer(BEEP);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);

  return useCallback(
    (tipo: TipoResultado) => {
      if (tipo === 'ok') {
        try {
          void player.seekTo(0);
          player.play();
        } catch {
          // Sin audio disponible: basta la vibración.
        }
      }
      void vibrar(tipo);
    },
    [player],
  );
}
