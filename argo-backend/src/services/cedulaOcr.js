const sharp = require('sharp');
const { createWorker } = require('tesseract.js');
const { NUM_DOC_MIN_DIGITS, NUM_DOC_MAX_DIGITS, isValidNumDocDigits } = require('../utils/numDoc');

const SPLIT_RATIO = 0.5;
const MIN_RESPALDO_CHARS = 12;

/** Encabezado institucional (no confundir con etiquetas de campo en la zona de datos) */
const ENCABEZADO_RE =
  /\b(REPUBLICA|COLOMBIA|IDENTIFICACION PERSONAL|CEDULA DE CIUDADANIA|CEDULA DE CIUDADAN|REGISTRADOR|NACIONAL|MINISTERIO|INDICE|DERECHO|COLOMBIANA)\b/i;

const MESES = {
  ENE: '01', FEB: '02', MAR: '03', ABR: '04', MAY: '05', JUN: '06',
  JUL: '07', AGO: '08', SEP: '09', OCT: '10', NOV: '11', DIC: '12',
};

/** Palabras del encabezado / institucionales — nunca son nombres propios */
const PALABRA_INSTITUCIONAL = new Set([
  'REPUBLICA', 'COLOMBIA', 'IDENTIFICACION', 'PERSONAL', 'CEDULA', 'CIUDADANIA',
  'CIUDADAN', 'NUIP', 'NUMERO', 'REGISTRADOR', 'NACIONAL', 'MINISTERIO', 'DEFENSA',
  'INDICE', 'DERECHO', 'COLOMBIANA', 'REGISTRO', 'CIVIL', 'ESTADO', 'FIRMA',
  'DE', 'LA', 'EL', 'Y', 'DEL', 'LOS', 'LAS',
]);

function limpiarLineas(texto) {
  return String(texto || '')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function normalizarTexto(t) {
  return String(t || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s./+-:]/g, ' ');
}

function soloDigitos(s) {
  return String(s || '').replace(/\D/g, '');
}

function capitalizar(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Nombres y apellidos en mayúsculas (como en la cédula) */
function aMayusculas(s) {
  return String(s || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

async function dividirVertical(buffer) {
  const img = sharp(buffer);
  const meta = await img.metadata();
  const h = meta.height || 0;
  const w = meta.width || 0;
  if (h < 80 || w < 80) {
    const err = new Error('La imagen es demasiado pequeña. Use una foto más grande.');
    err.status = 400;
    throw err;
  }
  const corte = Math.round(h * SPLIT_RATIO);
  const frente = await img.clone().extract({ left: 0, top: 0, width: w, height: corte }).png().toBuffer();
  const respaldo =
    corte < h
      ? await img.clone().extract({ left: 0, top: corte, width: w, height: h - corte }).png().toBuffer()
      : null;
  return { frente, respaldo, altoTotal: h, corte, modo: 'vertical' };
}

async function dividirHorizontal(buffer) {
  const img = sharp(buffer);
  const meta = await img.metadata();
  const h = meta.height || 0;
  const w = meta.width || 0;
  if (h < 80 || w < 80) {
    const err = new Error('La imagen es demasiado pequeña. Use una foto más grande.');
    err.status = 400;
    throw err;
  }
  const corte = Math.round(w * SPLIT_RATIO);
  const frente = await img.clone().extract({ left: 0, top: 0, width: corte, height: h }).png().toBuffer();
  const respaldo =
    corte < w
      ? await img.clone().extract({ left: corte, top: 0, width: w - corte, height: h }).png().toBuffer()
      : null;
  return { frente, respaldo, anchoTotal: w, corte, modo: 'horizontal' };
}

/** vertical | horizontal | auto (por proporción de la imagen). */
async function dividirImagen(buffer, disposicion = 'auto') {
  const meta = await sharp(buffer).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (disposicion === 'vertical') return dividirVertical(buffer);
  if (disposicion === 'horizontal') return dividirHorizontal(buffer);
  if (w > h * 1.08) return dividirHorizontal(buffer);
  return dividirVertical(buffer);
}

async function ocrSoloFrente(frenteBuffer) {
  const frentePrep = await prepararParaOcr(frenteBuffer);
  const zonaNombres = await recortarZonaNombres(frentePrep);

  const [textoFrente, textoZonaNombres] = await Promise.all([
    ocrBuffer(frentePrep),
    ocrBuffer(zonaNombres),
  ]);

  const datosFrente = parseFrente(textoFrente, textoZonaNombres);
  return { datosFrente, textoFrente, textoZonaNombres };
}

async function validarImagenFrente(buffer) {
  const meta = await sharp(buffer).metadata();
  const h = meta.height || 0;
  const w = meta.width || 0;
  if (h < 80 || w < 80) {
    const err = new Error('La imagen es demasiado pequeña. Fotografíe solo el frente de la cédula.');
    err.status = 400;
    throw err;
  }
}

/** Mejora contraste para originales y fotocopias ampliadas (escaneos de celular). */
async function prepararParaOcr(buffer) {
  const meta = await sharp(buffer).metadata();
  const w = meta.width || 0;
  const minW = 1400;
  let pipe = sharp(buffer);
  if (w > 0 && w < minW) {
    pipe = pipe.resize(minW, null, { withoutEnlargement: false, kernel: 'lanczos3' });
  }
  return pipe
    .grayscale()
    .normalize()
    .linear(1.18, -(128 * 0.14))
    .sharpen({ sigma: 1.1 })
    .png()
    .toBuffer();
}

async function recortarZonaNombres(frenteBuffer) {
  const meta = await sharp(frenteBuffer).metadata();
  const h = meta.height || 0;
  const w = meta.width || 0;
  if (h < 120 || w < 80) return frenteBuffer;
  const top = Math.round(h * 0.38);
  const height = h - top;
  if (height < 60) return frenteBuffer;
  return sharp(frenteBuffer)
    .extract({ left: 0, top, width: w, height })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
}

let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('spa', 1, { logger: () => {} });
      return worker;
    })();
  }
  return workerPromise;
}

