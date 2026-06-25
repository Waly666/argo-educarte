const { models } = require('../models/catalogos');
const { regexSinTildes } = require('../utils/regexSinTildes');
const { GEOREF_PROVEEDOR_HERE } = require('../constants/georefProveedor');
const { obtenerConfigGeorefInterno } = require('./configGeoref');

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const HERE_REVGEOCODE_URL = 'https://revgeocode.search.hereapi.com/v1/revgeocode';
const USER_AGENT = 'ARGO-Georef/1.0 (capacitacion georef)';

function limpiarNombre(v) {
  return String(v || '')
    .replace(/\s*(Distrito|Metropolitan|Metropolitana|Department|Departamento|de Colombia)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nombresMunicipioCandidatos(address) {
  const keys = ['city', 'town', 'municipality', 'village', 'county', 'district', 'suburb'];
  const out = [];
  for (const k of keys) {
    const n = limpiarNombre(address[k]);
    if (n && !out.some((x) => x.toLowerCase() === n.toLowerCase())) out.push(n);
  }
  return out;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 8000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error(`Tiempo agotado consultando ${options.proveedor || 'mapa'}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchNominatim(lat, lng) {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'es');
  url.searchParams.set('zoom', '14');

  const data = await fetchJson(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    proveedor: 'Nominatim',
  });
  return {
    address: data?.address || {},
    proveedor: 'nominatim',
  };
}

async function fetchHere(lat, lng, apiKey) {
  const url = new URL(HERE_REVGEOCODE_URL);
  url.searchParams.set('at', `${lat},${lng}`);
  url.searchParams.set('lang', 'es');
  url.searchParams.set('apiKey', apiKey);

  const data = await fetchJson(url.toString(), {
    headers: { Accept: 'application/json' },
    proveedor: 'HERE',
  });
  const item = data?.items?.[0];
  const addr = item?.address || {};
  return {
    address: {
      state: addr.state || '',
      region: addr.stateCode || '',
      city: addr.city || '',
      town: addr.district || '',
      municipality: addr.county || '',
      county: addr.county || '',
      district: addr.district || '',
      street: addr.street || '',
      label: addr.label || item?.title || '',
    },
    proveedor: 'here',
    label: addr.label || item?.title || '',
  };
}

async function reverseGeocode(lat, lng, config) {
  const prov = config?.proveedor || 'nominatim';
  if (prov === GEOREF_PROVEEDOR_HERE) {
    const key = String(config?.hereApiKey || '').trim();
    if (!key) {
      const err = new Error('Configure la API key de HERE en Configuración → Geocodificación');
      err.status = 503;
      throw err;
    }
    return fetchHere(lat, lng, key);
  }
  return fetchNominatim(lat, lng);
}

async function buscarEnDivipola(nombreMuni, nombreDepto) {
  const reMuni = regexSinTildes(limpiarNombre(nombreMuni));
  const rows = await models.divipola.find({ nombreMunicipio: reMuni }).lean();
  if (!rows.length) return null;
  if (rows.length === 1) return rows[0];

  const depto = limpiarNombre(nombreDepto);
  if (depto) {
    const reDepto = regexSinTildes(depto);
    const filtered = rows.filter((r) => reDepto.test(r.nombreDepto));
    if (filtered.length === 1) return filtered[0];
    if (filtered.length > 1) return filtered[0];
  }
  return rows[0];
}

/**
 * Resuelve municipio y departamento (Divipola) a partir de lat/lng.
 * Proveedor configurable: Nominatim (OSM) o HERE.
 */
async function municipioPorCoords(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) {
    const err = new Error('Coordenadas inválidas');
    err.status = 400;
    throw err;
  }
  if (la < -90 || la > 90 || ln < -180 || ln > 180) {
    const err = new Error('Coordenadas fuera de rango');
    err.status = 400;
    throw err;
  }

  const config = await obtenerConfigGeorefInterno();
  let geo;
  try {
    geo = await reverseGeocode(la, ln, config);
  } catch (e) {
    if (config.proveedor === GEOREF_PROVEEDOR_HERE) {
      console.warn('[georef] HERE falló, usando Nominatim:', e.message);
      geo = await fetchNominatim(la, ln);
    } else {
      throw e;
    }
  }

  const address = geo?.address || {};
  const deptoGeo = limpiarNombre(address.state || address.region || '');
  const candidatos = nombresMunicipioCandidatos(address);

  for (const nombre of candidatos) {
    const row = await buscarEnDivipola(nombre, deptoGeo);
    if (row) {
      return {
        municipio: row.nombreMunicipio,
        depto: row.nombreDepto,
        codMunicipio: row.codMunicipio,
        fuente: 'divipola',
        proveedor: geo.proveedor,
        etiquetaMapa: geo.label || address.label || null,
      };
    }
  }

  return {
    municipio: candidatos[0] || '',
    depto: deptoGeo,
    codMunicipio: null,
    fuente: candidatos.length ? geo.proveedor : 'desconocido',
    proveedor: geo.proveedor,
    etiquetaMapa: geo.label || address.label || null,
  };
}

module.exports = { municipioPorCoords, reverseGeocode };
