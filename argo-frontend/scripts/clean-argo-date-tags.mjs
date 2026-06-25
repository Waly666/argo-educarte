#!/usr/bin/env node
/** Limpia cierres malformados `"/></argo-date-input>` → `"></argo-date-input>`. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app');

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.html')) {
      let c = fs.readFileSync(p, 'utf8');
      const o = c;
      c = c.replace(/\/\s*\/?>\s*<\/argo-date-input>/g, '></argo-date-input>');
      if (c !== o) {
        fs.writeFileSync(p, c);
        console.log('cleaned', path.relative(APP, p));
      }
    }
  }
}

walk(APP);
console.log('Listo.');
