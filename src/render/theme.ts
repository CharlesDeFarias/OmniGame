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
  return piece.kind === 'normal' ? `gem-${piece.color}` : `sp-${piece.special}`;
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

/** Generates all gem/special/UI textures once. size = texture edge in px. */
export function makeTextures(scene: Phaser.Scene, size: number): void {
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
}
