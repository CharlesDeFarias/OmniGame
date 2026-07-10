import { PROFILE } from '../config/profile';

/** User haptics toggle (pause sheet). Default ON; profile flag gates the whole feature. */
const KEY = 'omnigame.haptics.v1';

export function hapticsEnabled(): boolean {
  if (!PROFILE.features.haptics) return false;
  try {
    return window.localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // Storage is polish, never a dependency.
  }
}

/** Vibrate iff the device supports it AND the player hasn't turned haptics off. */
export function vibrate(ms: number): void {
  if (hapticsEnabled() && navigator.vibrate) navigator.vibrate(ms);
}
