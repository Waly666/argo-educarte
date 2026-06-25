import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const input = process.argv[2] ?? path.join(__dirname, '../public/imagenes/hero-flota-src.jpg');
const output = process.argv[3] ?? path.join(__dirname, '../public/imagenes/hero-flota.png');

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

for (let i = 0; i < info.width * info.height; i++) {
  const o = i * 4;
  const r = data[o];
  const g = data[o + 1];
  const b = data[o + 2];
  const lum = Math.max(r, g, b);

  if (lum <= 32) {
    data[o + 3] = 0;
  } else if (lum <= 64) {
    data[o + 3] = Math.min(255, Math.round((lum - 32) * 8));
  } else {
    data[o + 3] = 255;
  }
}

await sharp(data, { raw: info }).png().toFile(output);
console.log(`OK: ${output} (${info.width}x${info.height}, RGBA)`);