async function ocrBuffer(buffer) {
  const worker = await getWorker();
  const {
    data: { text },
  } = await worker.recognize(buffer);
  return text || '';
}

function contieneTextoInstitucional(linea) {
  const u = normalizarTexto(linea);
  if (!u) return true;
  if (ENCABEZADO_RE.test(u)) return true;
  if (/^IDENTIFICACION\s*PERSONAL$/.test(u)) return true;
  if (/^CEDULA\s*(DE\s*)?CIUDADAN/.test(u)) return true;
  if (/\b(CEDULA|CIUDADANIA|CIUDADAN|REPUBLICA|COLOMBIA|IDENTIFICACION|PERSONAL|NUMERO|NUIP)\b/.test(u)) {
    return true;
  }
  const tokens = u.split(/\s+/).filter(Boolean);
  if (tokens.some((t) => PALABRA_INSTITUCIONAL.has(t))) return true;
  return false;
}

function esLineaEncabezado(linea) {
  const u = normalizarTexto(linea);
  if (!u || u.length < 3) return true;
  if (/\d{1,3}(\.\d{3}){2,3}/.test(linea)) return false;
  return contieneTextoInstitucional(linea);
}

function esEtiquetaApellidos(linea) {
  const u = normalizarTexto(linea).trim();
  return u.length <= 16 && /^APELLIDOS?$/.test(u);
}

function esEtiquetaNombres(linea) {
  const u = normalizarTexto(linea).trim();
  return u.length <= 14 && /^NOMBRES?$/.test(u) && !/APELLID/.test(u);
}

function esLineaNombre(linea, numDoc) {
  if (!linea || contieneTextoInstitucional(linea)) return false;
  const t = linea.trim();
  if (t.length < 3) return false;
  if (esEtiquetaApellidos(t) || esEtiquetaNombres(t)) return false;
  const digits = soloDigitos(t);
  if (numDoc && digits === numDoc) return false;
  if (digits.length >= 5) return false;
  const palabras = t.split(/\s+/).filter(Boolean);
  if (!palabras.length || palabras.length > 6) return false;
  const validas = palabras.filter((p) => {
    const w = normalizarTexto(p);
    return w.length >= 2 && !PALABRA_INSTITUCIONAL.has(w);
  });
  if (!validas.length) return false;
  if (validas.length / palabras.length < 0.6) return false;
  const letras = (t.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/g) || []).length;
  return letras >= 3 && letras / t.replace(/\s/g, '').length >= 0.7;
}

/** Etiqueta pequeña impresa debajo del valor (cédula colombiana) */
function esEtiquetaSola(linea, patron) {
  const u = normalizarTexto(linea).trim();
  return new RegExp(`^${patron}$`, 'i').test(u);
}

