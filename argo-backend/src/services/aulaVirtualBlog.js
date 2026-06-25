const fs = require('fs');
const BlogPost = require('../models/BlogPost');
const { resolvePath } = require('../middleware/upload');

function nombreAutorDisplay(usuario) {
  if (!usuario) return 'Equipo';
  const name = [usuario.nombres, usuario.apellidos].filter(Boolean).join(' ').trim();
  return name || 'Equipo';
}

function slugify(text) {
  return (
    String(text || '')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || 'articulo'
  );
}

async function slugUnico(base, excludeId = null) {
  let slug = slugify(base);
  let n = 0;
  for (;;) {
    const candidato = n ? `${slug}-${n}` : slug;
    const q = { slug: candidato };
    if (excludeId) q._id = { $ne: excludeId };
    const existe = await BlogPost.exists(q);
    if (!existe) return candidato;
    n += 1;
  }
}

function normalizarImagenes(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const url = String(item.url || '').trim();
      if (!url) return null;
      return { url, leyenda: String(item.leyenda || '').trim() };
    })
    .filter(Boolean);
}

function borrarArchivosImagenes(imagenes) {
  for (const img of imagenes || []) {
    const rel = img?.url;
    if (!rel || String(rel).startsWith('http')) continue;
    const abs = resolvePath(rel);
    if (!abs) continue;
    try {
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch {
      /* ignorar */
    }
  }
}

function mapPublico(row) {
  if (!row) return null;
  return {
    _id: String(row._id),
    titulo: row.titulo,
    slug: row.slug,
    contenido: row.contenido || '',
    imagenes: row.imagenes || [],
    autorNombre: row.autorNombre,
    publicadoAt: row.publicadoAt || row.createdAt || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

function mapAdmin(row) {
  if (!row) return null;
  return {
    ...mapPublico(row),
    publicado: !!row.publicado,
    autorId: row.autorId ? String(row.autorId) : null,
  };
}

async function listarPublicos() {
  const rows = await BlogPost.find({ publicado: true })
    .sort({ publicadoAt: -1, createdAt: -1 })
    .lean();
  return rows.map(mapPublico);
}

async function obtenerPublicoPorSlug(slugRaw) {
  const slug = String(slugRaw || '').trim();
  if (!slug) {
    const err = new Error('Artículo no encontrado');
    err.status = 404;
    throw err;
  }
  const row = await BlogPost.findOne({ slug, publicado: true }).lean();
  if (!row) {
    const err = new Error('Artículo no encontrado');
    err.status = 404;
    throw err;
  }
  return mapPublico(row);
}

async function listarAdmin() {
  const rows = await BlogPost.find().sort({ createdAt: -1 }).lean();
  return rows.map(mapAdmin);
}

async function obtenerAdmin(id) {
  const row = await BlogPost.findById(id).lean();
  if (!row) {
    const err = new Error('Artículo no encontrado');
    err.status = 404;
    throw err;
  }
  return mapAdmin(row);
}

async function crearPost(body, usuario) {
  const titulo = String(body?.titulo || '').trim();
  if (!titulo) {
    const err = new Error('El título es obligatorio');
    err.status = 400;
    throw err;
  }
  const publicado = body?.publicado === true || body?.publicado === 'true';
  const slug = await slugUnico(body?.slug || titulo);
  const doc = await BlogPost.create({
    titulo,
    slug,
    contenido: String(body?.contenido || '').trim(),
    imagenes: normalizarImagenes(body?.imagenes),
    autorNombre: nombreAutorDisplay(usuario),
    autorId: usuario?._id || null,
    publicado,
    publicadoAt: publicado ? new Date() : null,
  });
  return mapAdmin(doc.toObject());
}

async function actualizarPost(id, body, usuario) {
  const row = await BlogPost.findById(id);
  if (!row) {
    const err = new Error('Artículo no encontrado');
    err.status = 404;
    throw err;
  }

  const titulo = body?.titulo !== undefined ? String(body.titulo || '').trim() : row.titulo;
  if (!titulo) {
    const err = new Error('El título es obligatorio');
    err.status = 400;
    throw err;
  }

  if (body?.titulo !== undefined) row.titulo = titulo;
  if (body?.slug !== undefined) {
    row.slug = await slugUnico(body.slug || titulo, row._id);
  } else if (body?.titulo !== undefined && body?.titulo !== row.titulo) {
    row.slug = await slugUnico(titulo, row._id);
  }
  if (body?.contenido !== undefined) row.contenido = String(body.contenido || '').trim();

  if (body?.imagenes !== undefined) {
    const prev = normalizarImagenes(row.imagenes);
    const next = normalizarImagenes(body.imagenes);
    const nextUrls = new Set(next.map((i) => i.url));
    const quitadas = prev.filter((i) => !nextUrls.has(i.url));
    borrarArchivosImagenes(quitadas);
    row.imagenes = next;
  }

  if (body?.publicado !== undefined) {
    const publicado = body.publicado === true || body.publicado === 'true';
    if (publicado && !row.publicado) row.publicadoAt = new Date();
    if (!publicado) row.publicadoAt = null;
    row.publicado = publicado;
  }

  if (usuario && !row.autorNombre) {
    row.autorNombre = nombreAutorDisplay(usuario);
    row.autorId = usuario._id;
  }

  await row.save();
  return mapAdmin(row.toObject());
}

async function eliminarPost(id) {
  const row = await BlogPost.findById(id).lean();
  if (!row) {
    const err = new Error('Artículo no encontrado');
    err.status = 404;
    throw err;
  }
  borrarArchivosImagenes(row.imagenes);
  await BlogPost.deleteOne({ _id: row._id });
  return { ok: true };
}

function urlImagenSubida(filename) {
  return `aula-virtual-blog/${filename}`;
}

module.exports = {
  listarPublicos,
  obtenerPublicoPorSlug,
  listarAdmin,
  obtenerAdmin,
  crearPost,
  actualizarPost,
  eliminarPost,
  urlImagenSubida,
  nombreAutorDisplay,
};
