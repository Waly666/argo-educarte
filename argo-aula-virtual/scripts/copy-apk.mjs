import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, '..', 'apk');
const dest = join(root, 'public', 'apk');

if (!existsSync(src)) {
  console.warn('[copy-apk] Carpeta apk/ no encontrada en la raíz del monorepo; omitiendo.');
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true, force: true });
console.log('[copy-apk] APK copiado a public/apk/');