function valorDespuesEtiqueta(linea, etiquetaRegex) {
  const m = linea.match(new RegExp(`${etiquetaRegex}\\s*[:.]?\\s*(.+)$`, 'i'));
  return m ? m[1].trim() : '';
}

function indiceLineaNumDoc(lineas, numDoc) {
  if (!numDoc) return -1;
  for (let i = 0; i < lineas.length; i++) {
    const digits = soloDigitos(lineas[i]);
    if (digits === numDoc) return i;
    if (lineas[i].replace(/\D/g, '').includes(numDoc)) return i;
  }
  return -1;
}

function extraerNumDocDigitos(texto, lineas) {
  const flat = normalizarTexto(texto);

  const numeroEtiqueta = texto.match(/NUMERO\s+([\d.\s]{8,22})/i);
  if (numeroEtiqueta) {
    const n = soloDigitos(numeroEtiqueta[1]);
    if (isValidNumDocDigits(n)) return n;
  }

  const conPuntos = texto.match(/\b(\d{1,3}(?:\.\d{3}){2,3})\b/g);
  if (conPuntos?.length) {
    const ordenados = conPuntos
      .map((s) => soloDigitos(s))
      .filter((n) => isValidNumDocDigits(n))
      .sort((a, b) => b.length - a.length);
    if (ordenados[0]) return ordenados[0];
  }

  const nuip = flat.match(/NUIP\s*[:.]?\s*([\d.\s]{6,18})/);
  if (nuip) {
    const n = soloDigitos(nuip[1]);
    if (isValidNumDocDigits(n)) return n;
  }

  const nums = flat.match(new RegExp(`\\d{${NUM_DOC_MIN_DIGITS},${NUM_DOC_MAX_DIGITS}}`, 'g')) || [];
  if (nums.length) {
    return nums.sort((a, b) => b.length - a.length)[0];
  }
  for (const l of lineas) {
    const n = soloDigitos(l);
    if (isValidNumDocDigits(n)) return n;
  }
  return '';
}

function asignarNombrePartes(destino, texto) {
  const palabras = String(texto || '')
    .trim()
    .split(/\s+/)
    .filter((p) => {
      const w = normalizarTexto(p);
      return w.length >= 2 && !PALABRA_INSTITUCIONAL.has(w);
    });
  if (!palabras.length) return;
  destino.parte1 = palabras[0];
  destino.parte2 = palabras.slice(1).join(' ');
}

function indiceEtiqueta(lineas, tipo) {
  for (let i = 0; i < lineas.length; i++) {
    if (tipo === 'apellidos' && esEtiquetaApellidos(lineas[i])) return i;
    if (tipo === 'nombres' && esEtiquetaNombres(lineas[i])) return i;
  }
  return -1;
}

/**
 * Layout cédula colombiana (lectura de arriba hacia abajo):
 *   [dato apellidos]  ← valor
 *   APELLIDOS         ← etiqueta pequeña DEBAJO del dato
 *   [dato nombres]    ← valor
 *   NOMBRES           ← etiqueta pequeña DEBAJO del dato
 * Solo se lee la línea INMEDIATAMENTE ENCIMA de cada etiqueta (nunca la de abajo).
 */
function valorEncimaEtiqueta(lineas, idxEtiqueta, numDoc, excluirLinea = '', idxMin = 0) {
  if (idxEtiqueta < 0) return '';

  const lineaEtiqueta = lineas[idxEtiqueta] || '';
  const enMismaLinea = lineaEtiqueta.match(/^(.+?)\s+(APELLIDOS?|NOMBRES?)\s*$/i);
  if (enMismaLinea) {
    const val = enMismaLinea[1].trim();
    if (normalizarTexto(val) !== normalizarTexto(excluirLinea) && esLineaNombre(val, numDoc)) {
      return val;
    }
  }

  for (let j = idxEtiqueta - 1; j >= idxMin; j--) {
    const l = lineas[j];
    if (esEtiquetaApellidos(l) || esEtiquetaNombres(l)) break;
    if (excluirLinea && normalizarTexto(l) === normalizarTexto(excluirLinea)) continue;
    if (esLineaNombre(l, numDoc)) return l;
  }
  return '';
}

/**
 * Apellidos y nombres solo después del NUMERO.
 * Cada valor es la línea encima de su etiqueta (APELLIDOS / NOMBRES).
 */
