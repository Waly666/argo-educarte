import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

let soundReady: Audio.Sound | null = null;
let loading: Promise<void> | null = null;

async function ensureSound(): Promise<Audio.Sound | null> {
  if (soundReady) return soundReady;
  if (loading) {
    await loading;
    return soundReady;
  }
  loading = (async () => {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    const { sound } = await Audio.Sound.createAsync(require('../../assets/sounds/argo-alerta.wav'));
    soundReady = sound;
  })();
  try {
    await loading;
  } finally {
    loading = null;
  }
  return soundReady;
}

export async function playAlertFeedback(opts: {
  sound: boolean;
  vibration: boolean;
  critico?: boolean;
}): Promise<void> {
  if (opts.vibration) {
    if (opts.critico) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await new Promise((r) => setTimeout(r, 120));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }
  if (!opts.sound) return;
  const s = await ensureSound();
  if (!s) return;
  try {
    await s.setPositionAsync(0);
    await s.playAsync();
  } catch {
    /* ignore playback errors */
  }
}

export async function unloadAlertSound(): Promise<void> {
  if (soundReady) {
    await soundReady.unloadAsync();
    soundReady = null;
  }
}
