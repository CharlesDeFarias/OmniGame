import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';

// App icon (plan 7, decisions #43/#49; profile colors, decision #54): plum backdrop, gold ring,
// centered blush heart, small gold "ring light" above-right. Matches
// src/render/palette.ts (bgPlum / gold / blush).
const PLUM: [number, number, number] = [42, 31, 61]; // 0x2a1f3d
const GOLD: [number, number, number] = [245, 197, 66]; // 0xf5c542
const BLUSH: [number, number, number] = [253, 121, 168]; // 0xfd79a8

/** Implicit heart curve (x^2 + y^2 - 1)^3 - x^2 y^3 <= 0, y-up coordinates. */
function inHeart(u: number, v: number): boolean {
  const a = u * u + v * v - 1;
  return a * a * a - u * u * v * v * v <= 0;
}

function makeIcon(size: number, file: string): void {
  const png = new PNG({ width: size, height: size });
  const cx = size / 2;
  const cy = size / 2;
  const ringR = size * 0.39; // ring diameter ~78% of icon
  const ringW = size * 0.035;
  const heartScale = size * 0.22;
  const heartCy = size * 0.54; // implicit curve sits high; nudge down to look centered
  const dotX = size * 0.7;
  const dotY = size * 0.3;
  const dotR = size * 0.05;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (size * y + x) << 2;
      let [r, g, b] = PLUM;
      const d = Math.hypot(x - cx, y - cy);
      if (Math.abs(d - ringR) <= ringW / 2) [r, g, b] = GOLD;
      if (inHeart((x - cx) / heartScale, (heartCy - y) / heartScale)) [r, g, b] = BLUSH;
      if (Math.hypot(x - dotX, y - dotY) <= dotR) [r, g, b] = GOLD;
      png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = 255;
    }
  }
  writeFileSync(file, PNG.sync.write(png));
}

makeIcon(192, 'public/icon-192.png');
makeIcon(512, 'public/icon-512.png');
console.log('icons written');
