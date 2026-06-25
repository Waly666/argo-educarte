const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const {
  listarCursosVirtualesAdmin,
  obtenerCursoVirtual,
} = require('../services/aulaVirtualCatalogo');
const {
  guardarConfigAula,
  obtenerConfigAula,
  obtenerConfigPortalAdmin,
  mergeLanding,
} = require('../services/aulaVirtualPortal');
const { mergePortalSite } = require('../services/portalSiteConfig');
const {
  obtenerConfig,
  guardarConfig,
  asignarPaquete,
  agregarMaterialArchivo,
  eliminarMaterial,
  asegurarDirPaquete,
  asegurarProgramaVirtual,
  actualizarFichaPrograma,
} = require('../services/aulaVirtualConfig');
const {
  listarCategorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
} = require('../services/aulaVirtualCategorias');
const {
  listarAdmin: listarBlogAdmin,
  obtenerAdmin: obtenerBlogAdmin,
  crearPost,
  actualizarPost,
  eliminarPost,
  urlImagenSubida,
} = require('../services/aulaVirtualBlog');
const { publicUrl, publicUrlPath, resolvePath } = require('../middleware/upload');
const { listarUsuariosPortalAdmin, eliminarUsuarioPortal, crearUsuarioPortalAdmin } = require('../services/aulaVirtualUsuarios');
const { inyectarBridgeEnPaquete, detectarStoragePrefix } = require('../services/aulaVirtualBridge');
const { detectarIndexHtml, paqueteListo, listarEntradasPaquete } = require('../services/aulaVirtualPaquete');
const CapacitacionVirtualConfig = require('../models/CapacitacionVirtualConfig');
const { matricularVirtual } = require('../services/aulaVirtualMatricula');
const { listarProgresoAlumnosAdmin } = require('../services/aulaVirtualProgresoAdmin');

async function persistirStoragePrefix(idPrograma, abs, indexRel, user) {
  const storagePrefix = detectarStoragePrefix(abs, indexRel);
  if (!storagePrefix) return null;
  await CapacitacionVirtualConfig.updateOne(
    { idPrograma: String(idPrograma) },
    { $set: { storagePrefix, userChangeRecord: user?.username || 'sistema' } },
  );
  return storagePrefix;
}

exports.listarCursosAdmin = async (_req, res, next) => {
  try {
    res.json(await listarCursosVirtualesAdmin());
  } catch (e) {
    next(e);
  }
};

exports.obtenerCursoAdmin = async (req, res, next) => {
  try {
    const curso = await obtenerCursoVirtual(req.params.id, { requierePublicado: false });
    if (!curso) return res.status(404).json({ message: 'Programa virtual no encontrado' });
    const config = await obtenerConfig(req.params.id);
    res.json({ curso, config });
  } catch (e) {
    next(e);
  }
};

