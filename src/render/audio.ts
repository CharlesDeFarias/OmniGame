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
