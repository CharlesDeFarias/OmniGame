import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';

/**
 * Shared scene chrome (plan 9, legit-look pass): smooth gradient backgrounds
 * with ambient glow + bokeh, camera-fade scene transitions, and a tactile
 * press-feel helper for every interactive object. Pure presentation — no
 * game state, safe to call from any scene after makeTextures().
 */

/** Fade curtain color for every transition: the deep midnight canvas (#141528-ish). */
const FADE = { r: 20, g: 21, b: 40 } as const;
const FADE_OUT_MS = 180;
const FADE_IN_MS = 200;

/** Channel-wise interpolation from a toward b by t (0..1). */
const mix = (a: number, b: number, t: number): number => {
  const chan = (shift: number): number => {
    const from = (a >> shift) & 0xff;
    const to = (b >> shift) & 0xff;
    return Math.round(from + (to - from) * t) << shift;
  };
  return chan(16) | chan(8) | chan(0);
};

/** Anything with a transform + events: images, sprites, shapes, text. */
type Pressable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;

/**
 * Hand-picked bokeh field: position, sprite scale, alpha, drift duration (ms),
 * x-sway amplitude (px) and start delay. Seeded offsets hardcoded so the field
 * looks composed rather than random-clumped; every scene shares the same sky.
 */
const BOKEH: readonly { x: number; y: number; s: number; a: number; d: number; sway: number; delay: number; tint: number }[] = [
  { x: 96, y: 214, s: 4.6, a: 0.08, d: 14000, sway: 36, delay: 0, tint: 0xf5c542 },
  { x: 610, y: 150, s: 3.4, a: 0.06, d: 18500, sway: 52, delay: 1200, tint: 0xffffff },
  { x: 356, y: 470, s: 5.8, a: 0.05, d: 20000, sway: 30, delay: 2600, tint: 0xfd79a8 },
  { x: 168, y: 700, s: 3.0, a: 0.09, d: 12500, sway: 44, delay: 700, tint: 0xffffff },
  { x: 560, y: 640, s: 4.2, a: 0.06, d: 16000, sway: 60, delay: 3400, tint: 0xf5c542 },
  { x: 70, y: 1020, s: 5.2, a: 0.05, d: 19000, sway: 38, delay: 1800, tint: 0xffffff },
  { x: 470, y: 1120, s: 3.6, a: 0.08, d: 13500, sway: 48, delay: 500, tint: 0xfd79a8 },
  { x: 650, y: 900, s: 6.0, a: 0.05, d: 17500, sway: 34, delay: 2200, tint: 0xf5c542 },
];

/**
 * Full-screen smooth vertical gradient (three stops, ~40 horizontal bands at
 * depth -3) + a soft gold glow upper-centre and slowly drifting bokeh dots at
 * depth -2.5. Returned objects are scene-lifetime; Phaser destroys them (and
 * their tweens) on scene shutdown, so no explicit cleanup is needed.
 */
export function buildBackground(
  scene: Phaser.Scene,
  topColor: number,
  midColor: number,
  bottomColor: number,
): Phaser.GameObjects.GameObject[] {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const bandH = 32;
  const n = Math.ceil(GAME_HEIGHT / bandH);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // Piecewise lerp through the mid stop at the halfway line.
    const color = t < 0.5 ? mix(topColor, midColor, t * 2) : mix(midColor, bottomColor, (t - 0.5) * 2);
    objs.push(
      scene.add
        .rectangle(GAME_WIDTH / 2, i * bandH + bandH / 2, GAME_WIDTH, bandH + 1, color)
        .setDepth(-3),
    );
  }
  // Ambient stage light: big gold radial glow, upper-centre.
  objs.push(
    scene.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT * 0.28, 'ui-glow')
      .setDisplaySize(1040, 1040)
      .setAlpha(0.1)
      .setDepth(-2.5),
  );
  // Drifting bokeh: slow vertical drift + gentler horizontal sway, offset phases.
  for (const b of BOKEH) {
    const pip = scene.add.sprite(b.x, b.y, 'ui-pip').setScale(b.s).setAlpha(b.a).setTint(b.tint).setDepth(-2.5);
    objs.push(pip);
    scene.tweens.add({
      targets: pip, y: b.y - 90, duration: b.d, delay: b.delay,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    scene.tweens.add({
      targets: pip, x: b.x + b.sway, duration: b.d * 0.62, delay: b.delay,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }
  return objs;
}

/** Every scene's create() opens with this: 200ms fade up from the curtain color. */
export function fadeIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(FADE_IN_MS, FADE.r, FADE.g, FADE.b);
}

/**
 * Scene navigation with a fade curtain: 180ms fade to the midnight color, then
 * scene.start. Re-entrant taps during the fade-out are swallowed (the first
 * destination wins); a still-running fade-IN is force-restarted as a fade-out,
 * so quick taps right after scene entry still navigate.
 */
export function goto(scene: Phaser.Scene, key: string): void {
  const cam = scene.cameras.main;
  if (cam.fadeEffect.isRunning && cam.fadeEffect.direction) return; // already leaving
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key));
  cam.fadeOut(FADE_OUT_MS, FADE.r, FADE.g, FADE.b);
}

/**
 * Tactile press feel: pointerdown squashes to 93% (80ms), release/leave springs
 * back (Back.easeOut, 160ms). Base scale is captured at attach time, so attach
 * AFTER the object reaches its resting scale. Extra non-interactive dressing
 * objects (rings, icons riding on a button) can be passed to squash in sync.
 * Coexists with looping pulse tweens: the press tween is created later, so it
 * wins while active and the pulse resumes on its own once it completes.
 */
export function pressify(scene: Phaser.Scene, obj: Pressable, ...also: Pressable[]): void {
  const base = [obj, ...also].map((t) => ({ t, sx: t.scaleX, sy: t.scaleY }));
  obj.on('pointerdown', () => {
    for (const { t, sx, sy } of base) {
      scene.tweens.add({ targets: t, scaleX: sx * 0.93, scaleY: sy * 0.93, duration: 80 });
    }
  });
  const restore = (): void => {
    for (const { t, sx, sy } of base) {
      scene.tweens.add({ targets: t, scaleX: sx, scaleY: sy, duration: 160, ease: 'Back.easeOut' });
    }
  };
  obj.on('pointerup', restore);
  obj.on('pointerout', restore);
}
