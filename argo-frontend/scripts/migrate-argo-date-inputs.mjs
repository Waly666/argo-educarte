#!/usr/bin/env node
/**
 * Migra <input type="date"> → <argo-date-input> e importa el componente en el .ts hermano.
 * Uso: node scripts/migrate-argo-date-inputs.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(__dirname, '..', 'src', 'app');

function relImport(fromFile, target) {
  let rel = path.relative(path.dirname(fromFile), target).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel.replace(/\.ts$/, '');
}

function migrateHtml(html) {
  let out = html;

  // label wrapping: <label>Text <input type="date" ... /></label>
  out = out.replace(
    /<label([^>]*)>\s*([^<]+?)\s*<input([^>]*?)type="date"([^>]*?)\s*\/?>\s*<\/label>/gi,
    (_, lblAttrs, lblText, pre, post) => {
      const attrs = (pre + post).trim();
      const idM = attrs.match(/\bid="([^"]+)"/);
      const inputId = idM ? ` inputId="${idM[1]}"` : '';
      const clean = attrs.replace(/\s*id="[^"]*"/, '').replace(/\s*type="date"/, '').trim();
      return `<argo-date-input label="${lblText.trim()}"${inputId} ${clean}></argo-date-input>`;
    },
  );

  // label on previous line + input
  out = out.replace(
    /<label([^>]*?)for="([^"]+)"([^>]*)>([^<]+)<\/label>\s*\n\s*<input([^>]*?)id="\2"([^>]*?)type="date"([^>]*?)\s*\/?>/gi,
    (_, _a, id, _b, lbl, pre, mid, post) => {
      const attrs = (pre + mid + post).replace(/\s*id="[^"]*"/, '').replace(/\s*type="date"/, '').trim();
      return `<argo-date-input label="${lbl.trim()}" inputId="${id}" ${attrs}></argo-date-input>`;
    },
  );

  out = out.replace(
    /<label([^>]*)>([^<]+)<\/label>\s*\n\s*<input([^>]*?)type="date"([^>]*?)\s*\/?>/gi,
    (_, _attrs, lbl, pre, post) => {
      const attrs = (pre + post).replace(/\s*type="date"/, '').trim();
      return `<argo-date-input label="${lbl.trim()}" ${attrs}></argo-date-input>`;
    },
  );

  // standalone input
  out = out.replace(/<input([^>]*?)type="date"([^>]*?)\s*\/?>/gi, (_, pre, post) => {
    const attrs = (pre + post)
      .replace(/\s*type="date"/, '')
      .replace(/\s*class="fecha-input-accent"/, '')
      .trim();
    return `<argo-date-input ${attrs}></argo-date-input>`;
  });

  return out;
}

function migrateTs(tsPath, htmlChanged) {
  if (!htmlChanged) return false;
  let ts = fs.readFileSync(tsPath, 'utf8');
  if (ts.includes('ArgoDateInputComponent')) return false;

  const target = path.join(APP, 'shared', 'argo-date-input', 'argo-date-input.component.ts');
  const imp = `import { ArgoDateInputComponent } from '${relImport(tsPath, target)}';`;

  const importMatch = ts.match(/^import .+ from .+;\s*\n/m);
  if (importMatch) {
    const idx = ts.indexOf(importMatch[0]) + importMatch[0].length;
    ts = ts.slice(0, idx) + imp + '\n' + ts.slice(idx);
  } else {
    ts = imp + '\n' + ts;
  }

  ts = ts.replace(
    /imports:\s*\[([\s\S]*?)\]/,
    (full, inner) => {
      if (inner.includes('ArgoDateInputComponent')) return full;
      const trimmed = inner.trimEnd();
      const suffix = trimmed.endsWith(',') || !trimmed ? '' : ',';
      return `imports: [${inner}${suffix}\n    ArgoDateInputComponent,\n  ]`;
    },
  );

  fs.writeFileSync(tsPath, ts, 'utf8');
  return true;
}

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (name.endsWith('.component.html')) {
      const html = fs.readFileSync(p, 'utf8');
      if (!html.includes('type="date"')) continue;
      const migrated = migrateHtml(html);
      if (migrated !== html) {
        fs.writeFileSync(p, migrated, 'utf8');
        const tsPath = p.replace(/\.html$/, '.ts');
        if (fs.existsSync(tsPath)) migrateTs(tsPath, true);
        console.log('OK', path.relative(APP, p));
      }
    }
  }
}

walk(APP);
console.log('Migración terminada.');
