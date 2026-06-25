const fs = require('fs');
const path = require('path');

function normRel(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function existeArchivoCaseInsensitive(dir, relPath) {
  const rel = normRel(relPath);
  const abs = path.join(path.resolve(dir), rel);
  if (fs.existsSync(abs)) return rel;
  const parts = rel.split('/');
  let current = path.resolve(dir);
  for (const part of parts) {
    if (!fs.existsSync(current)) return null;
    const entries = fs.readdirSync(current);
    const hit = entries.find((name) => name.toLowerCase() === part.toLowerCase());
    if (!hit) return null;
    current = path.join(current, hit);
  }
  return path.relative(path.resolve(dir), current).split(path.sep).join('/');
}

/** Busca index.html en la raíz o en una subcarpeta (ZIP con carpeta contenedora). */
function detectarIndexHtml(absDir, preferred = 'index.html') {
  const pref = normRel(preferred) || 'index.html';
  const abs = path.resolve(absDir);
  if (!fs.existsSync(abs)) return pref;

  const direct = existeArchivoCaseInsensitive(abs, pref);
  if (direct) return direct;

  const baseName = path.basename(pref);
  const dirs = fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== '__MACOSX');

  const hits = [];
  for (const ent of dirs) {
    const candidate = existeArchivoCaseInsensitive(abs, `${ent.name}/${path.basename(pref)}`);
    if (candidate) hits.push(candidate);
  }

  if (hits.length === 1) return hits[0];

  for (const ent of dirs) {
    const found = detectarIndexHtml(path.join(abs, ent.name), path.basename(pref));
    const combined = found.includes('/') ? `${ent.name}/${found}` : `${ent.name}/${found}`;
    if (existeArchivoCaseInsensitive(abs, combined)) return combined;
  }

  return pref;
}

function raizContenido(absDir, indexHtmlRel) {
  const rel = normRel(indexHtmlRel);
  const abs = path.resolve(absDir);
  if (!rel.includes('/')) return abs;
  const sub = path.dirname(rel);
  return path.join(abs, sub);
}

function paqueteListo(absDir, indexHtmlRel) {
  const rel = normRel(indexHtmlRel);
  return !!existeArchivoCaseInsensitive(absDir, rel);
}

function listarEntradasPaquete(absDir, max = 12) {
  const abs = path.resolve(absDir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.name !== '__MACOSX' && !e.name.startsWith('.'))
    .slice(0, max)
    .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
}

module.exports = {
  detectarIndexHtml,
  raizContenido,
  paqueteListo,
  listarEntradasPaquete,
  normRel,
};