function parseNombres(lineasZona, numDoc, lineasCompletas) {
  let apellido1 = '';
  let apellido2 = '';
  let nombre1 = '';
  let nombre2 = '';

  const idxDoc = indiceLineaNumDoc(lineasCompletas, numDoc);
  const zonaDesdeDoc = idxDoc >= 0 ? lineasCompletas.slice(idxDoc + 1) : [];
  const lineasZonaFiltradas = lineasZona.filter((l) => !contieneTextoInstitucional(l) || esEtiquetaApellidos(l) || esEtiquetaNombres(l));

  const opciones = [zonaDesdeDoc, lineasZonaFiltradas].filter((l) => l.length > 0);
  let lineasTrabajo = opciones[0] || [];
  for (const opt of opciones) {
    if (indiceEtiqueta(opt, 'apellidos') >= 0 && indiceEtiqueta(opt, 'nombres') >= 0) {
      lineasTrabajo = opt;
      break;
    }
  }
  if (indiceEtiqueta(lineasTrabajo, 'apellidos') < 0 && lineasZonaFiltradas.length) {
    lineasTrabajo = lineasZonaFiltradas;
  }

  const tomarValor = (val) => {
    if (!val || !esLineaNombre(val, numDoc)) return null;
    const p = { parte1: '', parte2: '' };
    asignarNombrePartes(p, val);
    if (!p.parte1 || contieneTextoInstitucional(p.parte1)) return null;
    if (p.parte2 && contieneTextoInstitucional(p.parte2)) p.parte2 = '';
    return p;
  };

  const idxAp = indiceEtiqueta(lineasTrabajo, 'apellidos');
  const idxNom = indiceEtiqueta(lineasTrabajo, 'nombres');

  const idxMin = 0;

  if (idxAp >= 0) {
    const lineaAp = valorEncimaEtiqueta(lineasTrabajo, idxAp, numDoc, '', idxMin);
    const p = tomarValor(lineaAp);
    if (p) {
      apellido1 = p.parte1;
      apellido2 = p.parte2;
    }
  }

  if (idxNom >= 0 && (idxAp < 0 || idxNom > idxAp)) {
    const lineaApCompleta = `${apellido1} ${apellido2}`.trim();
    const lineaNom = valorEncimaEtiqueta(lineasTrabajo, idxNom, numDoc, lineaApCompleta, idxMin);
    const p = tomarValor(lineaNom);
    if (p) {
      nombre1 = p.parte1;
      nombre2 = p.parte2;
    }
  }

  if ((!apellido1 || !nombre1) && idxAp < 0 && idxNom < 0) {
    const candidatos = lineasTrabajo.filter((l) => esLineaNombre(l, numDoc));
    if (!apellido1 && candidatos[0]) {
      const p = tomarValor(candidatos[0]);
      if (p) {
        apellido1 = p.parte1;
        apellido2 = p.parte2;
      }
    }
    if (!nombre1 && candidatos[1] && normalizarTexto(candidatos[1]) !== normalizarTexto(`${apellido1} ${apellido2}`.trim())) {
      const p = tomarValor(candidatos[1]);
      if (p) {
        nombre1 = p.parte1;
        nombre2 = p.parte2;
      }
    }
  }

  return {
    apellido1: aMayusculas(apellido1),
    apellido2: aMayusculas(apellido2),
    nombre1: aMayusculas(nombre1),
    nombre2: aMayusculas(nombre2),
  };
}

function parseFechaIso(lineas, texto) {
  const re = /(\d{1,2})[/. -](\d{1,2})[/. -](\d{2,4})/g;
  let m;
  const t = `${lineas.join(' ')} ${texto}`;
  while ((m = re.exec(t)) !== null) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    if (y > 1900 && y < 2100) {
      const mm = String(m[2]).padStart(2, '0');
      const dd = String(m[1]).padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    }
  }
  return '';
}

function parseFrente(textoCompleto, textoZonaNombres) {
  const lineasCompletas = limpiarLineas(textoCompleto);
  const lineasZona = limpiarLineas(textoZonaNombres);
  const numDocStr = extraerNumDocDigitos(textoCompleto, lineasCompletas);
  const nombres = parseNombres(lineasZona, numDocStr, lineasCompletas);
  const fechaNac = parseFechaIso(lineasCompletas, textoCompleto);

  let expedida = '';
  const norm = normalizarTexto(textoCompleto);
  const expMatch = norm.match(/EXPEDIC[A-Z]*\s+EN\s+([A-Z\s]{3,40})/);
  if (expMatch) expedida = expMatch[1].trim().slice(0, 80);

  const { parseNumDoc: toNumDoc } = require('../utils/numDoc');
  const numDoc = toNumDoc(numDocStr) ?? undefined;
  return {
    tipoDoc: '1',
    numDoc,
    expedida,
    ...nombres,
    fechaNac,
  };
}

