const fs = require('fs');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');

/**
 * Cifrado de respaldos en reposo (ISO/IEC 27001 — control 8.24).
 * Formato .argobk: MAGIC(8) + IV(12) + ciphertext + AUTHTAG(16).
 * Clave: variable de entorno BACKUP_CLAVE_CIFRADO (cualquier texto largo;
 * se deriva una clave AES-256 con SHA-256). Sin la variable, el respaldo
 * queda como ZIP sin cifrar.
 */

const MAGIC = Buffer.from('ARGOBK1\0', 'latin1');
const IV_LEN = 12;
const TAG_LEN = 16;

function claveCifradoConfigurada() {
  return !!String(process.env.BACKUP_CLAVE_CIFRADO || '').trim();
}

function derivarClave() {
  const secreto = String(process.env.BACKUP_CLAVE_CIFRADO || '').trim();
  if (!secreto) {
    const err = new Error('BACKUP_CLAVE_CIFRADO no configurada');
    err.status = 500;
    throw err;
  }
  return crypto.createHash('sha256').update(secreto, 'utf8').digest();
}

/** Cifra rutaZip → rutaSalida (.argobk) y elimina el zip en claro. */
async function cifrarArchivo(rutaZip, rutaSalida) {
  const key = derivarClave();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const salida = fs.createWriteStream(rutaSalida);

  await new Promise((resolve, reject) => {
    salida.write(MAGIC);
    salida.write(iv);
    const entrada = fs.createReadStream(rutaZip);
    entrada.on('error', reject);
    cipher.on('error', reject);
    salida.on('error', reject);
    cipher.on('data', (chunk) => salida.write(chunk));
    cipher.on('end', () => {
      salida.write(cipher.getAuthTag());
      salida.end();
    });
    salida.on('finish', resolve);
    entrada.pipe(cipher);
  });

  await fs.promises.unlink(rutaZip).catch(() => {});
}

function esArchivoCifrado(ruta) {
  const fd = fs.openSync(ruta, 'r');
  try {
    const head = Buffer.alloc(MAGIC.length);
    fs.readSync(fd, head, 0, MAGIC.length, 0);
    return head.equals(MAGIC);
  } finally {
    fs.closeSync(fd);
  }
}

/** Descifra rutaCifrada (.argobk) → rutaZipSalida. */
async function descifrarArchivo(rutaCifrada, rutaZipSalida) {
  const key = derivarClave();
  const { size } = await fs.promises.stat(rutaCifrada);
  const minimo = MAGIC.length + IV_LEN + TAG_LEN;
  if (size <= minimo) {
    const err = new Error('Archivo de respaldo cifrado corrupto o incompleto');
    err.status = 400;
    throw err;
  }

  const fd = await fs.promises.open(rutaCifrada, 'r');
  let iv;
  let tag;
  try {
    const head = Buffer.alloc(MAGIC.length + IV_LEN);
    await fd.read(head, 0, head.length, 0);
    if (!head.subarray(0, MAGIC.length).equals(MAGIC)) {
      const err = new Error('El archivo no es un respaldo cifrado de ARGO');
      err.status = 400;
      throw err;
    }
    iv = head.subarray(MAGIC.length);
    tag = Buffer.alloc(TAG_LEN);
    await fd.read(tag, 0, TAG_LEN, size - TAG_LEN);
  } finally {
    await fd.close();
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const entrada = fs.createReadStream(rutaCifrada, {
    start: MAGIC.length + IV_LEN,
    end: size - TAG_LEN - 1,
  });

  try {
    await pipeline(entrada, decipher, fs.createWriteStream(rutaZipSalida));
  } catch (e) {
    await fs.promises.unlink(rutaZipSalida).catch(() => {});
    const err = new Error(
      'No se pudo descifrar el respaldo. Verifique que BACKUP_CLAVE_CIFRADO sea la misma con la que se creó.',
    );
    err.status = 400;
    throw err;
  }
}

module.exports = {
  claveCifradoConfigurada,
  cifrarArchivo,
  descifrarArchivo,
  esArchivoCifrado,
  EXTENSION_CIFRADA: '.argobk',
};
