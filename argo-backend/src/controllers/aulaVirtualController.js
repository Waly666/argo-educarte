const {
  listarCursosVirtuales,
  obtenerCursoVirtual,
} = require('../services/aulaVirtualCatalogo');
const { listarCategorias } = require('../services/aulaVirtualCategorias');
const { listarPublicos, obtenerPublicoPorSlug } = require('../services/aulaVirtualBlog');
const { obtenerConfigPortalPublica } = require('../services/aulaVirtualPortal');
const { registrarPortal, loginPortal, buscarAlumnoRegistro } = require('../services/aulaVirtualAuth');
const {
  solicitarRegistroPortal,
  confirmarRegistroPortal,
  reenviarCodigoRegistro,
} = require('../services/portalRegistroVerificacion');
const {
  listarMisCursos,
  reportarProgreso,
  evaluarAprobacion,
  verificarAccesoCurso,
  mapProgresoRespuesta,
} = require('../services/aulaVirtualProgreso');
const {
  matricularVirtual,
  estadoInscripcionVirtual,
} = require('../services/aulaVirtualMatricula');
const {
  listarMisCertificados,
  consultarCertificadosPublico,
  htmlCertificadoPortal,
} = require('../services/aulaVirtualCertificados');
const { htmlReciboPortal } = require('../services/aulaVirtualRecibos');
const {
  misClasesPresenciales,
  calendarioCohorte,
  asistirMeet,
  evaluacionesAlumno,
  iniciarIntento,
  enviarIntento,
  materialesAlumno,
} = require('../services/aulaVirtualCohorte');
const { enviarContactoPortal } = require('../services/aulaVirtualContacto');
const { enviarPqrPortal } = require('../services/aulaVirtualPqr');
const { generarSitemapXml } = require('../services/aulaVirtualSitemap');
const { publicOriginFromReq } = require('../utils/publicOrigin');
const { portalRegistroAbierto, turnstileSiteKey, turnstileEnabled, portalEmailVerifyEnabled } = require('../config/security');
const { logAuthIntento } = require('../services/authSecurityLog');
const path = require('path');
const { models } = require('../models/catalogos');
const catalogoController = require('./catalogoController');

exports.configPublica = async (_req, res, next) => {
  try {
    const cfg = await obtenerConfigPortalPublica();
    res.json({
      ...cfg,
      registroAbierto: portalRegistroAbierto(),
      emailVerificacionRegistro: portalEmailVerifyEnabled(),
      turnstileSiteKey: turnstileEnabled() ? turnstileSiteKey() : '',
    });
  } catch (e) {
    next(e);
  }
};

exports.listarCategorias = async (_req, res, next) => {
  try {
    res.json(await listarCategorias({ soloActivas: true }));
  } catch (e) {
    next(e);
  }
};

exports.listarBlog = async (_req, res, next) => {
  try {
    res.json(await listarPublicos());
  } catch (e) {
    next(e);
  }
};

