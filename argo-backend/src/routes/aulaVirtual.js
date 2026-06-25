const { Router } = require('express');
const ctrl = require('../controllers/aulaVirtualController');
const admin = require('../controllers/aulaVirtualAdminController');
const { requireAuth, requirePermiso } = require('../middleware/auth');
const { requirePortalAuth } = require('../middleware/authPortal');
const {
  aulaVirtualZip,
  aulaVirtualMateriales,
  aulaVirtualLogo,
  aulaVirtualHero,
  aulaVirtualBlog,
  aulaVirtualApk,
  programasVirtual,
} = require('../middleware/upload');
const { portalAuthLimiter, buscarAlumnoLimiter } = require('../middleware/security');
const { requireTurnstile } = require('../middleware/turnstile');

/** Turnstile activo en web; apps móviles envían X-ARGO-Cliente: mobile */
const turnstilePortal = requireTurnstile({ allowNativeClients: true });

const router = Router();

/** Público — portal estudiante */
router.get('/sitemap.xml', ctrl.sitemapXml);
router.get('/config', ctrl.configPublica);
router.get('/catalogos/tipos-doc', ctrl.catalogosTiposDoc);
router.get('/catalogos/generos', ctrl.catalogosGeneros);
router.get('/catalogos/departamentos', ctrl.catalogosDepartamentos);
router.get('/catalogos/municipios-buscar', ctrl.catalogosBuscarMunicipios);
router.get('/catalogos/municipio/:codMunicipio', ctrl.catalogosMunicipio);
router.get('/catalogos/municipios/:codDepto', ctrl.catalogosMunicipios);
router.get('/categorias', ctrl.listarCategorias);
router.get('/blog', ctrl.listarBlog);
router.get('/blog/:slug', ctrl.obtenerBlogPost);
router.get('/cursos', ctrl.listarCursos);
router.get('/cursos/:id', ctrl.obtenerCurso);
router.get(
  '/auth/buscar-alumno',
  buscarAlumnoLimiter,
  turnstilePortal,
  ctrl.buscarAlumnoRegistro,
);
router.get(
  '/certificados/consulta',
  buscarAlumnoLimiter,
  turnstilePortal,
  ctrl.consultarCertificados,
);
router.post('/auth/registro', portalAuthLimiter, turnstilePortal, ctrl.registro);
router.post('/auth/registro/solicitar', portalAuthLimiter, turnstilePortal, ctrl.registroSolicitar);
router.post('/auth/registro/confirmar', portalAuthLimiter, ctrl.registroConfirmar);
router.post('/auth/registro/reenviar-codigo', portalAuthLimiter, ctrl.registroReenviarCodigo);
router.post('/auth/login', portalAuthLimiter, turnstilePortal, ctrl.login);
router.post('/contacto', buscarAlumnoLimiter, turnstilePortal, ctrl.enviarContacto);
router.post('/pqr', buscarAlumnoLimiter, turnstilePortal, ctrl.enviarPqr);
router.get('/auth/perfil', requirePortalAuth, ctrl.miPerfil);
router.patch('/auth/empresa', requirePortalAuth, ctrl.actualizarEmpresa);
router.get('/empresas/buscar', requirePortalAuth, ctrl.buscarEmpresasPortal);
router.get('/empresas/buscar-publico', buscarAlumnoLimiter, ctrl.buscarEmpresasPortal);
router.get('/argo-bridge.js', ctrl.bridgeScript);

router.get('/mis-cursos', requirePortalAuth, ctrl.misCursos);
router.get('/mis-clases-presenciales', requirePortalAuth, ctrl.misClasesPresenciales);
router.get('/mis-clases-presenciales/:idCohorte/calendario', requirePortalAuth, ctrl.calendarioCohorte);
router.post('/clases-cohorte/:idClase/asistir-meet', requirePortalAuth, ctrl.asistirClaseMeet);
router.get('/mis-clases-presenciales/:idCohorte/evaluaciones', requirePortalAuth, ctrl.evaluacionesCohorteAlumno);
router.get('/mis-clases-presenciales/:idCohorte/materiales', requirePortalAuth, ctrl.materialesCohorteAlumno);
router.post('/evaluaciones-cohorte/:idEval/iniciar', requirePortalAuth, ctrl.iniciarIntentoEvaluacion);
router.post('/evaluaciones-cohorte/:idEval/enviar', requirePortalAuth, ctrl.enviarIntentoEvaluacion);
router.get('/mis-certificados', requirePortalAuth, ctrl.misCertificados);
router.get('/certificados/:id/html', requirePortalAuth, ctrl.certificadoHtml);
router.get('/recibos/:id/html', requirePortalAuth, ctrl.reciboHtml);
router.get('/cursos/:id/progreso', requirePortalAuth, ctrl.obtenerProgreso);
router.post('/cursos/:id/progreso', requirePortalAuth, ctrl.reportarProgreso);
router.get('/cursos/:id/inscripcion', requirePortalAuth, ctrl.estadoInscripcion);
router.post('/cursos/:id/matricular', requirePortalAuth, ctrl.matricularCurso);
router.post('/cursos/:id/pagar-linea', requirePortalAuth, ctrl.iniciarPagoEnLinea);

