const fs = require('fs');
const path = require('path');
const { raizContenido } = require('./aulaVirtualPaquete');

const BRIDGE_MARKER = 'argo-bridge.js';
const META_PREFIX_MARKER = 'argo-storage-prefix';

function bridgeScriptUrl() {
  /** Ruta relativa: funciona en localhost, LAN o producción (mismo host que sirve /uploads). */
  return '/api/aula-virtual/argo-bridge.js';
}

function listarHtmlPaquete(absDir) {
  const out = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (/\.html?$/i.test(ent.name)) out.push(full);
    }
  }
  walk(absDir);
  return out;
}

function buscarCursoAppJs(contentRoot) {
  const direct = path.join(contentRoot, 'curso-app.js');
  if (fs.existsSync(direct)) return direct;

  const queue = [contentRoot];
  while (queue.length) {
    const dir = queue.shift();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
      continue;
    }
    for (const ent of entries) {
      if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) queue.push(full);
      else if (ent.name === 'curso-app.js') return full;
    }
  }
  return null;
}

/** Lee STORAGE_PREFIX de curso-app.js (p. ej. curso-primer-respondiente). */
function detectarStoragePrefix(absDir, indexHtml = 'index.html') {
  const contentRoot = raizContenido(absDir, indexHtml);
  const appJs = buscarCursoAppJs(contentRoot);
  if (!appJs) return null;
  try {
    const src = fs.readFileSync(appJs, 'utf8');
    const m = src.match(/(?:const|let|var)\s+STORAGE_PREFIX\s*=\s*["']([^"']+)["']/);
    return m ? m[1].trim() : null;
  } catch (_e) {
    return null;
  }
}

function escAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function inyectarMetaPrefixEnHtml(html, storagePrefix) {
  if (!storagePrefix) return html;
  const meta = `<meta name="${META_PREFIX_MARKER}" content="${escAttr(storagePrefix)}">`;
  if (html.includes(META_PREFIX_MARKER)) {
    return html.replace(/<meta[^>]*name=["']argo-storage-prefix["'][^>]*>/i, meta);
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, `$&\n  ${meta}`);
  }
  return `${meta}\n${html}`;
}

function inyectarScriptEnHtml(html, scriptTag) {
  if (html.includes(BRIDGE_MARKER)) return html;

  const cursoAppRe = /<script[^>]+src=["'][^"']*curso-app\.js[^"']*["'][^>]*>\s*<\/script>/i;
  if (cursoAppRe.test(html)) {
    return html.replace(cursoAppRe, `${scriptTag}\n  $&`);
  }

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `  ${scriptTag}\n</body>`);
  }
  if (/<\/html>/i.test(html)) {
    return html.replace(/<\/html>/i, `${scriptTag}\n</html>`);
  }
  return `${html}\n${scriptTag}\n`;
}

function inyectarBridgeEnArchivo(filePath, storagePrefix = null) {
  let html = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  if (storagePrefix) {
    const withMeta = inyectarMetaPrefixEnHtml(html, storagePrefix);
    if (withMeta !== html) {
      html = withMeta;
      changed = true;
    }
  }

  const tieneBridgeOk =
    html.includes(BRIDGE_MARKER) && html.includes('src="/api/aula-virtual/argo-bridge.js"');

  if (!tieneBridgeOk) {
    if (html.includes(BRIDGE_MARKER)) {
      html = html.replace(/<script[^>]*argo-bridge\.js[^>]*>\s*<\/script>\s*/gi, '');
    }
    const scriptTag = `<script src="${bridgeScriptUrl()}"></script>`;
    const withScript = inyectarScriptEnHtml(html, scriptTag);
    if (withScript !== html) {
      html = withScript;
      changed = true;
    }
  }

  if (changed) fs.writeFileSync(filePath, html, 'utf8');
  return changed;
}

/** Inyecta argo-bridge.js y meta de prefijo localStorage en todos los HTML del paquete. */
function inyectarBridgeEnPaquete(absDir, indexHtml = 'index.html') {
  const contentRoot = raizContenido(absDir, indexHtml);
  const files = listarHtmlPaquete(contentRoot);
  const storagePrefix = detectarStoragePrefix(absDir, indexHtml);
  if (!files.length) return { inyectados: 0, total: 0, storagePrefix };

  let inyectados = 0;
  for (const f of files) {
    if (inyectarBridgeEnArchivo(f, storagePrefix)) inyectados++;
  }
  return { inyectados, total: files.length, storagePrefix };
}

module.exports = {
  inyectarBridgeEnPaquete,
  inyectarBridgeEnArchivo,
  bridgeScriptUrl,
  listarHtmlPaquete,
  detectarStoragePrefix,
};
