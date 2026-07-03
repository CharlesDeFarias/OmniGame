import type Phaser from 'phaser';
import type { Piece, PieceColor } from '../core/match3/index';

export const COLOR_HEX: Record<PieceColor, number> = {
  red: 0xe74c3c,
  blue: 0x3498db,
  green: 0x2ecc71,
  yellow: 0xf1c40f,
  purple: 0x9b59b6,
  orange: 0xe67e22,
};

export function textureKeyFor(piece: Piece): string {
  if (piece.kind === 'normal') return `gem-${piece.color}`;
  if (piece.kind === 'special') return `sp-${piece.special}`;
  return piece.hp >= 2 ? 'ob-box2' : 'ob-box1';
}

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
  const gem = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
    const g = scene.add.graphics();
    draw(g);
    g.fillStyle(0xffffff, 0.28);
    g.fillEllipse(c - r * 0.35, c - r * 0.4, r * 0.55, r * 0.35);
    g.generateTexture(key, s, s);
    g.destroy();
  };

  gem('gem-red', (g) => { g.fillStyle(COLOR_HEX.red); g.fillCircle(c, c, r); });
  gem('gem-blue', (g) => { g.fillStyle(COLOR_HEX.blue); g.fillPoints(poly(c, c, r * 1.05, 3, -Math.PI / 2), true); });
  gem('gem-green', (g) => { g.fillStyle(COLOR_HEX.green); g.fillRoundedRect(c - r * 0.85, c - r * 0.85, r * 1.7, r * 1.7, r * 0.35); });
  gem('gem-yellow', (g) => { g.fillStyle(COLOR_HEX.yellow); g.fillPoints(poly(c, c, r * 1.05, 4, -Math.PI / 2), true); });
  gem('gem-purple', (g) => { g.fillStyle(COLOR_HEX.purple); g.fillPoints(poly(c, c, r, 6, 0), true); });
  gem('gem-orange', (g) => { g.fillStyle(COLOR_HEX.orange); g.fillPoints(star(c, c, r * 1.05, r * 0.5, 5), true); });

  const sp = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
    const g = scene.add.graphics();
    g.fillStyle(0xf5f0ff);
    g.fillCircle(c, c, r * 1.05);
    g.lineStyle(s * 0.03, 0x2c2c54);
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
  ui('ui-star', (g) => { g.fillStyle(0xf1c40f); g.fillPoints(star(c, c, r * 1.1, r * 0.5, 5), true); });
  ui('ui-play', (g) => {
    g.fillStyle(0x2ecc71);
    g.fillCircle(c, c, r * 1.1);
    g.fillStyle(0xffffff);
    g.fillTriangle(c - r * 0.35, c - r * 0.5, c - r * 0.35, c + r * 0.5, c + r * 0.55, c);
  });
  ui('ui-retry', (g) => {
    g.fillStyle(0x3498db);
    g.fillCircle(c, c, r * 1.1);
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
  ui('ui-tile', (g) => { g.fillStyle(0xffffff); g.fillRoundedRect(s * 0.02, s * 0.02, s * 0.96, s * 0.96, s * 0.16); });
  ui('ui-panel', (g) => { g.fillStyle(0x000000); g.fillRoundedRect(0, 0, s, s, s * 0.2); });

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

  // Avatars: outfits [purple, green, orange] x poses 0-2, plus the default alias.
  const OUTFITS = [0x9b59b6, 0x2ecc71, 0xe67e22] as const;
  OUTFITS.forEach((color, o) => {
    for (const pose of [0, 1, 2] as const) makeAvatarTexture(scene, `avatar-o${o}-p${pose}`, color, pose);
  });
  makeAvatarTexture(scene, 'avatar-0', 0x9b59b6, 0);

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
      ui(`furn-${slot}-${style}`, (g) => furnDraw[slot]!(g, FURN_ACCENT[style]!));
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
}
