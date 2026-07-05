import type Phaser from 'phaser';

export interface Blips {
  unlock(): void;
  match(): void;
  matchAt(wave: number): void;
  booster(): void;
  gift(): void;
  win(): void;
  lose(): void;
  beat(): void;
  ding(): void;
  setMuted(m: boolean): void;
  muted(): boolean;
}

export function createBlips(): Blips {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  let isMuted = false;
  const tone = (freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.12): void => {
    if (isMuted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + start);
    o.stop(ctx.currentTime + start + dur + 0.05);
  };
  const matchAt = (wave: number): void => {
    const m = 1 + Math.min(wave, 6) * 0.12;
    tone(520 * m, 0, 0.12);
    tone(660 * m, 0.05, 0.12);
  };
  return {
    unlock() { if (ctx.state === 'suspended') void ctx.resume(); },
    match() { matchAt(0); },
    matchAt,
    booster() { tone(220, 0, 0.2, 'square', 0.1); tone(330, 0.08, 0.18, 'square', 0.08); },
    gift() { tone(440, 0, 0.1); tone(550, 0.09, 0.1); tone(660, 0.18, 0.14); },
    win() { tone(523, 0, 0.15); tone(659, 0.12, 0.15); tone(784, 0.24, 0.25); },
    lose() { tone(392, 0, 0.2); tone(330, 0.15, 0.3); },
    beat() { tone(880, 0, 0.06, 'square', 0.08); },
    ding() { tone(1046, 0, 0.25); },
    setMuted(m) { isMuted = m; },
    muted: () => isMuted,
  };
}

// ---------------------------------------------------------------------------
// Real sound effects (RM-feel milestone): CC0 .ogg files loaded by
// PreloadScene from public/assets/audio (see MANIFEST.md there). sfx() is the
// single gate: it plays the loaded sound iff the file actually arrived AND the
// player is not muted, otherwise it falls back to the closest procedural blip
// so a missing/failed download never silences the game (never-strand rule).
// ---------------------------------------------------------------------------

/** localStorage mute flag — same path every scene's mute toggle writes. */
const MUTE_KEY = 'omnigame.muted.v1';

/** Loaded-audio keys: one role per file at public/assets/audio/<key>.ogg. */
export const SFX_KEYS = [
  'match-pop-1', 'match-pop-2', 'match-pop-3',
  'cascade-tick', 'rocket-whoosh', 'explosion-boom', 'lightning-zap',
  'propeller-whir', 'piece-drop', 'collect-ding', 'click',
  'win-fanfare', 'lose-soft', 'coin-clink', 'star-pop', 'celebration-burst',
] as const;

export type SfxKey = (typeof SFX_KEYS)[number];

/** Closest procedural blip for each role, used when the .ogg never loaded. */
const FALLBACK_BLIP: Record<SfxKey, (b: Blips) => void> = {
  'match-pop-1': (b) => b.match(),
  'match-pop-2': (b) => b.match(),
  'match-pop-3': (b) => b.match(),
  'cascade-tick': (b) => b.beat(),
  'rocket-whoosh': (b) => b.booster(),
  'explosion-boom': (b) => b.booster(),
  'lightning-zap': (b) => b.booster(),
  'propeller-whir': (b) => b.booster(),
  'piece-drop': (b) => b.beat(),
  'collect-ding': (b) => b.ding(),
  'click': (b) => b.beat(),
  'win-fanfare': (b) => b.win(),
  'lose-soft': (b) => b.lose(),
  'coin-clink': (b) => b.ding(),
  'star-pop': (b) => b.ding(),
  'celebration-burst': (b) => b.gift(),
};

/** Lazy shared blip synth for fallbacks (mute is checked before it is hit). */
let fallbackBlips: Blips | null = null;

/**
 * Play a loaded sound effect if it exists and the player is not muted; fall
 * back to the mapped procedural blip when the file is missing. Errors are
 * swallowed — audio is polish, never a dependency.
 */
export function sfx(scene: Phaser.Scene, key: SfxKey, config?: Phaser.Types.Sound.SoundConfig): void {
  try {
    if (window.localStorage.getItem(MUTE_KEY) === '1') return;
    if (scene.cache.audio.exists(key)) {
      scene.sound.play(key, config);
      return;
    }
    fallbackBlips ??= createBlips();
    fallbackBlips.unlock();
    FALLBACK_BLIP[key](fallbackBlips);
  } catch {
    // Audio must never break gameplay.
  }
}
