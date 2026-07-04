import type Phaser from 'phaser';
import { PROFILE } from '../config/profile';
import type { Piece, PieceColor } from '../core/match3/index';
import { ROOMS } from '../meta/rooms';
import { PALETTE } from './palette';

export const COLOR_HEX: Record<PieceColor, number> = {
  red: 0xe74c3c,
  blue: 0x3498db,
  green: 0x2ecc71,
  yellow: 0xf1c40f,
  purple: 0x9b59b6,
  orange: 0xe67e22,
};

/**
 * RM-look milestone: keys point at the loaded CC0 pack art ('img-*', see
 * PreloadScene). The procedural generators below keep their old keys as the
 * live fallback layer (PreloadScene aliases 'img-*' onto them if a file ever
 * fails to load). Propeller is the one special still drawn procedurally: the
 * candy pack has no three-blade equivalent (judgment call, logged).
 */
export function textureKeyFor(piece: Piece): string {
  if (piece.kind === 'normal') return `img-gem-${piece.color}`;
  if (piece.kind === 'special') {
    return piece.special === 'propeller' ? 'sp-propeller' : `img-sp-${piece.special}`;
  }
  return piece.hp >= 2 ? 'img-ob-box2' : 'img-ob-box1';
}

/** Multiply each RGB channel by f (0..1). Used for the glossy darker rim strokes. */
const darken = (hex: number, f: number): number => {
  const chan = (shift: number): number => Math.round(((hex >> shift) & 0xff) * f) << shift;
  return chan(16) | chan(8) | chan(0);
};

/** Channel-wise interpolation from color toward target by t (0..1). */
const mix = (color: number, target: number, t: number): number => {
  const chan = (shift: number): number => {
    const from = (color >> shift) & 0xff;
    const to = (target >> shift) & 0xff;
    return Math.round(from + (to - from) * t) << shift;
  };
  return chan(16) | chan(8) | chan(0);
};

/** Push each RGB channel toward white by f (0..1). Counterpart of darken. */
const lighten = (hex: number, f: number): number => mix(hex, 0xffffff, f);

// --- Baked-gradient helpers (texture v2, plan 9 legit-look pass) ---
// generateTexture always renders through the CANVAS pipeline, where Phaser's
// fillGradientStyle is a no-op (GraphicsCanvasRenderer skips the command), so
// gradients are baked as stacked interpolated fills instead. Step counts are
// tuned for 96px textures: bands read as smooth shading at gameplay sizes.

/** Vertical banded gradient inside a rounded rect. Layers keep square bottoms
 * and stop above the bottom-corner arcs so nothing pokes past the silhouette;
 * for radius-heavy shapes (pills) the lower part stays the solid base color. */
const gradRoundedRect = (
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number, rad: number,
  cTop: number, cBottom: number,
): void => {
  const n = 12;
  g.fillStyle(cBottom);
  g.fillRoundedRect(x, y, w, h, rad);
  for (let k = n - 1; k >= 1; k--) {
    const hk = (h * k) / n;
    if (hk > h - rad) continue;
    const rr = Math.min(rad, hk / 2, w / 2);
    g.fillStyle(mix(cTop, cBottom, (k - 0.5) / n));
    g.fillRoundedRect(x, y, w, hk, { tl: rr, tr: rr, bl: 0, br: 0 });
  }
};

/** Top-lit sphere shading: stacked circles shrinking toward the upper half. */
const gradCircle = (
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, radius: number,
  cTop: number, cBottom: number,
): void => {
  const n = 10;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    g.fillStyle(mix(cBottom, cTop, f));
    g.fillCircle(cx, cy - radius * 0.42 * f, radius * (1 - 0.55 * f));
  }
};

/** Ellipse variant of gradCircle (w/h are full sizes, Phaser convention). */
const gradEllipse = (
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, w: number, h: number,
  cTop: number, cBottom: number,
): void => {
  const n = 8;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    g.fillStyle(mix(cBottom, cTop, f));
    g.fillEllipse(cx, cy - h * 0.21 * f, w * (1 - 0.55 * f), h * (1 - 0.55 * f));
  }
};

/** Polygon shading: layers scale toward a pivot above the centroid, so any
 * triangle/diamond/hex/star silhouette gets the same top-lit treatment. */
const gradPoly = (
  g: Phaser.GameObjects.Graphics,
  p: Phaser.Math.Vector2[],
  cTop: number, cBottom: number,
): void => {
  const n = 10;
  const cx0 = p.reduce((a, pt) => a + pt.x, 0) / p.length;
  const cy0 = p.reduce((a, pt) => a + pt.y, 0) / p.length;
  const minY = Math.min(...p.map((pt) => pt.y));
  const px = cx0;
  const py = cy0 - (cy0 - minY) * 0.5;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const sc = 1 - 0.55 * f;
    g.fillStyle(mix(cBottom, cTop, f));
    g.fillPoints(
      p.map((pt) => ({ x: px + (pt.x - px) * sc, y: py + (pt.y - py) * sc })) as Phaser.Math.Vector2[],
      true,
    );
  }
};

/** Two-layer soft baked drop shadow (flat fills fake the blur). */
const softShadow = (
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, w: number, h: number,
): void => {
  g.fillStyle(0x000000, 0.12);
  g.fillEllipse(cx, cy, w, h);
  g.fillStyle(0x000000, 0.16);
  g.fillEllipse(cx, cy, w * 0.86, h * 0.86);
};

// Note: fillPoints is typed as Phaser.Math.Vector2[]; it only reads .x/.y at
// runtime, so plain point objects are cast rather than allocating Vector2s.
const poly = (cx: number, cy: number, r: number, n: number, rot: number): Phaser.Math.Vector2[] =>
  Array.from({ length: n }, (_, i) => ({
    x: cx + r * Math.cos(rot + (i * 2 * Math.PI) / n),
    y: cy + r * Math.sin(rot + (i * 2 * Math.PI) / n),
  })) as Phaser.Math.Vector2[];

const star = (cx: number, cy: number, rOut: number, rIn: number, n: number): Phaser.Math.Vector2[] => {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts as Phaser.Math.Vector2[];
};

/** Simple friendly avatar: head + hair, torso/arms in outfit color. Poses: 0 arms down, 1 one arm up, 2 both up. */
export function makeAvatarTexture(scene: Phaser.Scene, key: string, outfitColor: number, pose: 0 | 1 | 2): void {
  const s = 96;
  const c = s / 2;
  const g = scene.add.graphics();
  // Legs.
  g.fillStyle(0x2c3e50);
  g.fillRoundedRect(c - s * 0.12, s * 0.62, s * 0.09, s * 0.3, s * 0.03);
  g.fillRoundedRect(c + s * 0.03, s * 0.62, s * 0.09, s * 0.3, s * 0.03);
  // Torso + arms in outfit color; arm angles differ per pose.
  g.fillStyle(outfitColor);
  g.fillRoundedRect(c - s * 0.15, s * 0.34, s * 0.3, s * 0.32, s * 0.06);
  const arm = (x: number, up: boolean): void => {
    g.fillRoundedRect(x, up ? s * 0.13 : s * 0.38, s * 0.07, s * 0.26, s * 0.03);
  };
  arm(c - s * 0.23, pose === 2);
  arm(c + s * 0.16, pose >= 1);
  // Hair circle behind, skin head over it: leaves a dark fringe arc on top.
  g.fillStyle(0x4a3222);
  g.fillCircle(c, s * 0.17, s * 0.145);
  g.fillStyle(0xf0c8a0);
  g.fillCircle(c, s * 0.21, s * 0.13);
  // Eyes + smile keep it friendly.
  g.fillStyle(0x2c2c54);
  g.fillCircle(c - s * 0.05, s * 0.2, s * 0.017);
  g.fillCircle(c + s * 0.05, s * 0.2, s * 0.017);
  g.fillRoundedRect(c - s * 0.045, s * 0.255, s * 0.09, s * 0.02, s * 0.01);
  g.generateTexture(key, s, s);
  g.destroy();
}

/** Furniture accent colors per style: a woody, b modern blue, c pink. */
const FURN_ACCENT: Record<string, number> = { a: 0x8e6e53, b: 0x5dade2, c: 0xf5b7b1 };

