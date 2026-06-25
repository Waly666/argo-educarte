const { TIPOS_VALIDOS, ORIENTACIONES } = require('./clasificacionCertificado');
const {
  CAMPOS_IDS,
  DEFAULTS_ORIENTACION,
  QR_PRESETS,
  QR_DEFAULT_SIZE_PCT,
} = require('../constants/certificadoLayoutDefaults');
const {
  clampSizePct,
  qrCssWidth,
  qrRasterPx,
  resolveSizePct,
  QR_SIZE_PCT_MIN,
  QR_SIZE_PCT_MAX,
} = require('../utils/certificadoQr');

const ALIGN_VALIDOS = new Set(['left', 'center', 'right']);
const COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const PCT_RE = /^(\d{1,3})(\.\d+)?%$/;
const SIZE_RE = /^(\d{1,3})(\.\d+)?(pt|px|mm)$/;

function limpiarPct(v, fallback) {
  const s = String(v ?? '').trim();
  if (PCT_RE.test(s)) return s;
  return fallback;
}

const FS_MIN_PT = 4;
const FS_MAX_PT = 72;

function limpiarSize(v, fallback) {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const clamped = Math.min(FS_MAX_PT, Math.max(FS_MIN_PT, v));
    return `${clamped}pt`;
  }
  const s = String(v ?? '').trim();
  const bare = s.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) {
    const num = parseFloat(bare[1]);
    const clamped = Math.min(FS_MAX_PT, Math.max(FS_MIN_PT, num));
    return `${clamped}pt`;
  }
  const m = s.match(SIZE_RE);
  if (m) {
    const num = parseFloat(m[1]);
    const unit = m[3];
    if (unit === 'pt' && Number.isFinite(num)) {
      const clamped = Math.min(FS_MAX_PT, Math.max(FS_MIN_PT, num));
      return `${clamped}pt`;
    }
    return s;
  }
  return fallback;
}

function limpiarColor(v, fallback) {
  const s = String(v ?? '').trim();
  if (COLOR_RE.test(s)) return s;
  return fallback;
}

function limpiarAlign(v, fallback) {
  const s = String(v ?? '').trim().toLowerCase();
  return ALIGN_VALIDOS.has(s) ? s : fallback;
}

