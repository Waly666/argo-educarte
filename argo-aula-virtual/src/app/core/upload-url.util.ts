import { environment } from '../../environments/environment';

/** Normaliza rutas /uploads/… a URL servible por el portal (mismo origen + proxy/nginx). */
export function resolveUploadUrl(raw?: string | null): string | null {
  const r = String(raw || '').trim();
  if (!r) return null;

  const uploadsPath = extractUploadsPath(r);
  if (!uploadsPath) {
    if (/^https?:\/\//i.test(r)) return r;
    return null;
  }

  const base = environment.uploadsUrl.replace(/\/+$/, '');
  if (!base || base.startsWith('/')) {
    return `${base}/${uploadsPath}`.replace(/\/+/g, '/');
  }
  return `${base}/${uploadsPath}`;
}

/** Devuelve la ruta relativa /uploads/… para iframe y assets del curso. */
export function resolveUploadsPath(raw?: string | null): string | null {
  const uploadsPath = extractUploadsPath(String(raw || '').trim());
  if (!uploadsPath) return null;
  return `/uploads/${uploadsPath}`.replace(/\/+/g, '/');
}

function extractUploadsPath(raw: string): string | null {
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    const m = raw.match(/\/uploads\/(.+)$/i);
    return m ? m[1] : null;
  }

  if (raw.startsWith('/uploads/')) {
    return raw.slice('/uploads/'.length);
  }

  if (raw.startsWith('uploads/')) {
    return raw.slice('uploads/'.length);
  }

  return raw.replace(/^\/+/, '') || null;
}

/** Evita caché del navegador/CDN cuando se reemplaza un archivo en /uploads/ con el mismo nombre. */
export function withUploadCacheBust(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/(\d{10,})_/);
  const token = m?.[1];
  if (!token) return url;
  return url.includes('?') ? url : `${url}?v=${token}`;
}
