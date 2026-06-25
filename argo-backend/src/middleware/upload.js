const fs = require('fs');
const path = require('path');
const multer = require('multer');

const BASE = path.join(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function formatTsInicio(d) {
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}_${pad(x.getHours())}${pad(x.getMinutes())}${pad(x.getSeconds())}`;
}

const ZIP_MAX_MB = Math.min(
  500,
  Math.max(10, Number(process.env.AULA_VIRTUAL_ZIP_MAX_MB) || 200),
);

function build(subdir, maxMb = 10) {
  const dest = path.join(BASE, subdir);
  ensureDir(dest);
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
      const name = `${Date.now()}_${Math.round(Math.random() * 1e6)}_${safe}`;
      cb(null, name);
    },
  });
  return multer({ storage, limits: { fileSize: maxMb * 1024 * 1024 } });
}

/** Paquetes ZIP de cursos virtuales (HTML, imágenes, audio). */
function buildZip(subdir) {
  const dest = path.join(BASE, subdir);
  ensureDir(dest);
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
      const name = `${Date.now()}_${Math.round(Math.random() * 1e6)}_${safe}`;
      cb(null, name);
    },
  });
  return multer({
    storage,
    limits: { fileSize: ZIP_MAX_MB * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const mime = String(file.mimetype || '').toLowerCase();
      const okZip =
        ext === '.zip' ||
        mime === 'application/zip' ||
        mime === 'application/x-zip-compressed' ||
        mime === 'application/octet-stream';
      if (!okZip) {
        const err = new Error('Solo se permiten archivos .zip');
        err.status = 400;
        return cb(err);
      }
      cb(null, true);
    },
  });
}

/** Evidencia fotográfica: uploads/evidenciascap/{codContrato}/fotos/{idClase}_{YYYYMMDDHHmmss}.ext */
function buildEvidenciaCap() {
  const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
      const cod = req.evidenciaCapCodContrato || 'sin-contrato';
      const dest = path.join(BASE, 'evidenciascap', cod, 'fotos');
      ensureDir(dest);
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      const clase = req.claseEvidencia;
      const id = clase?._id ? String(clase._id) : 'clase';
      const ref = clase?.horaInicio || clase?.fechaClase || new Date();
      const ts = formatTsInicio(ref);
      let ext = path.extname(file.originalname || '').toLowerCase();
      if (!ext || ext.length > 6) ext = '.jpg';
      cb(null, `${id}_${ts}${ext}`);
    },
  });
  return multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype || !/^image\//i.test(file.mimetype)) {
        return cb(new Error('Solo se permiten imágenes'));
      }
      cb(null, true);
    },
  });
}

function buildImagen(subdir, maxMb = 5) {
  const dest = path.join(BASE, subdir);
  ensureDir(dest);
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
      cb(null, `${Date.now()}_${Math.round(Math.random() * 1e6)}_${safe}`);
    },
  });
  return multer({
    storage,
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype || !/^image\//i.test(file.mimetype)) {
        return cb(new Error('Solo se permiten imágenes (PNG, JPG, WEBP, etc.)'));
      }
      cb(null, true);
    },
  });
}

/** APK app móvil aula virtual (sección App Mobile del portal). */
function buildApk(subdir, maxMb = 150) {
  const dest = path.join(BASE, subdir);
  ensureDir(dest);
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureDir(dest);
      cb(null, dest);
    },
    filename: (_req, file, cb) => {
      const safe = String(file.originalname || 'aula-virtual.apk').replace(/[^\w.\-]+/g, '_');
      const name = safe.toLowerCase().endsWith('.apk') ? safe : `${safe}.apk`;
      cb(null, `${Date.now()}_${Math.round(Math.random() * 1e6)}_${name}`);
    },
  });
  return multer({
    storage,
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const mime = String(file.mimetype || '').toLowerCase();
      const ok =
        ext === '.apk' ||
        mime === 'application/vnd.android.package-archive' ||
        mime === 'application/octet-stream';
      if (!ok) {
        const err = new Error('Solo se permiten archivos .apk');
        err.status = 400;
        return cb(err);
      }
      cb(null, true);
    },
  });
}

const memory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

module.exports = {
  alumnos: build('alumnos'),
  vehiculos: build('vehiculos'),
  inspecciones: build('inspecciones'),
  certificados: build('certificados'),
  egresos: build('egresos'),
  ingresos: build('ingresos'),
  empleados: build('empleados'),
  programasVirtual: build('programas-virtual'),
  aulaVirtualMateriales: build('aula-virtual-materiales'),
  aulaVirtualZip: buildZip('aula-virtual-zip'),
  zipMaxMb: ZIP_MAX_MB,
  aulaVirtualLogo: buildImagen('aula-virtual-logo', 3),
  aulaVirtualHero: buildImagen('aula-virtual-hero', 8),
  aulaVirtualBlog: buildImagen('aula-virtual-blog', 8),
  aulaVirtualApk: buildApk('aula-virtual-apk', 150),
  evidenciasCap: buildEvidenciaCap(),
  memory,
  baseDir: BASE,
  formatTsInicio,
  publicUrl(subdir, filename) {
    return `${subdir}/${filename}`;
  },
  /** Ruta relativa anidada bajo uploads/ (ej. evidenciascap/COD/fotos/archivo.jpg). */
  publicUrlPath(...parts) {
    return parts.filter(Boolean).join('/');
  },
  resolvePath(relativeUrl) {
    if (!relativeUrl) return null;
    return path.join(BASE, String(relativeUrl).replace(/^\/+/, ''));
  },
};