/** Admin — app ARGO (staff) */
const gestionar = requirePermiso('aula_virtual.gestionar', 'programas.gestionar');
const configPortal = requirePermiso('aula_virtual.sitio', 'aula_virtual.gestionar', 'programas.gestionar');

router.get('/admin/usuarios', requireAuth, gestionar, admin.listarUsuariosPortal);
router.post('/admin/usuarios', requireAuth, gestionar, admin.crearUsuarioPortal);
router.delete('/admin/usuarios/:id', requireAuth, gestionar, admin.eliminarUsuarioPortal);
router.get('/admin/categorias', requireAuth, gestionar, admin.listarCategoriasAdmin);
router.post('/admin/categorias', requireAuth, gestionar, admin.crearCategoria);
router.put('/admin/categorias/:id', requireAuth, gestionar, admin.actualizarCategoria);
router.delete('/admin/categorias/:id', requireAuth, gestionar, admin.eliminarCategoria);

router.get('/admin/cursos', requireAuth, gestionar, admin.listarCursosAdmin);
router.get('/admin/cursos/:id', requireAuth, gestionar, admin.obtenerCursoAdmin);
router.put('/admin/cursos/:id', requireAuth, gestionar, admin.guardarConfigCurso);
router.post(
  '/admin/cursos/:id/paquete',
  requireAuth,
  gestionar,
  aulaVirtualZip.single('paquete'),
  admin.subirPaqueteZip,
);
router.post(
  '/admin/cursos/:id/portada',
  requireAuth,
  gestionar,
  programasVirtual.single('portada'),
  admin.subirPortadaCurso,
);
router.delete('/admin/cursos/:id/portada', requireAuth, gestionar, admin.quitarPortadaCurso);
router.post(
  '/admin/cursos/:id/materiales',
  requireAuth,
  gestionar,
  aulaVirtualMateriales.single('archivo'),
  admin.subirMaterial,
);
router.delete('/admin/cursos/:id/materiales/:materialId', requireAuth, gestionar, admin.eliminarMaterial);
router.post('/admin/cursos/:id/matricular', requireAuth, gestionar, admin.matricularAlumnoCurso);
router.get('/admin/cursos/:id/progreso-alumnos', requireAuth, gestionar, admin.listarProgresoAlumnos);
router.post('/admin/cursos/:id/reintegrar-bridge', requireAuth, gestionar, admin.reintegrarBridge);

router.get('/admin/portal', requireAuth, configPortal, admin.obtenerConfigPortal);
router.put('/admin/portal', requireAuth, configPortal, admin.guardarConfigPortal);
router.post(
  '/admin/portal/logo',
  requireAuth,
  configPortal,
  aulaVirtualLogo.single('logo'),
  admin.subirLogoPortal,
);
router.delete('/admin/portal/logo', requireAuth, configPortal, admin.quitarLogoPortal);
router.post(
  '/admin/portal/hero-imagen',
  requireAuth,
  configPortal,
  aulaVirtualHero.single('imagen'),
  admin.subirImagenHeroPortal,
);
router.delete('/admin/portal/hero-imagen', requireAuth, configPortal, admin.quitarImagenHeroPortal);
router.post(
  '/admin/portal/apk-aula',
  requireAuth,
  configPortal,
  aulaVirtualApk.single('apk'),
  admin.subirApkPortal,
);
router.delete('/admin/portal/apk-aula', requireAuth, configPortal, admin.quitarApkPortal);

router.get('/admin/blog', requireAuth, configPortal, admin.listarBlogAdmin);
router.get('/admin/blog/:id', requireAuth, configPortal, admin.obtenerBlogAdmin);
router.post('/admin/blog', requireAuth, configPortal, admin.crearBlogPost);
router.put('/admin/blog/:id', requireAuth, configPortal, admin.actualizarBlogPost);
router.delete('/admin/blog/:id', requireAuth, configPortal, admin.eliminarBlogPost);
router.post(
  '/admin/blog/imagen',
  requireAuth,
  configPortal,
  aulaVirtualBlog.single('imagen'),
  admin.subirImagenBlog,
);

module.exports = router;