exports.obtenerBlogPost = async (req, res, next) => {
  try {
    res.json(await obtenerPublicoPorSlug(req.params.slug));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.listarCursos = async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const idCategoria = req.query.idCategoria ?? req.query.categoria ?? null;
    const rows = await listarCursosVirtuales({ soloPublicados: true, q, idCategoria });
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

exports.obtenerCurso = async (req, res, next) => {
  try {
    const curso = await obtenerCursoVirtual(req.params.id, { requierePublicado: true });
    if (!curso) return res.status(404).json({ message: 'Curso no encontrado o no publicado' });
    res.json(curso);
  } catch (e) {
    next(e);
  }
};

exports.buscarAlumnoRegistro = async (req, res, next) => {
  try {
    const numDoc = req.query.numDoc ?? req.params.numDoc;
    res.json(await buscarAlumnoRegistro(numDoc));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.registro = async (req, res, next) => {
  try {
    if (!portalRegistroAbierto()) {
      return res.status(403).json({ message: 'El registro en línea está temporalmente cerrado.' });
    }
    const { email, password, turnstileToken: _t, ...alumno } = req.body || {};
    const out = await registrarPortal({ email, password, alumno });
    res.status(201).json(out);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.registroSolicitar = async (req, res, next) => {
  try {
    if (!portalRegistroAbierto()) {
      return res.status(403).json({ message: 'El registro en línea está temporalmente cerrado.' });
    }
    if (!portalEmailVerifyEnabled()) {
      return res.status(400).json({
        message: 'La verificación por correo no está activa. Use el registro directo.',
      });
    }
    const cfg = await obtenerConfigPortalPublica();
    const { email, password, turnstileToken: _t, ...alumno } = req.body || {};
    const out = await solicitarRegistroPortal({
      email,
      password,
      alumno,
      nombreCea: cfg.nombreCea,
    });
    res.status(202).json(out);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.registroConfirmar = async (req, res, next) => {
  try {
    if (!portalRegistroAbierto()) {
      return res.status(403).json({ message: 'El registro en línea está temporalmente cerrado.' });
    }
    const { pendingId, codigo } = req.body || {};
    const out = await confirmarRegistroPortal({ pendingId, codigo });
    res.status(201).json(out);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.registroReenviarCodigo = async (req, res, next) => {
  try {
    if (!portalRegistroAbierto()) {
      return res.status(403).json({ message: 'El registro en línea está temporalmente cerrado.' });
    }
    const cfg = await obtenerConfigPortalPublica();
    const { pendingId } = req.body || {};
    const out = await reenviarCodigoRegistro({ pendingId, nombreCea: cfg.nombreCea });
    res.json(out);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const out = await loginPortal({ email, password });
    logAuthIntento({ req, canal: 'portal', identificador: email, ok: true });
    res.json(out);
  } catch (e) {
    if (e.status) {
      logAuthIntento({
        req,
        canal: 'portal',
        identificador: req.body?.email,
        ok: false,
        motivo: e.message,
      });
      return res.status(e.status).json({ message: e.message });
    }
    next(e);
  }
};

exports.miPerfil = async (req, res, next) => {
  try {
    const DatosAlumno = require('../models/DatosAlumno');
    const Cliente     = require('../models/Cliente');
    const { numDocQuery } = require('../utils/numDoc');
    const al = await DatosAlumno.findOne(numDocQuery(req.portalUser.numDoc), { empresaId: 1 }).lean();
    let empresaId = null;
    let empresaNombre = null;
    if (al?.empresaId) {
      empresaId = String(al.empresaId);
      const cli = await Cliente.findById(al.empresaId, { razonSocial: 1, nombres: 1, nombreComercial: 1, identificacion: 1 }).lean();
      if (cli) empresaNombre = cli.razonSocial?.trim() || cli.nombreComercial?.trim() || cli.nombres?.trim() || cli.identificacion || null;
    }
    res.json({ usuario: { ...req.portalUser, empresaId, empresaNombre } });
  } catch (e) {
    next(e);
  }
};

exports.actualizarEmpresa = async (req, res, next) => {
  try {
    const DatosAlumno = require('../models/DatosAlumno');
    const Cliente     = require('../models/Cliente');
    const mongoose    = require('mongoose');
    const { numDocQuery } = require('../utils/numDoc');

    const { empresaId } = req.body || {};
    const numDoc = req.portalUser.numDoc;

    const al = await DatosAlumno.findOne(numDocQuery(numDoc)).lean();
    if (!al) return res.status(404).json({ message: 'Alumno no encontrado' });

    let empresaNombre = null;
    let idToSave = null;

    if (empresaId && mongoose.isValidObjectId(empresaId)) {
      const cli = await Cliente.findById(empresaId, { razonSocial: 1, nombres: 1, nombreComercial: 1, identificacion: 1, activo: 1 }).lean();
      if (!cli || cli.activo === false) return res.status(404).json({ message: 'Empresa no encontrada' });
      idToSave = cli._id;
      empresaNombre = cli.razonSocial?.trim() || cli.nombreComercial?.trim() || cli.nombres?.trim() || cli.identificacion || null;
    }

    await DatosAlumno.findByIdAndUpdate(al._id, {
      $set: { empresaId: idToSave, fechaMod: new Date() },
    });

    res.json({ ok: true, empresaId: idToSave ? String(idToSave) : null, empresaNombre });
  } catch (e) {
    next(e);
  }
};

exports.buscarEmpresasPortal = async (req, res, next) => {
  try {
    const Cliente = require('../models/Cliente');
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 2) return res.json([]);
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const rows = await Cliente.find({
      activo: { $ne: false },
      $or: [{ razonSocial: re }, { nombres: re }, { identificacion: re }, { nombreComercial: re }],
    }, { razonSocial: 1, nombres: 1, nombreComercial: 1, identificacion: 1 }).limit(10).lean();
    res.json(rows.map((c) => ({
      _id: String(c._id),
      nombre: c.razonSocial?.trim() || c.nombreComercial?.trim() || c.nombres?.trim() || c.identificacion || '',
      identificacion: c.identificacion,
    })));
  } catch (e) {
    next(e);
  }
};

exports.bridgeScript = (_req, res, next) => {
  try {
    const file = path.join(__dirname, '..', 'public', 'aula-virtual', 'argo-bridge.js');
    res.type('application/javascript');
    res.sendFile(file);
  } catch (e) {
    next(e);
  }
};

exports.misCursos = async (req, res, next) => {
  try {
    const rows = await listarMisCursos(req.portalUser.numDoc);
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

exports.obtenerProgreso = async (req, res, next) => {
  try {
    await verificarAccesoCurso(req.portalUser.numDoc, req.params.id);
    const estado = await evaluarAprobacion(req.portalUser.numDoc, req.params.id);
    res.json(mapProgresoRespuesta(null, estado));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.reportarProgreso = async (req, res, next) => {
  try {
    const out = await reportarProgreso(req.portalUser.numDoc, req.params.id, req.body || {});
    res.json(out);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.estadoInscripcion = async (req, res, next) => {
  try {
    res.json(await estadoInscripcionVirtual(req.portalUser.numDoc, req.params.id));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.matricularCurso = async (req, res, next) => {
  try {
    const out = await matricularVirtual({
      numDoc: req.portalUser.numDoc,
      idPrograma: req.params.id,
    });
    res.status(out.yaMatriculado ? 200 : 201).json(out);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.iniciarPagoEnLinea = async (req, res, next) => {
  try {
    const { obtenerConfigPasarela } = require('../services/configPasarela');
    const { buscarLiquidacionVirtual } = require('../services/aulaVirtualMatricula');
    const { crearIntentoPagoEnLinea } = require('../services/pasarelaWompi');
    const DatosAlumno = require('../models/DatosAlumno');
    const { numDocQuery } = require('../utils/numDoc');

    const cfg = await obtenerConfigPasarela();
    if (!cfg.activo) {
      return res.status(503).json({ message: 'Los pagos en línea no están disponibles en este momento.' });
    }

    const numDoc = req.portalUser.numDoc;
    const liq = await buscarLiquidacionVirtual(numDoc, req.params.id);
    if (!liq) {
      return res.status(404).json({ message: 'No hay matrícula con pago pendiente para este curso.' });
    }

    const alumno = await DatosAlumno.findOne(numDocQuery(numDoc)).lean();
    const checkout = await crearIntentoPagoEnLinea({
      numDoc,
      idLiquidacion: liq._id,
      customerEmail: alumno?.correo || req.portalUser?.email || null,
      redirectUrl: req.body?.redirectUrl || cfg.redirectUrlBase || null,
    });
    res.json(checkout);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message, code: e.code });
    next(e);
  }
};

exports.consultarCertificados = async (req, res, next) => {
  try {
    res.json(await consultarCertificadosPublico(req.query.numDoc));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.misCertificados = async (req, res, next) => {
  try {
    const rows = await listarMisCertificados(req.portalUser.numDoc);
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

exports.misClasesPresenciales = async (req, res, next) => {
  try {
    res.json(await misClasesPresenciales(req.portalUser.numDoc));
  } catch (e) {
    next(e);
  }
};

exports.calendarioCohorte = async (req, res, next) => {
  try {
    res.json(await calendarioCohorte(req.portalUser.numDoc, req.params.idCohorte));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.asistirClaseMeet = async (req, res, next) => {
  try {
    res.json(await asistirMeet(req.portalUser.numDoc, req.params.idClase));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.evaluacionesCohorteAlumno = async (req, res, next) => {
  try {
    res.json(await evaluacionesAlumno(req.portalUser.numDoc, req.params.idCohorte));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.iniciarIntentoEvaluacion = async (req, res, next) => {
  try {
    res.json(await iniciarIntento(req.portalUser.numDoc, req.params.idEval));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.enviarIntentoEvaluacion = async (req, res, next) => {
  try {
    res.json(
      await enviarIntento(req.portalUser.numDoc, req.params.idEval, req.body?.respuestas, 'portal'),
    );
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.materialesCohorteAlumno = async (req, res, next) => {
  try {
    res.json(await materialesAlumno(req.portalUser.numDoc, req.params.idCohorte));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.certificadoHtml = async (req, res, next) => {
  try {
    const html = await htmlCertificadoPortal(
      req.portalUser.numDoc,
      req.params.id,
      publicOriginFromReq(req),
    );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    if (e.status) return res.status(e.status).send(e.message);
    next(e);
  }
};

exports.reciboHtml = async (req, res, next) => {
  try {
    const html = await htmlReciboPortal(req.portalUser.numDoc, req.params.id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    if (e.status) return res.status(e.status).send(e.message);
    next(e);
  }
};

exports.catalogosTiposDoc = async (_req, res, next) => {
  try {
    const data = await models.catTipoDoc.find().sort({ idTipoDoc: 1 }).lean();
    res.json(data);
  } catch (e) {
    next(e);
  }
};

exports.catalogosGeneros = async (_req, res, next) => {
  try {
    const data = await models.genero.find().sort({ idGenero: 1 }).lean();
    res.json(data);
  } catch (e) {
    next(e);
  }
};

exports.catalogosDepartamentos = catalogoController.departamentos;
exports.catalogosMunicipios = catalogoController.municipios;
exports.catalogosBuscarMunicipios = catalogoController.buscarMunicipios;
exports.catalogosMunicipio = catalogoController.municipioPorCodigo;

exports.enviarContacto = async (req, res, next) => {
  try {
    const result = await enviarContactoPortal(req.body);
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.enviarPqr = async (req, res, next) => {
  try {
    const result = await enviarPqrPortal(req.body);
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.sitemapXml = async (req, res, next) => {
  try {
    const xml = await generarSitemapXml(req);
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (e) {
    next(e);
  }
};