function esEtiquetaGsRh(linea) {
  const u = normalizarTexto(linea).trim();
  return /G\.?\s*S\.?\s*RH/.test(u) && u.length <= 24;
}

function esEtiquetaSexo(linea) {
  const u = normalizarTexto(linea).trim();
  return u === 'SEXO' || /^SEXO\s*\.?$/.test(u);
}

function esEtiquetaExpedicion(linea) {
  const u = normalizarTexto(linea);
  return /FECHA\s+Y\s+LUGAR\s+DE\s+EXPEDIC/.test(u);
}

function indiceLineaPorEtiqueta(lineas, testEtiqueta) {
  for (let i = 0; i < lineas.length; i++) {
    if (testEtiqueta(lineas[i])) return i;
  }
  return -1;
}

/** Dato en la línea inmediatamente ENCIMA de la etiqueta (layout respaldo cédula CO) */
function datoEncimaEtiqueta(lineas, idxEtiqueta) {
  if (idxEtiqueta <= 0) return '';

  const lineaEtiqueta = lineas[idxEtiqueta] || '';

  if (esEtiquetaGsRh(lineaEtiqueta)) {
    const enLinea = lineaEtiqueta.match(/^(.+?)\s+G\.?\s*S\.?\s*RH/i);
    if (enLinea) return enLinea[1].trim();
  }
  if (esEtiquetaSexo(lineaEtiqueta)) {
    const enLinea = lineaEtiqueta.match(/^(.+?)\s+SEXO\s*$/i);
    if (enLinea) return enLinea[1].trim();
  }
  if (esEtiquetaExpedicion(lineaEtiqueta)) {
    const enLinea = lineaEtiqueta.match(/^(.+?)\s+FECHA\s+Y\s+LUGAR/i);
    if (enLinea) return enLinea[1].trim();
  }

  return lineas[idxEtiqueta - 1] || '';
}

function parseGeneroDesdeLinea(linea) {
  if (!linea) return '';
  const t = normalizarTexto(linea).trim();
  if (t === 'M' || t === 'F') return t;
  if (t.startsWith('MASC')) return 'M';
  if (t.startsWith('FEM')) return 'F';
  const m = t.match(/\b(M|F)\b/);
  return m ? m[1] : '';
}

function parseTipoSangreDesdeLinea(linea) {
  if (!linea) return '';
  const compact = String(linea).match(/\b(AB|A|B|O)\s*([+-])/i);
  if (compact) return `${compact[1].toUpperCase()}${compact[2]}`;
  const t = normalizarTexto(linea);
  if (/\bPOSITIVO\b/.test(t) && /\b(AB|A|B|O)\b/.test(t)) {
    const tipo = t.match(/\b(AB|A|B|O)\b/);
    return tipo ? `${tipo[1]}+` : '';
  }
  if (/\bNEGATIVO\b/.test(t) && /\b(AB|A|B|O)\b/.test(t)) {
    const tipo = t.match(/\b(AB|A|B|O)\b/);
    return tipo ? `${tipo[1]}-` : '';
  }
  return '';
}

