import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';

const COLORS: [number, number, number][] = [
  [231, 76, 60], [52, 152, 219], [46, 204, 113],
  [241, 196, 15], [155, 89, 182], [230, 126, 34],
  [231, 76, 60], [52, 152, 219], [46, 204, 113],
];

function makeIcon(size: number, file: string): void {
  const png = new PNG({ width: size, height: size });
  const bg: [number, number, number] = [26, 26, 46];
  const pad = Math.floor(size * 0.08);
  const cell = Math.floor((size - 2 * pad) / 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (size * y + x) << 2;
      let [r, g, b] = bg;
      const cx = Math.floor((x - pad) / cell);
      const cy = Math.floor((y - pad) / cell);
      if (x >= pad && y >= pad && cx >= 0 && cx < 3 && cy >= 0 && cy < 3) {
        const inX = (x - pad) % cell;
        const inY = (y - pad) % cell;
        const m = Math.floor(cell * 0.12);
        if (inX > m && inX < cell - m && inY > m && inY < cell - m) {
          [r, g, b] = COLORS[cy * 3 + cx]!;
        }
      }
      png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = 255;
    }
  }
  writeFileSync(file, PNG.sync.write(png));
}

makeIcon(192, 'public/icon-192.png');
makeIcon(512, 'public/icon-512.png');
console.log('icons written');
