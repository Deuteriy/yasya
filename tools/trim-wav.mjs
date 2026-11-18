// Обрезка WAV без ffmpeg: node tools/trim-wav.mjs <file.wav> <секунды>
// Оставляет первые N секунд, последние 0.15с — плавное затухание.
import fs from 'node:fs';

const [file, secStr] = process.argv.slice(2);
if (!file || !secStr) {
  console.error('использование: node tools/trim-wav.mjs file.wav 3');
  process.exit(1);
}
const keepSec = parseFloat(secStr);

const buf = fs.readFileSync(file);
if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
  console.error('не WAV файл');
  process.exit(1);
}

// идём по чанкам
let pos = 12;
let fmt = null;
let dataStart = -1;
let dataLen = 0;
while (pos + 8 <= buf.length) {
  const id = buf.toString('ascii', pos, pos + 4);
  const size = buf.readUInt32LE(pos + 4);
  if (id === 'fmt ') fmt = buf.subarray(pos + 8, pos + 8 + size);
  if (id === 'data') {
    dataStart = pos + 8;
    dataLen = size;
    break; // data обычно последний
  }
  pos += 8 + size + (size % 2);
}
if (!fmt || dataStart < 0) {
  console.error('не нашёл fmt/data чанки');
  process.exit(1);
}

const ch = fmt.readUInt16LE(2);
const sr = fmt.readUInt32LE(4);
const bits = fmt.readUInt16LE(14);
if (bits !== 16) {
  console.error(`только 16-бит PCM, а тут ${bits}`);
  process.exit(1);
}

const frame = ch * 2; // байт на кадр
const totalFrames = Math.floor(dataLen / frame);
const keepFrames = Math.min(totalFrames, Math.round(keepSec * sr));
const fadeFrames = Math.round(0.15 * sr);

const out = Buffer.from(buf.subarray(dataStart, dataStart + keepFrames * frame));
for (let i = Math.max(0, keepFrames - fadeFrames); i < keepFrames; i++) {
  const g = (keepFrames - i) / Math.max(1, keepFrames - (keepFrames - fadeFrames));
  for (let c = 0; c < ch; c++) {
    const off = i * frame + c * 2;
    out.writeInt16LE(Math.round(out.readInt16LE(off) * g), off);
  }
}

const res = Buffer.alloc(20 + fmt.length + 8 + out.length);
res.write('RIFF', 0);
res.writeUInt32LE(4 + 8 + fmt.length + 8 + out.length, 4);
res.write('WAVE', 8);
res.write('fmt ', 12);
res.writeUInt32LE(fmt.length, 16);
fmt.copy(res, 20);
const d = 20 + fmt.length;
res.write('data', d);
res.writeUInt32LE(out.length, d + 4);
out.copy(res, d + 8);

fs.writeFileSync(file, res);
console.log(
  `${file}: ${(totalFrames / sr).toFixed(1)}с → ${(keepFrames / sr).toFixed(1)}с, ` +
    `${ch}к ${sr}Гц, ${(res.length / 1024).toFixed(0)}КБ`
);