/** Generates all gem/special/UI textures once. size = texture edge in px. Idempotent across scenes. */
export function makeTextures(scene: Phaser.Scene, size: number): void {
  if (scene.textures.exists('gem-red')) return;
  const s = size;
  const c = s / 2;
  const r = s * 0.38;
  // Glossy finish (plan 7, decision #43): subtle bottom-inner shade (kept small so it
  // stays inside every silhouette), the classic top-left highlight, plus a second
  // smaller bright spot. Darker rim strokes are per-shape inside each draw via rim().
  const gem = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
    const g = scene.add.graphics();
    softShadow(g, c, c + r * 0.18, r * 2.3, r * 2.1);
    draw(g);
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(c, c + r * 0.28, r * 0.9, r * 0.36);
    g.fillStyle(0xffffff, 0.28);
    g.fillEllipse(c - r * 0.35, c - r * 0.4, r * 0.55, r * 0.35);
    g.fillStyle(0xffffff, 0.5);
    g.fillEllipse(c - r * 0.52, c - r * 0.55, r * 0.2, r * 0.13);
    g.generateTexture(key, s, s);
    g.destroy();
  };
  /** Sets the darker-rim line style for a glossy piece; caller strokes its own shape. */
  const rim = (g: Phaser.GameObjects.Graphics, color: number): void => {
    g.lineStyle(s * 0.045, darken(color, 0.6));
  };

  gem('gem-red', (g) => { gradCircle(g, c, c, r, lighten(COLOR_HEX.red, 0.25), darken(COLOR_HEX.red, 0.75)); rim(g, COLOR_HEX.red); g.strokeCircle(c, c, r); });
  gem('gem-blue', (g) => { const p = poly(c, c, r * 1.05, 3, -Math.PI / 2); gradPoly(g, p, lighten(COLOR_HEX.blue, 0.25), darken(COLOR_HEX.blue, 0.75)); rim(g, COLOR_HEX.blue); g.strokePoints(p, true); });
  gem('gem-green', (g) => { gradRoundedRect(g, c - r * 0.85, c - r * 0.85, r * 1.7, r * 1.7, r * 0.35, lighten(COLOR_HEX.green, 0.25), darken(COLOR_HEX.green, 0.75)); rim(g, COLOR_HEX.green); g.strokeRoundedRect(c - r * 0.85, c - r * 0.85, r * 1.7, r * 1.7, r * 0.35); });
  gem('gem-yellow', (g) => { const p = poly(c, c, r * 1.05, 4, -Math.PI / 2); gradPoly(g, p, lighten(COLOR_HEX.yellow, 0.25), darken(COLOR_HEX.yellow, 0.75)); rim(g, COLOR_HEX.yellow); g.strokePoints(p, true); });
  gem('gem-purple', (g) => { const p = poly(c, c, r, 6, 0); gradPoly(g, p, lighten(COLOR_HEX.purple, 0.25), darken(COLOR_HEX.purple, 0.75)); rim(g, COLOR_HEX.purple); g.strokePoints(p, true); });
  gem('gem-orange', (g) => { const p = star(c, c, r * 1.05, r * 0.5, 5); gradPoly(g, p, lighten(COLOR_HEX.orange, 0.25), darken(COLOR_HEX.orange, 0.75)); rim(g, COLOR_HEX.orange); g.strokePoints(p, true); });

  // Music pack (plan 6.5, dance chapter): same 6 colors, new distinct shapes.
  // red = eighth note.
  gem('music-red', (g) => {
    gradEllipse(g, c - r * 0.3, c + r * 0.55, r * 0.85, r * 0.6, lighten(COLOR_HEX.red, 0.25), darken(COLOR_HEX.red, 0.75));
    g.fillStyle(COLOR_HEX.red);
    g.fillRect(c + r * 0.08, c - r * 0.95, r * 0.14, r * 1.55);
    g.fillTriangle(c + r * 0.22, c - r * 0.95, c + r * 0.8, c - r * 0.5, c + r * 0.22, c - r * 0.3);
    rim(g, COLOR_HEX.red);
    g.strokeEllipse(c - r * 0.3, c + r * 0.55, r * 0.85, r * 0.6);
  });
  // blue = vinyl disc.
  gem('music-blue', (g) => {
    gradCircle(g, c, c, r * 1.02, lighten(COLOR_HEX.blue, 0.25), darken(COLOR_HEX.blue, 0.75));
    rim(g, COLOR_HEX.blue);
    g.strokeCircle(c, c, r * 1.02);
    g.lineStyle(s * 0.02, 0xffffff, 0.4);
    g.strokeCircle(c, c, r * 0.8);
    g.strokeCircle(c, c, r * 0.6);
    g.fillStyle(0xd6eaf8);
    g.fillCircle(c, c, r * 0.32);
    g.fillStyle(0x2c2c54);
    g.fillCircle(c, c, r * 0.09);
  });
  // green = microphone.
  gem('music-green', (g) => {
    gradRoundedRect(g, c - r * 0.45, c - r * 1.0, r * 0.9, r * 1.05, r * 0.44, lighten(COLOR_HEX.green, 0.25), darken(COLOR_HEX.green, 0.75));
    g.lineStyle(s * 0.015, 0x0e6b3e, 0.8);
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(c - r * 0.42, c - r * 0.82 + i * r * 0.28);
      g.lineTo(c + r * 0.42, c - r * 0.82 + i * r * 0.28);
      g.strokePath();
    }
    g.fillStyle(COLOR_HEX.green);
    g.fillRoundedRect(c - r * 0.16, c - r * 0.05, r * 0.32, r * 1.05, r * 0.14);
    rim(g, COLOR_HEX.green);
    g.strokeRoundedRect(c - r * 0.45, c - r * 1.0, r * 0.9, r * 1.05, r * 0.44);
  });
  // yellow = star (slimmer than the orange gem's).
  gem('music-yellow', (g) => { const p = star(c, c, r * 1.05, r * 0.42, 5); gradPoly(g, p, lighten(COLOR_HEX.yellow, 0.25), darken(COLOR_HEX.yellow, 0.75)); rim(g, COLOR_HEX.yellow); g.strokePoints(p, true); });
  // purple = headphones.
  gem('music-purple', (g) => {
    g.lineStyle(s * 0.075, COLOR_HEX.purple);
    g.beginPath();
    g.arc(c, c + r * 0.1, r * 0.72, Math.PI, Math.PI * 2, false);
    g.strokePath();
    gradRoundedRect(g, c - r * 0.98, c - r * 0.05, r * 0.46, r * 0.7, r * 0.16, lighten(COLOR_HEX.purple, 0.25), darken(COLOR_HEX.purple, 0.75));
    gradRoundedRect(g, c + r * 0.52, c - r * 0.05, r * 0.46, r * 0.7, r * 0.16, lighten(COLOR_HEX.purple, 0.25), darken(COLOR_HEX.purple, 0.75));
    rim(g, COLOR_HEX.purple);
    g.strokeRoundedRect(c - r * 0.98, c - r * 0.05, r * 0.46, r * 0.7, r * 0.16);
    g.strokeRoundedRect(c + r * 0.52, c - r * 0.05, r * 0.46, r * 0.7, r * 0.16);
  });
  // orange = speaker cone.
  gem('music-orange', (g) => {
    gradRoundedRect(g, c - r * 0.85, c - r * 0.85, r * 1.7, r * 1.7, r * 0.25, lighten(COLOR_HEX.orange, 0.25), darken(COLOR_HEX.orange, 0.75));
    rim(g, COLOR_HEX.orange);
    g.strokeRoundedRect(c - r * 0.85, c - r * 0.85, r * 1.7, r * 1.7, r * 0.25);
    g.lineStyle(s * 0.03, 0x000000, 0.3);
    g.strokeCircle(c, c, r * 0.58);
    g.fillStyle(0x000000, 0.28);
    g.fillCircle(c, c, r * 0.3);
  });

  // Special badges: cream disc in a gold ring (gold-frame motif); glyphs keep their colors.
  const sp = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
    const g = scene.add.graphics();
    softShadow(g, c, c + r * 0.18, r * 2.3, r * 2.1);
    gradCircle(g, c, c, r * 1.05, lighten(PALETTE.cream, 0.4), darken(PALETTE.cream, 0.82));
    g.lineStyle(s * 0.03, PALETTE.gold);
    g.strokeCircle(c, c, r * 1.05);
    draw(g);
    g.generateTexture(key, s, s);
    g.destroy();
  };

  sp('sp-rocketH', (g) => {
    g.fillStyle(0x2c2c54);
    g.fillTriangle(c - r, c, c - r * 0.3, c - r * 0.4, c - r * 0.3, c + r * 0.4);
    g.fillTriangle(c + r, c, c + r * 0.3, c - r * 0.4, c + r * 0.3, c + r * 0.4);
    g.fillRect(c - r * 0.35, c - r * 0.12, r * 0.7, r * 0.24);
  });
  sp('sp-rocketV', (g) => {
    g.fillStyle(0x2c2c54);
    g.fillTriangle(c, c - r, c - r * 0.4, c - r * 0.3, c + r * 0.4, c - r * 0.3);
    g.fillTriangle(c, c + r, c - r * 0.4, c + r * 0.3, c + r * 0.4, c + r * 0.3);
    g.fillRect(c - r * 0.12, c - r * 0.35, r * 0.24, r * 0.7);
  });
  sp('sp-tnt', (g) => {
    g.fillStyle(0x2c2c54);
    g.fillCircle(c, c + r * 0.15, r * 0.6);
    g.fillRect(c - r * 0.06, c - r * 0.75, r * 0.12, r * 0.45);
    g.fillStyle(0xe67e22);
    g.fillCircle(c, c - r * 0.8, r * 0.14);
  });
  sp('sp-lightball', (g) => {
    g.fillStyle(0xf1c40f);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.fillTriangle(
        c + Math.cos(a) * r * 0.95, c + Math.sin(a) * r * 0.95,
        c + Math.cos(a + 0.25) * r * 0.45, c + Math.sin(a + 0.25) * r * 0.45,
        c + Math.cos(a - 0.25) * r * 0.45, c + Math.sin(a - 0.25) * r * 0.45,
      );
    }
    g.fillCircle(c, c, r * 0.42);
  });
  sp('sp-propeller', (g) => {
    g.fillStyle(0x16a085);
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
      g.fillEllipse(c + Math.cos(a) * r * 0.5, c + Math.sin(a) * r * 0.5, r * 0.75, r * 0.32);
    }
    g.fillStyle(0x2c2c54);
    g.fillCircle(c, c, r * 0.16);
  });

  const ui = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
    const g = scene.add.graphics();
    draw(g);
    g.generateTexture(key, s, s);
    g.destroy();
  };
  /** Round action-button base: baked shadow, top-lit gradient, top bevel, gold ring. */
  const circleButton = (g: Phaser.GameObjects.Graphics, color: number): void => {
    softShadow(g, c, c + r * 0.22, r * 2.42, r * 2.0);
    gradCircle(g, c, c, r * 1.1, lighten(color, 0.28), color);
    g.fillStyle(0xffffff, 0.35);
    g.fillEllipse(c, c - r * 0.52, r * 1.5, r * 0.7);
    g.lineStyle(s * 0.035, PALETTE.gold);
    g.strokeCircle(c, c, r * 1.1);
  };
  /** Wraps a texture draw with a baked ground-contact shadow (cheap uniform lift). */
  const withShadow = (draw: (g: Phaser.GameObjects.Graphics) => void) =>
    (g: Phaser.GameObjects.Graphics): void => {
      g.fillStyle(0x000000, 0.1);
      g.fillEllipse(c, s * 0.88, s * 0.66, s * 0.11);
      g.fillStyle(0x000000, 0.16);
      g.fillEllipse(c, s * 0.88, s * 0.55, s * 0.085);
      draw(g);
    };
  const shadowed = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void =>
    ui(key, withShadow(draw));
  ui('ui-star', (g) => { const p = star(c, c, r * 1.1, r * 0.5, 5); g.fillStyle(0xf1c40f); g.fillPoints(p, true); g.lineStyle(s * 0.045, PALETTE.goldDark); g.strokePoints(p, true); });
  ui('ui-play', (g) => {
    circleButton(g, 0x2ecc71);
    g.fillStyle(0xffffff);
    g.fillTriangle(c - r * 0.35, c - r * 0.5, c - r * 0.35, c + r * 0.5, c + r * 0.55, c);
  });
  ui('ui-retry', (g) => {
    circleButton(g, 0x3498db);
    g.lineStyle(s * 0.07, 0xffffff);
    g.beginPath();
    g.arc(c, c, r * 0.55, -Math.PI * 0.25, Math.PI, false);
    g.strokePath();
    g.fillStyle(0xffffff);
    g.fillTriangle(c + r * 0.75, c - r * 0.45, c + r * 0.2, c - r * 0.55, c + r * 0.55, c - r * 0.05);
  });
  ui('ui-pip', (g) => { g.fillStyle(0xffffff); g.fillCircle(c, c, r * 0.3); });
  // Tutorial pointer: white hand (palm circle + one finger) on transparent bg.
  ui('ui-hand', (g) => {
    g.lineStyle(s * 0.04, 0x2c2c54);
    g.fillStyle(0xffffff);
    g.fillCircle(c, s * 0.64, r * 0.6);
    g.strokeCircle(c, s * 0.64, r * 0.6);
    g.fillRoundedRect(c - r * 0.55, s * 0.06, r * 0.38, s * 0.48, r * 0.19);
    g.strokeRoundedRect(c - r * 0.55, s * 0.06, r * 0.38, s * 0.48, r * 0.19);
  });
  // Trophy on the same light badge circle the specials use.
  sp('ui-trophy', (g) => {
    g.fillStyle(0xf1c40f);
    g.fillRoundedRect(c - r * 0.55, c - r * 0.8, r * 1.1, r * 0.9, {
      tl: r * 0.12, tr: r * 0.12, bl: r * 0.5, br: r * 0.5,
    });
    g.fillRect(c - r * 0.1, c + r * 0.05, r * 0.2, r * 0.35);
    g.fillRect(c - r * 0.45, c + r * 0.4, r * 0.9, r * 0.18);
  });
  // Speaker glyph shared by the two sound-toggle badges.
  const speaker = (g: Phaser.GameObjects.Graphics): void => {
    g.fillStyle(0x2c2c54);
    g.fillRect(c - r * 0.75, c - r * 0.28, r * 0.38, r * 0.56);
    g.fillTriangle(c - r * 0.42, c, c + r * 0.02, c - r * 0.58, c + r * 0.02, c + r * 0.58);
    g.lineStyle(s * 0.05, 0x2c2c54);
    g.beginPath();
    g.arc(c + r * 0.14, c, r * 0.34, -Math.PI / 3, Math.PI / 3, false);
    g.strokePath();
    g.beginPath();
    g.arc(c + r * 0.14, c, r * 0.62, -Math.PI / 3, Math.PI / 3, false);
    g.strokePath();
  };
  sp('ui-sound-on', (g) => { speaker(g); });
  sp('ui-sound-off', (g) => {
    speaker(g);
    g.lineStyle(s * 0.06, 0xe74c3c);
    g.beginPath();
    g.moveTo(c - r * 0.85, c - r * 0.85);
    g.lineTo(c + r * 0.85, c + r * 0.85);
    g.strokePath();
  });
  ui('ui-tile', (g) => { gradRoundedRect(g, s * 0.02, s * 0.02, s * 0.96, s * 0.96, s * 0.16, 0xffffff, 0xd9d3e8); });
  // Thin gold outline matching ui-tile's footprint — board framing (plan 7 design pass).
  ui('ui-tile-frame', (g) => {
    g.lineStyle(s * 0.04, PALETTE.gold);
    g.strokeRoundedRect(s * 0.04, s * 0.04, s * 0.92, s * 0.92, s * 0.15);
  });
  // Gold-framed midnight panel: plum-black fill, gold border, gold corner dots.
  ui('ui-panel', (g) => {
    // Baked drop shadow peeks past the bottom edge; body sits slightly high.
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(s * 0.02, s * 0.05, s * 0.96, s * 0.95, s * 0.2);
    gradRoundedRect(g, 0, 0, s, s * 0.965, s * 0.2, lighten(PALETTE.panel, 0.15), PALETTE.panel);
    g.lineStyle(s * 0.03, PALETTE.panelBorder);
    g.strokeRoundedRect(s * 0.015, s * 0.015, s * 0.97, s * 0.935, s * 0.19);
    g.lineStyle(s * 0.012, darken(PALETTE.gold, 0.62));
    g.strokeRoundedRect(s * 0.045, s * 0.045, s * 0.91, s * 0.875, s * 0.16);
    g.fillStyle(PALETTE.gold);
    for (const [dx, dy] of [[s * 0.1, s * 0.1], [s * 0.9, s * 0.1], [s * 0.1, s * 0.865], [s * 0.9, s * 0.865]] as const) {
      g.fillCircle(dx, dy, s * 0.03);
    }
  });
  // Studio ring-light: 12 cream bulbs on a faint ring, transparent centre.
  ui('ui-ringlight', (g) => {
    g.lineStyle(s * 0.02, PALETTE.cream, 0.35);
    g.strokeCircle(c, c, r);
    g.fillStyle(PALETTE.cream);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI * 2) / 12;
      g.fillCircle(c + Math.cos(a) * r, c + Math.sin(a) * r, r * 0.09);
    }
  });

  // Obstacles. Wooden crate: base + darker border, X of diagonal planks, corner nails.
  const crate = (g: Phaser.GameObjects.Graphics): void => {
    const m = s * 0.05;
    const w = s - m * 2;
    g.fillStyle(0x9c6b30);
    g.fillRoundedRect(m, m, w, w, s * 0.1);
    g.lineStyle(s * 0.05, 0x7a4f1d);
    g.strokeRoundedRect(m + s * 0.03, m + s * 0.03, w - s * 0.06, w - s * 0.06, s * 0.08);
    g.beginPath();
    g.moveTo(m + s * 0.09, m + s * 0.09);
    g.lineTo(m + w - s * 0.09, m + w - s * 0.09);
    g.moveTo(m + w - s * 0.09, m + s * 0.09);
    g.lineTo(m + s * 0.09, m + w - s * 0.09);
    g.strokePath();
    g.fillStyle(0x7a4f1d);
    const q = s * 0.07;
    for (const [nx, ny] of [[m + q, m + q], [m + w - q * 2, m + q], [m + q, m + w - q * 2], [m + w - q * 2, m + w - q * 2]]) {
      g.fillRect(nx!, ny!, q, q);
    }
  };
  ui('ob-box1', (g) => { crate(g); });
  ui('ob-box2', (g) => {
    crate(g);
    g.fillStyle(0x5f6a6a);
    g.fillRect(s * 0.05, c - s * 0.09, s * 0.9, s * 0.18);
    g.fillStyle(0x7f8c8d);
    g.fillRect(s * 0.05, c - s * 0.07, s * 0.9, s * 0.14);
  });
  // Ice plate: translucent pale-blue slab with thin white crack lines.
  ui('ob-ice', (g) => {
    g.fillStyle(0xa8d8ea, 0.85);
    g.fillRoundedRect(s * 0.03, s * 0.03, s * 0.94, s * 0.94, s * 0.16);
    g.lineStyle(s * 0.02, 0xffffff, 0.8);
    g.beginPath();
    g.moveTo(s * 0.22, s * 0.28);
    g.lineTo(s * 0.46, s * 0.5);
    g.lineTo(s * 0.36, s * 0.76);
    g.moveTo(s * 0.46, s * 0.5);
    g.lineTo(s * 0.72, s * 0.44);
    g.moveTo(s * 0.62, s * 0.18);
    g.lineTo(s * 0.72, s * 0.44);
    g.lineTo(s * 0.84, s * 0.64);
    g.strokePath();
  });

  // --- Meta-layer textures (plan 6; plan 7 restyles) ---

  // Avatars: outfit colors from the profile (personal layer) x poses 0-2.
  const OUTFITS = PROFILE.avatar.outfitColors;
  OUTFITS.forEach((color, o) => {
    for (const pose of [0, 1, 2] as const) makeAvatarTexture(scene, `avatar-o${o}-p${pose}`, color, pose);
  });

  // Furniture: recognizable silhouette per slot, accent color per style.
  const furnDraw: Record<string, (g: Phaser.GameObjects.Graphics, accent: number) => void> = {
    counter: (g, accent) => {
      g.fillStyle(accent);
      g.fillRect(s * 0.08, s * 0.46, s * 0.84, s * 0.42);
      g.fillStyle(0xd7dbdd);
      g.fillRect(s * 0.05, s * 0.38, s * 0.9, s * 0.09);
      g.fillStyle(0x000000, 0.18);
      g.fillRect(s * 0.14, s * 0.54, s * 0.32, s * 0.28);
      g.fillRect(s * 0.54, s * 0.54, s * 0.32, s * 0.28);
    },
    fridge: (g, accent) => {
      g.fillStyle(accent);
      g.fillRoundedRect(c - s * 0.21, s * 0.08, s * 0.42, s * 0.84, s * 0.07);
      g.fillStyle(0x000000, 0.2);
      g.fillRect(c - s * 0.21, s * 0.4, s * 0.42, s * 0.02);
      g.fillStyle(0xecf0f1);
      g.fillRoundedRect(c + s * 0.1, s * 0.16, s * 0.045, s * 0.18, s * 0.02);
      g.fillRoundedRect(c + s * 0.1, s * 0.48, s * 0.045, s * 0.18, s * 0.02);
    },
    table: (g, accent) => {
      g.fillStyle(accent);
      g.fillRoundedRect(s * 0.08, s * 0.36, s * 0.84, s * 0.1, s * 0.03);
      g.fillRect(s * 0.16, s * 0.46, s * 0.07, s * 0.42);
      g.fillRect(s * 0.77, s * 0.46, s * 0.07, s * 0.42);
    },
    lamp: (g, accent) => {
      g.fillStyle(0x555566);
      g.fillRect(c - s * 0.025, s * 0.32, s * 0.05, s * 0.52);
      g.fillEllipse(c, s * 0.86, s * 0.3, s * 0.08);
      g.fillStyle(accent);
      g.fillTriangle(c, s * 0.06, c - s * 0.2, s * 0.34, c + s * 0.2, s * 0.34);
    },
    plant: (g, accent) => {
      g.fillStyle(0x2ecc71);
      g.fillEllipse(c, s * 0.3, s * 0.16, s * 0.42);
      g.fillEllipse(c - s * 0.14, s * 0.42, s * 0.3, s * 0.15);
      g.fillEllipse(c + s * 0.14, s * 0.42, s * 0.3, s * 0.15);
      g.fillStyle(accent);
      g.fillRect(c - s * 0.19, s * 0.55, s * 0.38, s * 0.07);
      g.fillRoundedRect(c - s * 0.16, s * 0.6, s * 0.32, s * 0.28, s * 0.04);
    },
    art: (g, accent) => {
      g.fillStyle(0x6e4a2f);
      g.fillRect(s * 0.14, s * 0.14, s * 0.72, s * 0.72);
      g.fillStyle(0xf8f5f0);
      g.fillRect(s * 0.2, s * 0.2, s * 0.6, s * 0.6);
      g.fillStyle(accent);
      g.fillTriangle(c, s * 0.34, s * 0.28, s * 0.74, s * 0.72, s * 0.74);
      g.fillCircle(s * 0.68, s * 0.32, s * 0.06);
    },
  };
  for (const slot of ['counter', 'fridge', 'table', 'lamp', 'plant', 'art']) {
    for (const style of ['a', 'b', 'c']) {
      ui(`furn-${slot}-${style}`, withShadow((g) => furnDraw[slot]!(g, FURN_ACCENT[style]!)));
    }
  }

  // Career UI icons.
  ui('ui-coin', (g) => {
    g.fillStyle(0xf1c40f);
    g.fillCircle(c, c, r * 1.05);
    g.lineStyle(s * 0.05, 0xb7950b);
    g.strokeCircle(c, c, r * 0.68);
  });
  ui('ui-follower', (g) => {
    g.fillStyle(0x3498db);
    g.fillCircle(c, c, r * 1.05);
    g.fillStyle(0xffffff);
    g.fillCircle(c, c - r * 0.3, r * 0.32);
    g.fillEllipse(c, c + r * 0.48, r * 1.1, r * 0.68);
  });
  ui('ui-heart', (g) => {
    g.fillStyle(0xe74c3c);
    g.fillCircle(c - r * 0.35, c - r * 0.25, r * 0.42);
    g.fillCircle(c + r * 0.35, c - r * 0.25, r * 0.42);
    g.fillTriangle(c - r * 0.72, c - r * 0.05, c + r * 0.72, c - r * 0.05, c, c + r * 0.75);
  });
  ui('ui-levelbadge', (g) => {
    g.fillStyle(0x9b59b6);
    g.fillPoints([
      { x: c - r * 0.7, y: c - r * 0.7 },
      { x: c + r * 0.7, y: c - r * 0.7 },
      { x: c + r * 0.7, y: c + r * 0.15 },
      { x: c, y: c + r * 0.85 },
      { x: c - r * 0.7, y: c + r * 0.15 },
    ] as Phaser.Math.Vector2[], true);
    g.fillStyle(0xffffff);
    g.fillPoints([
      { x: c - r * 0.4, y: c + r * 0.05 },
      { x: c, y: c - r * 0.32 },
      { x: c, y: c - r * 0.06 },
      { x: c - r * 0.4, y: c + r * 0.31 },
    ] as Phaser.Math.Vector2[], true);
    g.fillPoints([
      { x: c + r * 0.4, y: c + r * 0.05 },
      { x: c, y: c - r * 0.32 },
      { x: c, y: c - r * 0.06 },
      { x: c + r * 0.4, y: c + r * 0.31 },
    ] as Phaser.Math.Vector2[], true);
  });
  ui('ui-video', (g) => {
    g.fillStyle(0x34495e);
    g.fillRoundedRect(c - r * 0.35, c - r * 0.78, r * 0.7, r * 0.3, r * 0.1);
    g.fillRoundedRect(c - r * 0.9, c - r * 0.5, r * 1.8, r, r * 0.15);
    g.fillStyle(0xecf0f1);
    g.fillCircle(c - r * 0.25, c, r * 0.32);
    g.fillStyle(0x2c2c54);
    g.fillCircle(c - r * 0.25, c, r * 0.18);
    g.fillStyle(0xe74c3c);
    g.fillCircle(c + r * 0.5, c - r * 0.25, r * 0.1);
  });
  ui('ui-note', (g) => {
    g.fillStyle(0xffffff);
    g.fillEllipse(c - r * 0.3, c + r * 0.55, r * 0.62, r * 0.46);
    g.fillRect(c - r * 0.02, c - r * 0.75, r * 0.1, r * 1.3);
    g.fillTriangle(c + r * 0.08, c - r * 0.75, c + r * 0.6, c - r * 0.45, c + r * 0.08, c - r * 0.3);
  });
  // Empty furnishing slot: dashed-look rounded rect (8 stroke segments), transparent fill.
  ui('ui-slot', (g) => {
    g.lineStyle(s * 0.045, 0xffffff, 0.9);
    const m = s * 0.1;
    const e = s * 0.9;
    const d0 = s * 0.08;
    const d1 = s * 0.32;
    g.beginPath();
    for (const [ax, ay, bx, by] of [
      [m + d0, m, m + d1, m], [e - d1, m, e - d0, m],
      [m + d0, e, m + d1, e], [e - d1, e, e - d0, e],
      [m, m + d0, m, m + d1], [m, e - d1, m, e - d0],
      [e, m + d0, e, m + d1], [e, e - d1, e, e - d0],
    ] as const) {
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
    }
    g.strokePath();
  });
  ui('ui-dumbbell', (g) => {
    g.fillStyle(0x95a5a6);
    g.fillRoundedRect(c - r * 0.85, c - r * 0.09, r * 1.7, r * 0.18, r * 0.05);
    g.fillRoundedRect(c - r * 0.95, c - r * 0.42, r * 0.3, r * 0.84, r * 0.08);
    g.fillRoundedRect(c + r * 0.65, c - r * 0.42, r * 0.3, r * 0.84, r * 0.08);
  });
  // --- Plan 6.5: generic furniture for dance/gym/vanity rooms (plan 7 replaces with real art) ---
  // Per-chapter accent hue, modulated per style: a = base, b = lightened, c = darkened.
  const CHAPTER_FURN_ACCENT: Record<string, number> = { dance: 0x9b59b6, gym: 0x2ecc71, vanity: 0xfd79a8 };
  const styleAccent = (base: number, style: string): number =>
    style === 'b' ? mix(base, 0xffffff, 0.35) : style === 'c' ? mix(base, 0x2c2c54, 0.35) : base;
  // Recognizable-ish silhouettes keyed by slot INDEX within the room:
  // 0 tall rect, 1 wide rect, 2 slab+legs, 3 pole+top, 4 round, 5 frame.
  const furnGeneric = (g: Phaser.GameObjects.Graphics, slotIndex: number, accent: number): void => {
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(c, s * 0.9, s * 0.62, s * 0.08);
    switch (slotIndex) {
      case 0: // tall rect (mirror / treadmill upright / lit mirror)
        g.fillStyle(accent);
        g.fillRoundedRect(c - s * 0.18, s * 0.08, s * 0.36, s * 0.8, s * 0.05);
        g.fillStyle(0xffffff, 0.3);
        g.fillRoundedRect(c - s * 0.12, s * 0.14, s * 0.1, s * 0.6, s * 0.04);
        break;
      case 1: // wide rect (barre / weights / chair)
        g.fillStyle(accent);
        g.fillRoundedRect(s * 0.08, s * 0.42, s * 0.84, s * 0.42, s * 0.06);
        g.fillStyle(0xffffff, 0.25);
        g.fillRect(s * 0.14, s * 0.5, s * 0.72, s * 0.06);
        break;
      case 2: // slab + legs (speaker stand / bench / desk)
        g.fillStyle(accent);
        g.fillRoundedRect(s * 0.08, s * 0.38, s * 0.84, s * 0.12, s * 0.04);
        g.fillRect(s * 0.14, s * 0.5, s * 0.08, s * 0.38);
        g.fillRect(s * 0.78, s * 0.5, s * 0.08, s * 0.38);
        break;
      case 3: // pole + top (discoball / fan / rack)
        g.fillStyle(0x555566);
        g.fillRect(c - s * 0.03, s * 0.3, s * 0.06, s * 0.54);
        g.fillEllipse(c, s * 0.86, s * 0.28, s * 0.07);
        g.fillStyle(accent);
        g.fillCircle(c, s * 0.2, s * 0.16);
        g.fillStyle(0xffffff, 0.3);
        g.fillCircle(c - s * 0.05, s * 0.15, s * 0.05);
        break;
      case 4: // round (mat / gym mat / ringlight)
        g.fillStyle(accent);
        g.fillCircle(c, s * 0.52, s * 0.33);
        g.fillStyle(0xffffff, 0.25);
        g.fillEllipse(c - s * 0.1, s * 0.42, s * 0.15, s * 0.09);
        break;
      default: // 5: frame (poster / chart / shelf)
        g.fillStyle(accent);
        g.fillRoundedRect(s * 0.14, s * 0.14, s * 0.72, s * 0.72, s * 0.04);
        g.fillStyle(0xf8f5f0);
        g.fillRect(s * 0.22, s * 0.22, s * 0.56, s * 0.56);
        g.fillStyle(accent, 0.55);
        g.fillCircle(c, c, s * 0.14);
        break;
    }
  };
  for (const chapter of ['dance', 'gym', 'vanity'] as const) {
    ROOMS[chapter].forEach((slot, idx) => {
      for (const style of ['a', 'b', 'c']) {
        ui(`${slot.textureBase}-${style}`, (g) => furnGeneric(g, idx, styleAccent(CHAPTER_FURN_ACCENT[chapter]!, style)));
      }
    });
  }

  // Wardrobe shop button: clothes hanger (hook curve + triangle body + bar).
  ui('ui-hanger', (g) => {
    g.lineStyle(s * 0.055, 0xecf0f1);
    g.beginPath();
    g.arc(c + s * 0.09, s * 0.2, s * 0.1, Math.PI * 0.5, Math.PI * 1.55, false);
    g.strokePath();
    g.beginPath();
    g.moveTo(c, s * 0.3);
    g.lineTo(s * 0.12, s * 0.72);
    g.lineTo(s * 0.88, s * 0.72);
    g.closePath();
    g.strokePath();
  });

  // Grocery shop button (decision #52): line-drawn shopping basket, same cream
  // stroke style as ui-hanger so the two shop buttons read as one family.
  ui('ui-basket', (g) => {
    g.lineStyle(s * 0.055, 0xecf0f1);
    g.beginPath();
    g.arc(c, s * 0.36, s * 0.2, Math.PI, Math.PI * 2, false);
    g.strokePath();
    g.beginPath();
    g.moveTo(s * 0.14, s * 0.42);
    g.lineTo(s * 0.86, s * 0.42);
    g.lineTo(s * 0.74, s * 0.84);
    g.lineTo(s * 0.26, s * 0.84);
    g.closePath();
    g.strokePath();
    g.lineStyle(s * 0.035, 0xecf0f1, 0.8);
    for (const t of [-0.15, 0, 0.15]) {
      g.beginPath();
      g.moveTo(c + s * t * 1.15, s * 0.48);
      g.lineTo(c + s * t, s * 0.78);
      g.strokePath();
    }
  });
  // Happy check: green disc, white tick, gold ring (proper icon — not a text glyph).
  ui('ui-check', (g) => {
    g.fillStyle(0x2ecc71);
    g.fillCircle(c, c, r * 1.05);
    g.lineStyle(s * 0.09, 0xffffff);
    g.beginPath();
    g.moveTo(c - r * 0.5, c + r * 0.05);
    g.lineTo(c - r * 0.12, c + r * 0.42);
    g.lineTo(c + r * 0.55, c - r * 0.42);
    g.strokePath();
    g.lineStyle(s * 0.035, PALETTE.gold);
    g.strokeCircle(c, c, r * 1.05);
  });

  // --- Plan 8: cooking game + hub textures ---
  // Ingredient icons (ing-*) are plain, badge-free nouns — same visual class as gems
  // and furniture. Action icons (act-*) sit on the cream special badge so "cream badge
  // = tappable action" stays one consistent affordance across match-3 and cooking.
  const pts = (arr: { x: number; y: number }[]): Phaser.Math.Vector2[] => arr as Phaser.Math.Vector2[];

  // Bread slice: crust rounded-rect, lighter crumb inset.
  shadowed('ing-bread', (g) => {
    g.fillStyle(0xc68642);
    g.fillRoundedRect(s * 0.14, s * 0.1, s * 0.72, s * 0.8, { tl: s * 0.3, tr: s * 0.3, bl: s * 0.1, br: s * 0.1 });
    g.fillStyle(0xf5deb3);
    g.fillRoundedRect(s * 0.2, s * 0.18, s * 0.6, s * 0.66, { tl: s * 0.24, tr: s * 0.24, bl: s * 0.07, br: s * 0.07 });
  });
  // Butter: yellow block (lighter top face) on a grey dish.
  shadowed('ing-butter', (g) => {
    g.fillStyle(0xd7dbdd);
    g.fillEllipse(c, s * 0.72, s * 0.78, s * 0.2);
    g.fillStyle(0xf7dc6f);
    g.fillRoundedRect(s * 0.24, s * 0.34, s * 0.52, s * 0.34, s * 0.05);
    g.fillStyle(0xfcf3cf);
    g.fillRoundedRect(s * 0.24, s * 0.34, s * 0.52, s * 0.12, s * 0.05);
  });
  // Banana: thick yellow arc crescent with brown tips.
  shadowed('ing-banana', (g) => {
    g.lineStyle(s * 0.16, 0xf4d03f);
    g.beginPath();
    g.arc(c, s * 0.3, s * 0.32, Math.PI * 0.15, Math.PI * 0.85, false);
    g.strokePath();
    g.fillStyle(0x7d6608);
    g.fillCircle(c - s * 0.285, s * 0.445, s * 0.05);
    g.fillCircle(c + s * 0.285, s * 0.445, s * 0.05);
  });
  // Apple: red circle, stem, leaf, small shine.
  shadowed('ing-apple', (g) => {
    g.fillStyle(0xe74c3c);
    g.fillCircle(c, s * 0.56, s * 0.3);
    g.fillStyle(0x784212);
    g.fillRect(c - s * 0.02, s * 0.16, s * 0.04, s * 0.14);
    g.fillStyle(0x2ecc71);
    g.fillTriangle(c + s * 0.04, s * 0.22, c + s * 0.26, s * 0.1, c + s * 0.22, s * 0.28);
    g.fillStyle(0xffffff, 0.3);
    g.fillEllipse(c - s * 0.11, s * 0.46, s * 0.12, s * 0.08);
  });
  // Strawberry: rounded-down triangle, leafy top, pale seed dots.
  shadowed('ing-strawberry', (g) => {
    g.fillStyle(0xe74c3c);
    g.fillPoints(pts([
      { x: c - s * 0.28, y: s * 0.32 }, { x: c + s * 0.28, y: s * 0.32 },
      { x: c + s * 0.2, y: s * 0.62 }, { x: c, y: s * 0.86 }, { x: c - s * 0.2, y: s * 0.62 },
    ]), true);
    g.fillStyle(0x27ae60);
    g.fillTriangle(c - s * 0.26, s * 0.34, c, s * 0.14, c + s * 0.26, s * 0.34);
    g.fillStyle(0xfadbd8);
    g.fillCircle(c - s * 0.11, s * 0.46, s * 0.022);
    g.fillCircle(c + s * 0.11, s * 0.46, s * 0.022);
    g.fillCircle(c, s * 0.58, s * 0.022);
    g.fillCircle(c - s * 0.05, s * 0.7, s * 0.022);
    g.fillCircle(c + s * 0.06, s * 0.68, s * 0.022);
  });
  // Orange: circle with pale segment lines and a leaf.
  shadowed('ing-orange', (g) => {
    g.fillStyle(0xe67e22);
    g.fillCircle(c, c, s * 0.32);
    g.lineStyle(s * 0.028, 0xf8c471, 0.9);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 4;
      g.beginPath();
      g.moveTo(c - Math.cos(a) * s * 0.26, c - Math.sin(a) * s * 0.26);
      g.lineTo(c + Math.cos(a) * s * 0.26, c + Math.sin(a) * s * 0.26);
      g.strokePath();
    }
    g.fillStyle(0x27ae60);
    g.fillEllipse(c + s * 0.09, s * 0.13, s * 0.15, s * 0.07);
  });
  // Yogurt: white tapered cup, blush foil lid + label band.
  shadowed('ing-yogurt', (g) => {
    g.fillStyle(0xfdfefe);
    g.fillPoints(pts([
      { x: s * 0.28, y: s * 0.32 }, { x: s * 0.72, y: s * 0.32 },
      { x: s * 0.64, y: s * 0.86 }, { x: s * 0.36, y: s * 0.86 },
    ]), true);
    g.fillStyle(0xfd79a8);
    g.fillRoundedRect(s * 0.22, s * 0.18, s * 0.56, s * 0.12, s * 0.04);
    g.fillStyle(0xfd79a8, 0.45);
    g.fillRect(s * 0.33, s * 0.5, s * 0.34, s * 0.14);
  });
  // Egg: white oval + yolk circle.
  shadowed('ing-egg', (g) => {
    g.fillStyle(0xfdfefe);
    g.fillEllipse(c, c, s * 0.62, s * 0.72);
    g.fillStyle(0xf1c40f);
    g.fillCircle(c, c + s * 0.05, s * 0.15);
  });
  // Milk: white gable-top carton with a blue band.
  shadowed('ing-milk', (g) => {
    g.fillStyle(0xfdfefe);
    g.fillRect(s * 0.3, s * 0.34, s * 0.4, s * 0.52);
    g.fillTriangle(s * 0.3, s * 0.35, s * 0.7, s * 0.35, c, s * 0.14);
    g.fillStyle(0x3498db);
    g.fillRect(s * 0.3, s * 0.52, s * 0.4, s * 0.16);
  });
  // Cheese: yellow wedge with darker holes.
  shadowed('ing-cheese', (g) => {
    g.fillStyle(0xf4d03f);
    g.fillPoints(pts([
      { x: s * 0.08, y: s * 0.72 }, { x: s * 0.92, y: s * 0.72 }, { x: s * 0.92, y: s * 0.3 },
    ]), true);
    g.fillStyle(0xd4ac0d);
    g.fillCircle(s * 0.7, s * 0.6, s * 0.05);
    g.fillCircle(s * 0.83, s * 0.47, s * 0.038);
    g.fillCircle(s * 0.52, s * 0.66, s * 0.032);
  });
  // Ham: pink oval with lighter inner rings.
  shadowed('ing-ham', (g) => {
    g.fillStyle(0xf1948a);
    g.fillEllipse(c, c, s * 0.68, s * 0.5);
    g.fillStyle(0xfadbd8);
    g.fillEllipse(c, c, s * 0.42, s * 0.3);
    g.fillStyle(0xf1948a);
    g.fillEllipse(c, c, s * 0.16, s * 0.11);
  });
  // Lettuce: ring of ruffle bumps around a lighter heart.
  shadowed('ing-lettuce', (g) => {
    g.fillStyle(0x58d68d);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI * 2) / 8;
      g.fillCircle(c + Math.cos(a) * s * 0.22, c + Math.sin(a) * s * 0.22, s * 0.145);
    }
    g.fillStyle(0x82e0aa);
    g.fillCircle(c, c, s * 0.2);
  });
  // Tomato: red circle with a green star calyx on top.
  shadowed('ing-tomato', (g) => {
    g.fillStyle(0xe74c3c);
    g.fillCircle(c, s * 0.55, s * 0.3);
    g.fillStyle(0x229954);
    g.fillPoints(star(c, s * 0.28, s * 0.15, s * 0.055, 5), true);
  });
  // Pasta: yellow noodle squiggles sticking out of a blue bowl.
  shadowed('ing-pasta', (g) => {
    g.lineStyle(s * 0.045, 0xf4d03f);
    for (let i = 0; i < 3; i++) {
      const y0 = s * 0.28 + i * s * 0.1;
      g.beginPath();
      g.moveTo(s * 0.24, y0);
      for (let k = 1; k <= 8; k++) {
        g.lineTo(s * 0.24 + (k / 8) * s * 0.52, y0 + (k % 2 === 0 ? 0 : s * 0.05));
      }
      g.strokePath();
    }
    g.fillStyle(0x5dade2);
    g.fillPoints(pts([
      { x: s * 0.14, y: s * 0.54 }, { x: s * 0.86, y: s * 0.54 },
      { x: s * 0.72, y: s * 0.86 }, { x: s * 0.28, y: s * 0.86 },
    ]), true);
  });
  // Sauce: red jar, grey lid, glass shine.
  shadowed('ing-sauce', (g) => {
    g.fillStyle(0xa93226);
    g.fillRoundedRect(s * 0.28, s * 0.3, s * 0.44, s * 0.56, s * 0.08);
    g.fillStyle(0x839192);
    g.fillRoundedRect(s * 0.3, s * 0.16, s * 0.4, s * 0.14, s * 0.04);
    g.fillStyle(0xffffff, 0.25);
    g.fillRoundedRect(s * 0.34, s * 0.38, s * 0.08, s * 0.4, s * 0.03);
  });
  // Tortilla: flat tan circle with toasted spots.
  shadowed('ing-tortilla', (g) => {
    g.fillStyle(0xf0d9a8);
    g.fillCircle(c, c, s * 0.36);
    g.fillStyle(0xd8b571, 0.85);
    g.fillCircle(c - s * 0.14, c - s * 0.08, s * 0.038);
    g.fillCircle(c + s * 0.1, c + s * 0.13, s * 0.032);
    g.fillCircle(c + s * 0.17, c - s * 0.13, s * 0.027);
    g.fillCircle(c - s * 0.06, c + s * 0.19, s * 0.03);
    g.fillCircle(c - s * 0.02, c - s * 0.2, s * 0.026);
  });
  // Flour: tan sack with tied ears and a white label patch.
  shadowed('ing-flour', (g) => {
    g.fillStyle(0xcbb28f);
    g.fillRoundedRect(s * 0.22, s * 0.3, s * 0.56, s * 0.56, s * 0.1);
    g.fillTriangle(s * 0.36, s * 0.32, s * 0.26, s * 0.12, s * 0.46, s * 0.3);
    g.fillTriangle(s * 0.64, s * 0.32, s * 0.74, s * 0.12, s * 0.54, s * 0.3);
    g.fillStyle(0xfdfefe);
    g.fillRoundedRect(s * 0.32, s * 0.46, s * 0.36, s * 0.24, s * 0.04);
  });
  // Sugar: stack of three white cubes.
  shadowed('ing-sugar', (g) => {
    g.lineStyle(s * 0.025, 0xd5dbdb);
    g.fillStyle(0xfdfefe);
    for (const [x, y] of [[s * 0.2, s * 0.52], [s * 0.54, s * 0.52], [s * 0.37, s * 0.24]] as const) {
      g.fillRoundedRect(x, y, s * 0.26, s * 0.26, s * 0.04);
      g.strokeRoundedRect(x, y, s * 0.26, s * 0.26, s * 0.04);
    }
  });
  // Carrot: orange triangle pointing down, leafy green top.
  shadowed('ing-carrot', (g) => {
    g.fillStyle(0xe67e22);
    g.fillTriangle(c - s * 0.14, s * 0.3, c + s * 0.14, s * 0.3, c, s * 0.88);
    g.fillStyle(0x27ae60);
    g.fillEllipse(c - s * 0.09, s * 0.2, s * 0.1, s * 0.2);
    g.fillEllipse(c + s * 0.09, s * 0.2, s * 0.1, s * 0.2);
    g.fillEllipse(c, s * 0.15, s * 0.1, s * 0.22);
  });
  // Potato: brown oval with darker eye dots.
  shadowed('ing-potato', (g) => {
    g.fillStyle(0xb7855a);
    g.fillEllipse(c, c, s * 0.68, s * 0.5);
    g.fillStyle(0x8c6239);
    g.fillCircle(c - s * 0.15, c - s * 0.06, s * 0.03);
    g.fillCircle(c + s * 0.12, c + s * 0.08, s * 0.03);
    g.fillCircle(c + s * 0.03, c - s * 0.12, s * 0.026);
  });
  // Onion: golden layered circle (concentric rings) with a top sprout.
  shadowed('ing-onion', (g) => {
    g.fillStyle(0xdfb98a);
    g.fillCircle(c, s * 0.56, s * 0.3);
    g.lineStyle(s * 0.025, 0xb9905f);
    g.strokeCircle(c, s * 0.56, s * 0.2);
    g.strokeCircle(c, s * 0.56, s * 0.1);
    g.fillStyle(0xb9905f);
    g.fillTriangle(c - s * 0.05, s * 0.3, c + s * 0.05, s * 0.3, c, s * 0.12);
  });
  // Dough: pale ball with a soft highlight.
  shadowed('ing-dough', (g) => {
    g.fillStyle(0xf3e5c2);
    g.fillEllipse(c, s * 0.58, s * 0.62, s * 0.46);
    g.fillStyle(0xffffff, 0.4);
    g.fillEllipse(c - s * 0.12, s * 0.47, s * 0.18, s * 0.1);
  });
  // Oil: olive-green bottle, dark cap, shine stripe.
  shadowed('ing-oil', (g) => {
    g.fillStyle(0xb5b93c);
    g.fillRoundedRect(s * 0.32, s * 0.4, s * 0.36, s * 0.46, s * 0.08);
    g.fillRect(s * 0.44, s * 0.22, s * 0.12, s * 0.2);
    g.fillStyle(0x555566);
    g.fillRect(s * 0.42, s * 0.13, s * 0.16, s * 0.09);
    g.fillStyle(0xffffff, 0.25);
    g.fillRoundedRect(s * 0.37, s * 0.46, s * 0.07, s * 0.32, s * 0.03);
  });
  // Salt: white shaker with a metal cap and holes.
  shadowed('ing-salt', (g) => {
    g.fillStyle(0xfdfefe);
    g.fillRoundedRect(s * 0.32, s * 0.36, s * 0.36, s * 0.5, { tl: s * 0.12, tr: s * 0.12, bl: s * 0.06, br: s * 0.06 });
    g.fillStyle(0xaab7b8);
    g.fillRoundedRect(s * 0.34, s * 0.2, s * 0.32, s * 0.16, s * 0.06);
    g.fillStyle(0x515a5a);
    g.fillCircle(c - s * 0.06, s * 0.28, s * 0.02);
    g.fillCircle(c + s * 0.06, s * 0.28, s * 0.02);
    g.fillCircle(c, s * 0.25, s * 0.02);
  });

  // Chop: chef's knife — grey blade tapering left, dark handle.
  sp('act-chop', (g) => {
    g.fillStyle(0xd5dbdb);
    g.fillPoints(pts([
      { x: c - r * 0.85, y: c + r * 0.1 }, { x: c + r * 0.3, y: c - r * 0.25 },
      { x: c + r * 0.3, y: c + r * 0.4 }, { x: c - r * 0.35, y: c + r * 0.4 },
    ]), true);
    g.fillStyle(0x6e2c00);
    g.fillRoundedRect(c + r * 0.28, c - r * 0.3, r * 0.58, r * 0.28, r * 0.1);
  });
  // Stir: wooden spoon (diagonal) + swirl arc.
  sp('act-stir', (g) => {
    g.fillStyle(0x8e5b2f);
    g.fillEllipse(c - r * 0.38, c + r * 0.38, r * 0.5, r * 0.6);
    g.fillPoints(pts([
      { x: c - r * 0.32, y: c + r * 0.16 }, { x: c + r * 0.52, y: c - r * 0.72 },
      { x: c + r * 0.68, y: c - r * 0.58 }, { x: c - r * 0.16, y: c + r * 0.3 },
    ]), true);
    g.lineStyle(s * 0.03, 0x2c2c54, 0.55);
    g.beginPath();
    g.arc(c, c + r * 0.1, r * 0.78, Math.PI * 0.15, Math.PI * 0.85, false);
    g.strokePath();
  });
  // Pour: tilted blue pitcher, handle arc, falling drops.
  sp('act-pour', (g) => {
    g.fillStyle(0x5dade2);
    g.fillPoints(pts([
      { x: c - r * 0.75, y: c - r * 0.5 }, { x: c + r * 0.15, y: c - r * 0.75 },
      { x: c + r * 0.45, y: c - r * 0.15 }, { x: c - r * 0.35, y: c + r * 0.1 },
    ]), true);
    g.lineStyle(s * 0.035, 0x5dade2);
    g.beginPath();
    g.arc(c - r * 0.62, c - r * 0.1, r * 0.3, Math.PI * 0.35, Math.PI * 1.25, false);
    g.strokePath();
    g.fillStyle(0x85c1e9);
    g.fillCircle(c + r * 0.45, c + r * 0.25, r * 0.09);
    g.fillCircle(c + r * 0.62, c + r * 0.52, r * 0.11);
    g.fillCircle(c + r * 0.3, c + r * 0.58, r * 0.08);
  });
  // Flip: spatula with slots + curved arrow above.
  sp('act-flip', (g) => {
    g.fillStyle(0x839192);
    g.fillRoundedRect(c - r * 0.75, c + r * 0.08, r * 0.72, r * 0.48, r * 0.1);
    g.fillStyle(0x6e2c00);
    g.fillRoundedRect(c - r * 0.05, c + r * 0.22, r * 0.85, r * 0.18, r * 0.09);
    g.fillStyle(0x2c2c54, 0.35);
    g.fillRect(c - r * 0.62, c + r * 0.18, r * 0.46, r * 0.05);
    g.fillRect(c - r * 0.62, c + r * 0.34, r * 0.46, r * 0.05);
    g.lineStyle(s * 0.035, 0x2c2c54);
    g.beginPath();
    g.arc(c - r * 0.2, c - r * 0.15, r * 0.45, Math.PI * 1.05, Math.PI * 1.95, false);
    g.strokePath();
    g.fillStyle(0x2c2c54);
    g.fillTriangle(c + r * 0.12, c - r * 0.34, c + r * 0.36, c - r * 0.34, c + r * 0.24, c - r * 0.08);
  });
  // Spread: flat butter knife over a yellow smear.
  sp('act-spread', (g) => {
    g.fillStyle(0xf7dc6f);
    g.fillEllipse(c, c + r * 0.45, r * 1.1, r * 0.32);
    g.fillStyle(0xd5dbdb);
    g.fillRoundedRect(c - r * 0.85, c - r * 0.3, r * 1.1, r * 0.28, r * 0.14);
    g.fillStyle(0x784212);
    g.fillRoundedRect(c + r * 0.25, c - r * 0.28, r * 0.6, r * 0.24, r * 0.1);
  });
  // Blend: blender jar with smoothie level, lid, dark base.
  sp('act-blend', (g) => {
    g.fillStyle(0xaed6f1, 0.9);
    g.fillPoints(pts([
      { x: c - r * 0.45, y: c - r * 0.62 }, { x: c + r * 0.45, y: c - r * 0.62 },
      { x: c + r * 0.32, y: c + r * 0.25 }, { x: c - r * 0.32, y: c + r * 0.25 },
    ]), true);
    g.fillStyle(0xe74c3c);
    g.fillPoints(pts([
      { x: c - r * 0.39, y: c - r * 0.18 }, { x: c + r * 0.39, y: c - r * 0.18 },
      { x: c + r * 0.32, y: c + r * 0.25 }, { x: c - r * 0.32, y: c + r * 0.25 },
    ]), true);
    g.fillStyle(0x555566);
    g.fillRoundedRect(c - r * 0.5, c + r * 0.25, r, r * 0.38, r * 0.08);
    g.fillRoundedRect(c - r * 0.45, c - r * 0.82, r * 0.9, r * 0.2, r * 0.06);
  });
  // Cook: dark pan side-view + orange heat squiggles.
  sp('act-cook', (g) => {
    g.fillStyle(0x2c2c54);
    g.fillRoundedRect(c - r * 0.78, c + r * 0.1, r * 1.1, r * 0.32, { tl: r * 0.05, tr: r * 0.05, bl: r * 0.16, br: r * 0.16 });
    g.fillRoundedRect(c + r * 0.28, c + r * 0.15, r * 0.58, r * 0.14, r * 0.07);
    g.lineStyle(s * 0.03, 0xe67e22);
    for (const dx of [-0.5, -0.15, 0.2]) {
      const x = c + r * dx;
      g.beginPath();
      g.moveTo(x, c - r * 0.1);
      g.lineTo(x + r * 0.09, c - r * 0.3);
      g.lineTo(x - r * 0.02, c - r * 0.52);
      g.lineTo(x + r * 0.09, c - r * 0.74);
      g.strokePath();
    }
  });

  // Mixing bowl: blue tapered bowl, darker rim, grey foot.
  shadowed('ui-bowl', (g) => {
    g.fillStyle(0x5dade2);
    g.fillPoints(pts([
      { x: s * 0.08, y: s * 0.36 }, { x: s * 0.92, y: s * 0.36 },
      { x: s * 0.74, y: s * 0.78 }, { x: s * 0.26, y: s * 0.78 },
    ]), true);
    g.fillStyle(0x3498db);
    g.fillRoundedRect(s * 0.06, s * 0.28, s * 0.88, s * 0.11, s * 0.055);
    g.fillStyle(0xd7dbdd);
    g.fillRect(s * 0.38, s * 0.78, s * 0.24, s * 0.08);
  });
  // Plate: white ellipse with an inner well ring.
  shadowed('ui-plate', (g) => {
    g.fillStyle(0xfdfefe);
    g.fillEllipse(c, c, s * 0.9, s * 0.52);
    g.lineStyle(s * 0.02, 0xaab7b8, 0.8);
    g.strokeEllipse(c, c, s * 0.58, s * 0.3);
  });
  // Hub card pan: top-view pan with a fried egg inside.
  ui('ui-pan-card', (g) => {
    g.fillStyle(0x2c2c54);
    g.fillCircle(s * 0.42, c, s * 0.3);
    g.fillRoundedRect(s * 0.64, c - s * 0.05, s * 0.32, s * 0.1, s * 0.05);
    g.fillStyle(0x555577);
    g.fillCircle(s * 0.42, c, s * 0.24);
    g.fillStyle(0xfdfefe);
    g.fillEllipse(s * 0.42, c, s * 0.3, s * 0.26);
    g.fillStyle(0xf1c40f);
    g.fillCircle(s * 0.42, c, s * 0.075);
  });
  // Padlock: gold body, grey shackle, dark keyhole.
  ui('ui-lock', (g) => {
    g.lineStyle(s * 0.07, 0xd5dbdb);
    g.beginPath();
    g.arc(c, s * 0.4, s * 0.17, Math.PI, Math.PI * 2, false);
    g.strokePath();
    g.fillStyle(0xf1c40f);
    g.fillRoundedRect(s * 0.26, s * 0.42, s * 0.48, s * 0.4, s * 0.08);
    g.fillStyle(0x7d6608);
    g.fillCircle(c, s * 0.58, s * 0.05);
    g.fillRect(c - s * 0.02, s * 0.58, s * 0.04, s * 0.12);
  });
  // Manager clipboard (decision #50): board + cream sheet, gold clip, three task lines.
  ui('ui-clipboard', (g) => {
    g.fillStyle(0x8d6e3f);
    g.fillRoundedRect(s * 0.18, s * 0.1, s * 0.64, s * 0.82, s * 0.08);
    g.fillStyle(PALETTE.cream);
    g.fillRoundedRect(s * 0.24, s * 0.22, s * 0.52, s * 0.62, s * 0.04);
    g.fillStyle(PALETTE.gold);
    g.fillRoundedRect(s * 0.38, s * 0.05, s * 0.24, s * 0.13, s * 0.05);
    g.lineStyle(s * 0.035, PALETTE.bgPlum);
    for (let i = 0; i < 3; i++) {
      const ly = s * (0.38 + i * 0.16);
      g.beginPath();
      g.moveTo(s * 0.31, ly);
      g.lineTo(s * 0.69, ly);
      g.strokePath();
    }
  });
  // Home button: blush circle + white house, gold ring (matches ui-play/ui-retry).
  ui('ui-home', (g) => {
    circleButton(g, PALETTE.blush);
    g.fillStyle(0xffffff);
    g.fillTriangle(c - r * 0.62, c - r * 0.02, c + r * 0.62, c - r * 0.02, c, c - r * 0.62);
    g.fillRoundedRect(c - r * 0.4, c - r * 0.02, r * 0.8, r * 0.56, r * 0.08);
    g.fillStyle(PALETTE.blush);
    g.fillRect(c - r * 0.1, c + r * 0.16, r * 0.2, r * 0.38);
  });
  // Hub logo: the studio ring light with a blush heart centre.
  ui('ui-logo-ring', (g) => {
    g.lineStyle(s * 0.02, PALETTE.cream, 0.35);
    g.strokeCircle(c, c, r);
    g.fillStyle(PALETTE.cream);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI * 2) / 12;
      g.fillCircle(c + Math.cos(a) * r, c + Math.sin(a) * r, r * 0.09);
    }
    g.fillStyle(PALETTE.blush);
    g.fillCircle(c - r * 0.18, c - r * 0.12, r * 0.21);
    g.fillCircle(c + r * 0.18, c - r * 0.12, r * 0.21);
    g.fillTriangle(c - r * 0.37, c - r * 0.03, c + r * 0.37, c - r * 0.03, c, c + r * 0.38);
  });

  // --- Serving mode (decision #53) textures ---
  // Three simple customer heads: hair disc behind, skin circle, dot eyes, smile.
  // Distinct hair + skin combos so the row reads as three different people.
  const custHead = (g: Phaser.GameObjects.Graphics, hair: number, skin: number): void => {
    g.fillStyle(hair);
    g.fillCircle(c, c - s * 0.06, s * 0.36);
    g.fillStyle(skin);
    g.fillCircle(c, c + s * 0.04, s * 0.32);
    g.fillStyle(0x2c2c54);
    g.fillCircle(c - s * 0.12, c, s * 0.045);
    g.fillCircle(c + s * 0.12, c, s * 0.045);
    g.lineStyle(s * 0.045, 0x2c2c54);
    g.beginPath();
    g.arc(c, c + s * 0.1, s * 0.13, Math.PI * 0.15, Math.PI * 0.85, false);
    g.strokePath();
  };
  ui('cust-0', (g) => custHead(g, 0x4a3222, 0xf0c8a0));
  ui('cust-1', (g) => custHead(g, 0x1b2631, 0x8d5524));
  ui('cust-2', (g) => custHead(g, 0xb9770e, 0xffdbac));
  // Speech bubble: cream rounded rect + tail pointing down-left toward the speaker.
  ui('ui-bubble', (g) => {
    g.fillStyle(PALETTE.cream);
    g.fillRoundedRect(s * 0.04, s * 0.08, s * 0.92, s * 0.68, s * 0.16);
    g.fillTriangle(s * 0.22, s * 0.72, s * 0.42, s * 0.72, s * 0.18, s * 0.96);
    g.lineStyle(s * 0.025, PALETTE.gold, 0.8);
    g.strokeRoundedRect(s * 0.04, s * 0.08, s * 0.92, s * 0.68, s * 0.16);
  });

  // --- Gate-runner (game #3) textures. Walls reuse ob-box2 at lane size. ---
  // Tiny person-dot: circle head over a shoulder blob; cream = squad, dark plum = foe.
  const personDot = (g: Phaser.GameObjects.Graphics, color: number): void => {
    g.fillStyle(color);
    g.fillCircle(c, s * 0.3, s * 0.16);
    g.fillEllipse(c, s * 0.66, s * 0.52, s * 0.4);
    g.lineStyle(s * 0.03, darken(color, 0.55));
    g.strokeCircle(c, s * 0.3, s * 0.16);
    g.strokeEllipse(c, s * 0.66, s * 0.52, s * 0.4);
  };
  ui('gr-pip', (g) => { personDot(g, PALETTE.cream); });
  ui('gr-foe-pip', (g) => { personDot(g, 0x4a3166); });
  // Glowing gate panel: translucent blush fill in a gold frame (op label is scene text).
  ui('gr-gate', (g) => {
    g.fillStyle(PALETTE.blush, 0.28);
    g.fillRoundedRect(s * 0.06, s * 0.06, s * 0.88, s * 0.88, s * 0.16);
    g.lineStyle(s * 0.05, PALETTE.gold);
    g.strokeRoundedRect(s * 0.06, s * 0.06, s * 0.88, s * 0.88, s * 0.16);
    g.fillStyle(0xffffff, 0.14);
    g.fillRoundedRect(s * 0.1, s * 0.1, s * 0.8, s * 0.22, s * 0.1);
  });
  // Finish flag: cream pole + blush pennant.
  ui('gr-flag', (g) => {
    g.fillStyle(PALETTE.cream);
    g.fillRoundedRect(c - s * 0.13, s * 0.06, s * 0.06, s * 0.88, s * 0.03);
    g.fillStyle(PALETTE.blush);
    g.fillTriangle(c - s * 0.07, s * 0.08, c - s * 0.07, s * 0.42, c + s * 0.42, s * 0.25);
    g.lineStyle(s * 0.025, darken(PALETTE.blush, 0.6));
    g.strokeTriangle(c - s * 0.07, s * 0.08, c - s * 0.07, s * 0.42, c + s * 0.42, s * 0.25);
  });

  // --- Plan 9 (legit-look pass): scene-dressing textures for the next agent ---

  // Radial gold glow: 16 stacked low-alpha circles, ~0.5 alpha at the centre
  // falling off to ~0 at the rim. 256px so it scales up without pixel edges.
  {
    const gs = 256;
    const g = scene.add.graphics();
    g.fillStyle(PALETTE.gold, 0.032);
    for (let i = 16; i >= 1; i--) {
      g.fillCircle(gs / 2, gs / 2, ((gs / 2 - 6) * i) / 16);
    }
    g.generateTexture('ui-glow', gs, gs);
    g.destroy();
  }

  // Wide pill CTA base (320x110): baked shadow, blush gradient body, top bevel,
  // gold ring. Generic button background for scene work; label is scene text.
  {
    const w = 320;
    const h = 110;
    const bodyH = h - 18;
    const rad = bodyH / 2;
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.12);
    g.fillRoundedRect(6, 12, w - 12, h - 14, (h - 14) / 2);
    g.fillStyle(0x000000, 0.18);
    g.fillRoundedRect(10, 14, w - 20, h - 20, (h - 20) / 2);
    gradRoundedRect(g, 8, 4, w - 16, bodyH, rad, lighten(PALETTE.blush, 0.3), darken(PALETTE.blush, 0.72));
    g.fillStyle(0xffffff, 0.32);
    g.fillEllipse(w / 2, 4 + bodyH * 0.26, (w - 16) * 0.82, bodyH * 0.42);
    g.lineStyle(4, PALETTE.gold);
    g.strokeRoundedRect(8, 4, w - 16, bodyH, rad);
    g.generateTexture('btn-pill', w, h);
    g.destroy();
  }
}