exports.guardarConfigCurso = async (req, res, next) => {
  try {
    const config = await guardarConfig(req.params.id, req.body || {}, req.user);
    res.json({ config, message: 'Configuración del curso virtual guardada' });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.subirPaqueteZip = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message:
          'No llegó el archivo ZIP al servidor. Compruebe que el archivo tenga extensión .zip y que no supere el límite de tamaño.',
      });
    }

    const { rel, abs } = asegurarDirPaquete(req.params.id);
    const zipPath = req.file.path;

    try {
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(abs, true);
    } catch (extractErr) {
      console.error('[ARGO] Error extrayendo ZIP curso virtual:', extractErr);
      try {
        fs.unlinkSync(zipPath);
      } catch (_e) {
        /* ignore */
      }
      const code = extractErr?.code;
      if (code === 'ENOSPC') {
        return res.status(507).json({ message: 'No hay espacio en disco en el servidor para extraer el curso.' });
      }
      if (code === 'EACCES' || code === 'EPERM') {
        return res.status(500).json({
          message: 'Sin permisos para escribir en la carpeta del curso en el servidor (uploads).',
        });
      }
      return res.status(400).json({
        message: `No se pudo extraer el ZIP: ${extractErr.message || 'archivo dañado o formato no válido'}`,
      });
    }

    try {
      fs.unlinkSync(zipPath);
    } catch (_e) {
      /* ignore */
    }

    const indexRel = detectarIndexHtml(abs, 'index.html');
    if (!paqueteListo(abs, indexRel)) {
      const visto = listarEntradasPaquete(abs).join(', ') || '(vacío)';
      return res.status(400).json({
        message:
          `No se encontró index.html en el ZIP. Debe estar en la raíz o dentro de una sola carpeta. Contenido: ${visto}`,
      });
    }

    let config = await asignarPaquete(req.params.id, rel, req.user);
    if (indexRel !== (config.indexHtml || 'index.html')) {
      await CapacitacionVirtualConfig.updateOne(
        { idPrograma: String(req.params.id) },
        { $set: { indexHtml: indexRel, userChangeRecord: req.user?.username || 'sistema' } },
      );
      config = await obtenerConfig(req.params.id);
    }
    const bridge = inyectarBridgeEnPaquete(abs, indexRel);
    await persistirStoragePrefix(req.params.id, abs, indexRel, req.user);
    config = await obtenerConfig(req.params.id);
    res.json({
      config,
      message:
        bridge.inyectados > 0
          ? `Paquete extraído e integrado con ARGO en ${bridge.inyectados} página(s) HTML`
          : 'Paquete del curso extraído correctamente (ARGO ya estaba integrado)',
      playerPath: publicUrlPath(rel, indexRel),
      bridgeInyectado: bridge.inyectados,
      bridgePaginas: bridge.total,
      storagePrefix: bridge.storagePrefix || config.storagePrefix || null,
    });
  } catch (e) {
    console.error('[ARGO] subirPaqueteZip:', e);
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.subirMaterial = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Seleccione un archivo' });
    const titulo = String(req.body?.titulo || req.file.originalname || 'Material').trim();
    const tipo = ['pdf', 'link', 'video', 'otro'].includes(req.body?.tipo) ? req.body.tipo : 'pdf';
    const url = publicUrl('aula-virtual-materiales', req.file.filename);
    const config = await agregarMaterialArchivo(
      req.params.id,
      { titulo, tipo, url, orden: Number(req.body?.orden || 0) },
      req.user,
    );
    res.json({ config, message: 'Material agregado' });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.eliminarMaterial = async (req, res, next) => {
  try {
    const config = await eliminarMaterial(req.params.id, req.params.materialId);
    res.json({ config, message: 'Material eliminado' });
  } catch (e) {
    next(e);
  }
};

exports.obtenerConfigPortal = async (_req, res, next) => {
  try {
    res.json(await obtenerConfigPortalAdmin());
  } catch (e) {
    next(e);
  }
};

exports.guardarConfigPortal = async (req, res, next) => {
  try {
    await guardarConfigAula(req.body || {}, req.user);
    res.json({ config: await obtenerConfigPortalAdmin(), message: 'Configuración del portal guardada' });
  } catch (e) {
    next(e);
  }
};

exports.subirLogoPortal = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Seleccione una imagen (PNG, JPG o WEBP)' });
    }
    const urlLogo = publicUrl('aula-virtual-logo', req.file.filename);
    await guardarConfigAula({ urlLogo }, req.user);
    res.json({ config: await obtenerConfigPortalAdmin(), message: 'Logo del portal actualizado' });
  } catch (e) {
    next(e);
  }
};

exports.quitarLogoPortal = async (_req, res, next) => {
  try {
    await guardarConfigAula({ urlLogo: '' }, _req.user);
    res.json({ config: await obtenerConfigPortalAdmin(), message: 'Logo del portal eliminado; se usará el de Recibos si existe' });
  } catch (e) {
    next(e);
  }
};

async function guardarUrlHeroPortal(urlHero, usuario) {
  const aula = await obtenerConfigAula();
  const landing = mergeLanding(aula.landing);
  const site = mergePortalSite(
    { ...aula.site, tema: { ...(aula.site?.tema || {}), urlHero } },
    { nav: landing.nav, footer: landing.footer },
  );
  await guardarConfigAula({ site }, usuario);
}

exports.subirImagenHeroPortal = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Seleccione una imagen (PNG, JPG o WEBP)' });
    }
    const urlHero = publicUrl('aula-virtual-hero', req.file.filename);
    await guardarUrlHeroPortal(urlHero, req.user);
    res.json({ config: await obtenerConfigPortalAdmin(), message: 'Imagen del banner actualizada en el sitio' });
  } catch (e) {
    next(e);
  }
};

exports.quitarImagenHeroPortal = async (req, res, next) => {
  try {
    await guardarUrlHeroPortal('', req.user);
    res.json({
      config: await obtenerConfigPortalAdmin(),
      message: 'Imagen del banner eliminada; se usará la imagen por defecto',
    });
  } catch (e) {
    next(e);
  }
};

exports.listarCategoriasAdmin = async (_req, res, next) => {
  try {
    res.json(await listarCategorias());
  } catch (e) {
    next(e);
  }
};

