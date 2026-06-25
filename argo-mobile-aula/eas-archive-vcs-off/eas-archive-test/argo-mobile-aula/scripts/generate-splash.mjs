/**
 * Genera assets de branding con fondo índigo Educarte (#6366F1).
 * Ejecutar: node scripts/generate-splash.mjs
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const sharp = require(path.join(__dirname, '../../argo-backend/node_modules/sharp'));

const AZUL_REY = { r: 99, g: 102, b: 241 };
const BRANDING = path.join(__dirname, '../assets/branding');
const ASSETS = path.join(__dirname, '../assets');
const LOGO = path.join(BRANDING, 'logo.png');

async function logoOnBlue(width, height, logoMax) {
  const logoBuf = await sharp(LOGO)
    .resize(logoMax, logoMax, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer();

  const meta = await sharp(logoBuf).metadata();
  const lw = meta.width || logoMax;
  const lh = meta.height || logoMax;
  const left = Math.round((width - lw) / 2);
  const top = Math.round((height - lh) / 2);

  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: AZUL_REY,
    },
  })
    .composite([{ input: logoBuf, left, top }])
    .png()
    .toBuffer();
}

async function write(buf, dest) {
  await fs.promises.writeFile(dest, buf);
  console.log('OK:', dest);
}

async function main() {
  const splashBuf = await logoOnBlue(1080, 1920, 520);
  await write(splashBuf, path.join(BRANDING, 'splash-full.png'));

  const iconBuf = await logoOnBlue(1024, 1024, 720);
  await write(iconBuf, path.join(BRANDING, 'icon-app.png'));

  for (const name of ['icon.png', 'adaptive-icon.png', 'splash-icon.png']) {
    await write(iconBuf, path.join(ASSETS, name));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
