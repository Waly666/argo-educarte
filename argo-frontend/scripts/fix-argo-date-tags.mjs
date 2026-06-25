#!/usr/bin/env node
/** Corrige cierre ` / />` → `></argo-date-input>` preservando atributos. */
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
      c = c.replace(/<argo-date-input([\s\S]*?)\s\/\s*\/>/g, '<argo-date-input$1></argo-date-input>');
      if (c !== o) {
        fs.writeFileSync(p, c);
        console.log('fixed', path.relative(APP, p));
      }
    }
  }
}

walk(APP);
console.log('Listo.');