exports.crearCategoria = async (req, res, next) => {
  try {
    const row = await crearCategoria(req.body || {}, req.user);
    res.status(201).json({ categoria: row, message: 'Categoría creada' });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.actualizarCategoria = async (req, res, next) => {
  try {
    const row = await actualizarCategoria(req.params.id, req.body || {}, req.user);
    res.json({ categoria: row, message: 'Categoría actualizada' });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.eliminarCategoria = async (req, res, next) => {
  try {
    await eliminarCategoria(req.params.id);
    res.json({ ok: true, message: 'Categoría eliminada' });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.subirPortadaCurso = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Seleccione una imagen de portada' });
    await asegurarProgramaVirtual(req.params.id);
    const urlPortadaVirtual = publicUrl('programas-virtual', req.file.filename);
    await actualizarFichaPrograma(
      req.params.id,
      { urlPortadaVirtual },
      req.user,
    );
    res.json({ urlPortadaVirtual, message: 'Portada del curso actualizada' });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.quitarPortadaCurso = async (req, res, next) => {
  try {
    await asegurarProgramaVirtual(req.params.id);
    await actualizarFichaPrograma(req.params.id, { urlPortadaVirtual: '' }, req.user);
    res.json({ message: 'Portada eliminada' });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.reintegrarBridge = async (req, res, next) => {
  try {
    const config = await obtenerConfig(req.params.id);
    if (!config?.rutaPaquete) {
      return res.status(400).json({ message: 'El curso no tiene paquete cargado' });
    }
    const abs = resolvePath(config.rutaPaquete);
    if (!abs || !fs.existsSync(abs)) {
      return res.status(404).json({ message: 'Carpeta del paquete no encontrada en el servidor' });
    }
    const indexRel = detectarIndexHtml(abs, config.indexHtml || 'index.html');
    if (!paqueteListo(abs, indexRel)) {
      return res.status(400).json({ message: 'No se encontró index.html en el paquete del curso' });
    }
    if (indexRel !== (config.indexHtml || 'index.html')) {
      await CapacitacionVirtualConfig.updateOne(
        { idPrograma: String(req.params.id) },
        { $set: { indexHtml: indexRel, userChangeRecord: req.user?.username || 'sistema' } },
      );
      config = await obtenerConfig(req.params.id);
    }
    const bridge = inyectarBridgeEnPaquete(abs, indexRel);
    const storagePrefix = await persistirStoragePrefix(req.params.id, abs, indexRel, req.user);
    res.json({
      message:
        bridge.inyectados > 0
          ? `ARGO integrado en ${bridge.inyectados} página(s). Entrada: ${indexRel}`
          : `ARGO ya integrado. Entrada del curso: ${indexRel}`,
      indexHtml: indexRel,
      bridgeInyectado: bridge.inyectados,
      bridgePaginas: bridge.total,
      storagePrefix: storagePrefix || bridge.storagePrefix || config.storagePrefix || null,
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.matricularAlumnoCurso = async (req, res, next) => {
  try {
    const body = req.body || {};
    const numDoc = body.numDoc ?? req.params.numDoc;
    const out = await matricularVirtual({
      numDoc,
      idPrograma: req.params.id,
      observaciones: body.observaciones,
      crearUsuarioPortal: body.crearUsuarioPortal === true || body.crearUsuarioPortal === 'true',
      email: body.email,
      password: body.password,
    });
    res.status(out.yaMatriculado ? 200 : 201).json(out);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.listarUsuariosPortal = async (req, res, next) => {
  try {
    const q = String(req.query?.q || '').trim();
    const limit = Number(req.query?.limit) || 200;
    res.json(await listarUsuariosPortalAdmin({ q, limit }));
  } catch (e) {
    next(e);
  }
};

exports.crearUsuarioPortal = async (req, res, next) => {
  try {
    const body = req.body || {};
    const out = await crearUsuarioPortalAdmin({
      email: body.email,
      password: body.password,
      alumno: body.alumno || body,
      usuarioErp: req.user?.username || req.user?.nick || 'erp',
    });
    res.status(201).json(out);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.eliminarUsuarioPortal = async (req, res, next) => {
  try {
    res.json(await eliminarUsuarioPortal(req.params.id));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.listarProgresoAlumnos = async (req, res, next) => {
  try {
    const curso = await obtenerCursoVirtual(req.params.id, { requierePublicado: false });
    if (!curso) return res.status(404).json({ message: 'Programa virtual no encontrado' });
    const ctx = req.sedeId ? { idSede: req.sedeId } : {};
    res.json(await listarProgresoAlumnosAdmin(req.params.id, req.query, ctx));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.listarBlogAdmin = async (_req, res, next) => {
  try {
    res.json(await listarBlogAdmin());
  } catch (e) {
    next(e);
  }
};

exports.obtenerBlogAdmin = async (req, res, next) => {
  try {
    res.json(await obtenerBlogAdmin(req.params.id));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.crearBlogPost = async (req, res, next) => {
  try {
    const post = await crearPost(req.body || {}, req.user);
    res.status(201).json({ post, message: 'Artículo creado' });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.actualizarBlogPost = async (req, res, next) => {
  try {
    const post = await actualizarPost(req.params.id, req.body || {}, req.user);
    res.json({ post, message: 'Artículo actualizado' });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.eliminarBlogPost = async (req, res, next) => {
  try {
    await eliminarPost(req.params.id);
    res.json({ ok: true, message: 'Artículo eliminado' });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.subirImagenBlog = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Seleccione una imagen (PNG, JPG o WEBP)' });
    }
    const url = urlImagenSubida(req.file.filename);
    res.status(201).json({ url, message: 'Imagen subida' });
  } catch (e) {
    next(e);
  }
};
