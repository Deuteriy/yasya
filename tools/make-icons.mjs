// Генератор PNG-иконок без внешних зависимостей.
// Запуск: node tools/make-icons.mjs
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.join(process.cwd(), 'assets', 'icons');
fs.mkdirSync(OUT_DIR, { recursive: true });

// --- минимальный PNG-энкодер (RGBA, фильтр 0) ---
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // бит на канал
  ihdr[9] = 6;  // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // фильтр none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- рисование: сплошной фон + круги (антиалиас по краю) ---
function inCircle(x, y, cx, cy, r) {
  const d = Math.hypot(x - cx, y - cy);
  return d <= r ? Math.min(1, r - d + 0.5) : 0; // плавный край 1px
}

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const bg = [255, 179, 68];      // тёплый жёлто-оранжевый
  const white = [255, 255, 255];
  const coral = [255, 107, 107];  // пятнышки

  const blend = (a, c, t) => Math.round(a * (1 - t) + c * t);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let r = bg[0], g = bg[1], b = bg[2];

      // большой белый круг в центре
      const t1 = inCircle(x, y, size / 2, size / 2, size * 0.32);
      r = blend(r, white[0], t1); g = blend(g, white[1], t1); b = blend(b, white[2], t1);

      // два коралловых пятнышка (пузырьки)
      const t2 = inCircle(x, y, size * 0.28, size * 0.28, size * 0.07);
      r = blend(r, coral[0], t2); g = blend(g, coral[1], t2); b = blend(b, coral[2], t2);
      const t3 = inCircle(x, y, size * 0.72, size * 0.68, size * 0.05);
      r = blend(r, coral[0], t3); g = blend(g, coral[1], t3); b = blend(b, coral[2], t3);

      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
  }
  return encodePNG(size, size, px);
}

for (const size of [180, 192, 512]) {
  const file = path.join(OUT_DIR, `icon-${size}.png`);
  fs.writeFileSync(file, drawIcon(size));
  console.log('created', file);
}