function normalizeCampo(raw, defaults) {
  const d = defaults || {};
  const r = raw && typeof raw === 'object' ? raw : {};
  if (r.visible === false) return { ...d, visible: false };

  const out = { visible: true };

  // Arriba y abajo son excluyentes (código del certificado usa "bottom" por defecto)
  const usuarioFijoTop = r.top != null && String(r.top).trim() !== '';
  const usuarioFijoBottom = r.bottom != null && String(r.bottom).trim() !== '';
  const usuarioQuitaBottom = r.bottom === null;
  const defectoUsaBottom = d.bottom != null && (d.top == null || d.top === undefined);

  if (usuarioFijoTop || usuarioQuitaBottom) {
    out.top = limpiarPct(r.top, d.top || '50%');
  } else if (usuarioFijoBottom || defectoUsaBottom) {
    out.bottom = limpiarPct(r.bottom, d.bottom || '10%');
  } else if (d.top != null) {
    out.top = limpiarPct(r.top, d.top);
  }
  if (d.left != null || r.left != null) out.left = limpiarPct(r.left, d.left);
  if (d.right != null || r.right != null) out.right = limpiarPct(r.right, d.right);
  if (d.w != null || r.w != null) out.w = limpiarPct(r.w, d.w);
  const fsRaw = r.fs != null && String(r.fs).trim() !== '' ? r.fs : null;
  if (fsRaw != null || d.fs != null) out.fs = limpiarSize(fsRaw, d.fs);
  const fwRaw = r.fw != null && String(r.fw).trim() !== '' ? r.fw : null;
  if (fwRaw != null || d.fw != null) out.fw = String(fwRaw ?? d.fw).trim() || d.fw;
  if (d.ls != null || r.ls != null) out.ls = String(r.ls ?? d.ls).trim() || d.ls;
  if (d.align != null || r.align != null) out.align = limpiarAlign(r.align, d.align || 'center');
  // Campos con left por defecto (expedida, tipoDoc, doc…): no heredar center si no hubo left explícito
  const leftUsuario = r.left != null && String(r.left).trim() !== '';
  if (d.left && d.align === 'left' && out.align === 'center' && !leftUsuario) {
    out.align = 'left';
  }
  const ffRaw =
    r.fontFamily != null && String(r.fontFamily).trim() !== '' ? r.fontFamily : null;
  if (ffRaw != null || d.fontFamily != null) {
    const ff = String(ffRaw ?? d.fontFamily).trim().slice(0, 80);
    if (ff) out.fontFamily = ff.replace(/[<>"']/g, '');
  }
  if (r.color != null) out.color = limpiarColor(r.color, d.color);
  return out;
}

/** Mezcla layout legado (campos en raíz del slot) con layout nuevo (slot.campos). */
function savedCampo(slot, id) {
  const legacy = slot[id];
  const modern = slot.campos?.[id];
  if (modern != null && legacy != null && typeof modern === 'object' && typeof legacy === 'object') {
    return { ...legacy, ...modern };
  }
  return modern != null ? modern : legacy;
}

function normalizeLayoutOrientacion(raw, orientacion) {
  const base = DEFAULTS_ORIENTACION[orientacion] || DEFAULTS_ORIENTACION.vertical;
  const r = raw && typeof raw === 'object' ? raw : {};
  const color = limpiarColor(r.color, base.color);
  const hasCampos = r.campos && typeof r.campos === 'object';
  const layout = {
    pageW: base.pageW,
    pageH: base.pageH,
    color,
  };
  for (const id of CAMPOS_IDS) {
    const def = base[id];
    if (!def) continue;
    const saved = hasCampos ? savedCampo(r, id) : r[id];
    layout[id] = normalizeCampo(saved, def);
  }
  return layout;
}

function presetQr(orientacion, presetKey) {
  const ori = orientacion === 'horizontal' ? 'horizontal' : 'vertical';
  const map = QR_PRESETS[ori] || QR_PRESETS.vertical;
  return map[presetKey] || map.inferior_izquierda;
}

function normalizeQr(raw, orientacion, globalConfig, options = {}) {
  const fillDefaults = options.fillDefaults !== false;
  const presetKey = globalConfig?.qrPosicion || 'inferior_izquierda';
  const def = presetQr(orientacion, presetKey);
  const r = raw && typeof raw === 'object' ? raw : {};
  const sizePct = resolveSizePct(r, orientacion, globalConfig);

  const explicitTop = r.top != null && String(r.top).trim() !== '';
  const explicitBottom = r.bottom != null && String(r.bottom).trim() !== '';
  const userClearsBottom = r.bottom === null;
  const userClearsTop = r.top === null;
  const explicitLeft = r.left != null && String(r.left).trim() !== '';
  const explicitRight = r.right != null && String(r.right).trim() !== '';

  const out = { sizePct: clampSizePct(sizePct) };

  if (explicitTop || userClearsBottom) {
    out.top = limpiarPct(r.top, def.top || '2%');
  } else if (explicitBottom || userClearsTop) {
    out.bottom = limpiarPct(r.bottom, def.bottom || '2.5%');
  } else if (fillDefaults) {
    if (def.top) out.top = def.top;
    else if (def.bottom) out.bottom = def.bottom || '2.5%';
  }

  if (explicitLeft) {
    out.left = limpiarPct(r.left, def.left || '2.5%');
  } else if (explicitRight) {
    out.right = limpiarPct(r.right, def.right || '2.5%');
  } else if (fillDefaults) {
    if (def.left) out.left = def.left;
    else if (def.right) out.right = def.right;
  }

  return out;
}

function buildQrEstilo(qr, orientacion) {
  const sizePct = qr.sizePct ?? QR_DEFAULT_SIZE_PCT;
  const dims = qrCssWidth(sizePct, orientacion);
  const parts = [
    'position:absolute',
    'z-index:4',
    'background:#fff',
    'padding:3px',
    'border-radius:4px',
    'box-sizing:border-box',
    `width:${dims.mm}`,
    `width:${dims.cqw}`,
    'aspect-ratio:1',
    'height:auto',
  ];
  if (qr.top) parts.push(`top:${qr.top}`, 'bottom:auto');
  if (qr.bottom) parts.push(`bottom:${qr.bottom}`, 'top:auto');
  if (qr.left) parts.push(`left:${qr.left}`, 'right:auto');
  if (qr.right) parts.push(`right:${qr.right}`, 'left:auto');
  return { css: parts.join(';'), rasterPx: qrRasterPx(sizePct, orientacion), sizePct: dims.pct };
}

function resolverQr(config, tipo, orientacion) {
  const ori = orientacion === 'horizontal' ? 'horizontal' : 'vertical';
  const tipoKey = TIPOS_VALIDOS.includes(tipo) ? tipo : 'curso';
  const guardado = config?.layoutPorTipo?.[tipoKey]?.[ori]?.qr;
  const norm = normalizeQr(guardado, ori, config);
  return buildQrEstilo(norm, ori);
}

const CAMPOS_STORAGE_KEYS = [
  'visible',
  'top',
  'left',
  'right',
  'bottom',
  'w',
  'align',
  'fs',
  'fw',
  'ls',
  'fontFamily',
  'color',
];

function campoToStorage(c) {
  if (!c || typeof c !== 'object') return null;
  if (c.visible === false) return { visible: false };
  const out = { visible: true };
  for (const k of CAMPOS_STORAGE_KEYS) {
    if (k === 'visible') continue;
    if (c[k] != null && String(c[k]).trim() !== '') out[k] = c[k];
  }
  return out;
}

function slotToStorage(val, orientacion) {
  const norm = normalizeLayoutOrientacion(val, orientacion);
  const campos = {};
  for (const id of CAMPOS_IDS) {
    const stored = campoToStorage(norm[id]);
    if (stored) campos[id] = stored;
  }
  const slot = { color: norm.color, campos };
  if (val?.qr && typeof val.qr === 'object') {
    slot.qr = normalizeQr(val.qr, orientacion, null, { fillDefaults: false });
  }
  return slot;
}

/** Conserva layouts de otros tipos/orientaciones al guardar solo una sección. */
function mergeLayoutPorTipoDeep(prev, incoming) {
  const out = prev && typeof prev === 'object' ? { ...prev } : {};
  if (!incoming || typeof incoming !== 'object') return out;
  for (const [tipo, val] of Object.entries(incoming)) {
    if (!TIPOS_VALIDOS.includes(tipo) || !val || typeof val !== 'object') continue;
    out[tipo] = { ...(out[tipo] || {}) };
    for (const ori of ORIENTACIONES) {
      if (val[ori] && typeof val[ori] === 'object') {
        out[tipo][ori] = val[ori];
      }
    }
  }
  return out;
}

function normalizeLayoutPorTipo(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [tipo, val] of Object.entries(raw)) {
    if (!TIPOS_VALIDOS.includes(tipo) || !val || typeof val !== 'object') continue;
    for (const ori of ORIENTACIONES) {
      if (!val[ori] || typeof val[ori] !== 'object') continue;
      const slot = slotToStorage(val[ori], ori);
      const hasData =
        slot.color ||
        (slot.campos && Object.keys(slot.campos).length > 0) ||
        slot.qr;
      if (!hasData) continue;
      if (!out[tipo]) out[tipo] = {};
      out[tipo][ori] = slot;
    }
  }
  return out;
}

/** Layout listo para render (mezcla guardado + defaults) */
function resolverLayout(config, tipo, orientacion) {
  const ori = orientacion === 'horizontal' ? 'horizontal' : 'vertical';
  const base = DEFAULTS_ORIENTACION[ori];
  const tipoKey = TIPOS_VALIDOS.includes(tipo) ? tipo : 'curso';
  const guardado = config?.layoutPorTipo?.[tipoKey]?.[ori];
  return normalizeLayoutOrientacion(guardado, ori);
}

function layoutDefaultsApi() {
  return {
    campos: require('../constants/certificadoLayoutDefaults').CAMPOS_LABEL,
    vertical: DEFAULTS_ORIENTACION.vertical,
    horizontal: DEFAULTS_ORIENTACION.horizontal,
    qr: {
      vertical: QR_PRESETS.vertical,
      horizontal: QR_PRESETS.horizontal,
      defaultSizePct: QR_DEFAULT_SIZE_PCT,
      sizePctMin: QR_SIZE_PCT_MIN,
      sizePctMax: QR_SIZE_PCT_MAX,
    },
  };
}

module.exports = {
  CAMPOS_IDS,
  normalizeLayoutPorTipo,
  mergeLayoutPorTipoDeep,
  normalizeQr,
  resolverLayout,
  resolverQr,
  layoutDefaultsApi,
};