const MESES_TEXTO = /\b(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC|ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\b/gi;

function quitarFechasDeLinea(linea) {
  return String(linea || '')
    .replace(/\d{1,2}[-\s/][A-ZÁÉÍÓÚÑ]{3,}[-\s/]\d{2,4}/gi, ' ')
    .replace(/\d{1,2}[/. -]\d{1,2}[/. -]\d{2,4}/g, ' ')
    .replace(/\b\d{1,2}\s*(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\w*\s*\d{2,4}\b/gi, ' ')
    .replace(MESES_TEXTO, ' ')
    .replace(/\b\d{1,4}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extraerCiudadExpedicion(linea) {
  if (!linea) return '';
  const sinFecha = quitarFechasDeLinea(linea);
  if (!sinFecha) return '';

  const palabras = sinFecha.split(/\s+/).filter((p) => {
    const w = normalizarTexto(p);
    if (w.length < 3) return false;
    if (PALABRA_INSTITUCIONAL.has(w)) return false;
    if (MESES[w.slice(0, 3)]) return false;
    return /^[A-Za-zÁÉÍÓÚÑ]/.test(p);
  });

  if (!palabras.length) return '';

  const ciudad = palabras.filter((p) => {
    const u = normalizarTexto(p);
    return u.length >= 4 && !/^(DE|LA|EL|Y|EN)$/.test(u);
  });

  const usar = ciudad.length ? ciudad : palabras;
  return capitalizar(usar.join(' ').slice(0, 80));
}

/**
 * Respaldo cédula CO — dato ARRIBA, etiqueta ABAJO:
 *   O+  →  G.S. RH
 *   M   →  SEXO
 *   fecha + ciudad  →  FECHA Y LUGAR DE EXPEDICION (solo ciudad, sin fecha)
 */
function parseGenero(texto, lineas) {
  const lineasLimpias = lineas || limpiarLineas(texto);
  const idx = indiceLineaPorEtiqueta(lineasLimpias, esEtiquetaSexo);
  if (idx >= 0) {
    const g = parseGeneroDesdeLinea(datoEncimaEtiqueta(lineasLimpias, idx));
    if (g) return g;
  }
  return '';
}

function parseTipoSangre(texto, lineas) {
  const lineasLimpias = lineas || limpiarLineas(texto);
  const idx = indiceLineaPorEtiqueta(lineasLimpias, esEtiquetaGsRh);
  if (idx >= 0) {
    const ts = parseTipoSangreDesdeLinea(datoEncimaEtiqueta(lineasLimpias, idx));
    if (ts) return ts;
  }
  return '';
}

function parseExpedicion(texto, lineas) {
  const lineasLimpias = lineas || limpiarLineas(texto);
  const idx = indiceLineaPorEtiqueta(lineasLimpias, esEtiquetaExpedicion);
  if (idx >= 0) {
    for (let j = idx - 1; j >= 0 && j >= idx - 3; j--) {
      const ciudad = extraerCiudadExpedicion(lineasLimpias[j]);
      if (ciudad) return ciudad;
    }
    const encima = datoEncimaEtiqueta(lineasLimpias, idx);
    const ciudad = extraerCiudadExpedicion(encima);
    if (ciudad) return ciudad;
  }
  return '';
}

function parseRespaldo(texto) {
  if (!texto || normalizarTexto(texto).replace(/\s/g, '').length < MIN_RESPALDO_CHARS) {
    return { genero: '', tipoSangre: '', expedida: '', detectado: false };
  }
  const lineas = limpiarLineas(texto);
  return {
    genero: parseGenero(texto, lineas),
    tipoSangre: parseTipoSangre(texto, lineas),
    expedida: parseExpedicion(texto, lineas),
    detectado: true,
  };
}

/** Solo frente: documento, nombres, apellidos y fecha de nacimiento. */
async function procesarCedulaImagen(buffer) {
  await validarImagenFrente(buffer);
  const { datosFrente, textoFrente, textoZonaNombres } = await ocrSoloFrente(buffer);

  const advertencias = [];
  if (!datosFrente.numDoc) advertencias.push('No se detectó el número de documento (campo NUMERO).');
  if (!datosFrente.apellido1) advertencias.push('No se detectaron apellidos (línea sobre la etiqueta APELLIDOS).');
  if (!datosFrente.nombre1) advertencias.push('No se detectaron nombres (línea sobre la etiqueta NOMBRES).');
  advertencias.push('Género, tipo de sangre, expedición y demás datos debe digitirlos manualmente.');

  return {
    sugerido: {
      tipoDoc: datosFrente.tipoDoc,
      numDoc: datosFrente.numDoc,
      apellido1: datosFrente.apellido1,
      apellido2: datosFrente.apellido2,
      nombre1: datosFrente.nombre1,
      nombre2: datosFrente.nombre2,
      fechaNac: datosFrente.fechaNac,
    },
    meta: {
      soloFrente: true,
      advertencias,
    },
    debug: {
      textoFrente: textoFrente.slice(0, 2000),
      textoZonaNombres: textoZonaNombres.slice(0, 1500),
    },
  };
}

module.exports = {
  procesarCedulaImagen,
  dividirVertical,
  dividirHorizontal,
  parseFrente,
  parseRespaldo,
};
