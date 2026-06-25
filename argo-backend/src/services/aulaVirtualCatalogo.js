const { models: cat } = require('../models/catalogos');
const CapacitacionVirtualConfig = require('../models/CapacitacionVirtualConfig');
const { resolvePath } = require('../middleware/upload');
const { detectarIndexHtml, paqueteListo } = require('./aulaVirtualPaquete');
const {
  buscarPrograma,
  listarServiciosMatricula,
  num,
  esCapacitacionVirtualServicio,
} = require('./programaServicio');
const { programaAdmiteMatriculaVirtual } = require('./programaModalidad');
const { mapaCategorias, idsCategoriasConfig, resolverCategoriasCurso } = require('./aulaVirtualCategorias');
const { obtenerConfigPortalPublica } = require('./aulaVirtualPortal');
const { publicUploadUrl } = require('../utils/uploadPublicUrl');

function resolverIndexPaquete(cfg) {
  if (!cfg?.rutaPaquete) return cfg?.indexHtml || 'index.html';
  const abs = resolvePath(cfg.rutaPaquete);
  if (!abs) return cfg.indexHtml || 'index.html';
  const indexRel = detectarIndexHtml(abs, cfg.indexHtml || 'index.html');
  if (indexRel !== (cfg.indexHtml || 'index.html') && paqueteListo(abs, indexRel)) {
    CapacitacionVirtualConfig.updateOne(
      { idPrograma: String(cfg.idPrograma) },
      { $set: { indexHtml: indexRel } },
    ).catch(() => {});
  }
  return indexRel;
}

async function configPorPrograma(idPrograma) {
  return CapacitacionVirtualConfig.findOne({ idPrograma: String(idPrograma) }).lean();
}

async function servicioMatriculaPrograma(prog) {
  const lista = await listarServiciosMatricula(prog);
  return lista[0] || null;
}

function paqueteInstalado(cfg) {
  if (!cfg?.rutaPaquete) return false;
  const abs = resolvePath(cfg.rutaPaquete);
  if (!abs) return false;
  const indexRel = detectarIndexHtml(abs, cfg.indexHtml || 'index.html');
  return paqueteListo(abs, indexRel);
}

function mapCursoPublico(prog, serv, cfg, opts = {}) {
  const tarifaVirtual = num(serv?.tarifaVirtual);
  const idPrograma = String(prog.idPrograma ?? prog._id);
  const publicado = cfg ? !!cfg.publicadoPortal : false;
  const cats = resolverCategoriasCurso(cfg, opts.categoriasMap);
  return {
    idPrograma,
    codigoProg: prog.codigoProg || null,
    nombreProg: prog.nombreProg,
    nomCert: prog.nomCert || null,
    descripcion: prog.descripcion || null,
    descripcionVirtual: prog.descripcionVirtual || null,
    horas: prog.horas ?? null,
    tipoCertificado: prog.tipoCertificado || null,
    tarifaVirtual,
    urlPortadaVirtual: prog.urlPortadaVirtual || null,
    urlPortadaAbsoluta: publicUploadUrl(prog.urlPortadaVirtual),
    esCapacitacionVirtual: tarifaVirtual > 0,
    publicadoPortal: publicado,
    modoCertificado: cfg?.modoCertificado || 'al_pagar',
    requierePagoParaCursar: cfg?.requierePagoParaCursar === true,
    tienePaquete: paqueteInstalado(cfg),
    rutaPaquete: cfg?.rutaPaquete || null,
    playerUrl: cfg?.rutaPaquete
      ? publicUploadUrl(`${cfg.rutaPaquete}/${resolverIndexPaquete(cfg)}`)
      : null,
    storagePrefix: cfg?.storagePrefix || null,
    idCategorias: cats.idCategorias,
    categoriaNombres: cats.categoriaNombres,
    categoriaNombre: cats.categoriaNombre,
    nivel: cfg?.nivel || null,
    autor: opts.autor || null,
    ...(opts.detalle
      ? {
          materiales: cfg?.materiales || [],
          sesionesMeet: cfg?.sesionesMeet || [],
          pctMinCompletitud: cfg?.pctMinCompletitud ?? 80,
          pctMinEvaluaciones: cfg?.pctMinEvaluaciones ?? 60,
          intentosMaxEval: cfg?.intentosMaxEval ?? 3,
        }
      : {}),
  };
}

async function listarCursosVirtuales({ soloPublicados = true, q = '', idCategoria = null } = {}) {
  const programas = await cat.programas
    .find({ estado: { $in: [/^activo$/i, 'ACTIVO', 'Activo', null] } })
    .lean();
  const [configs, categoriasMap, portal] = await Promise.all([
    CapacitacionVirtualConfig.find().lean(),
    mapaCategorias(),
    obtenerConfigPortalPublica(),
  ]);
  const cfgMap = new Map(configs.map((c) => [String(c.idPrograma), c]));
  const catFilter = idCategoria != null && idCategoria !== '' ? Number(idCategoria) : null;
  const autor = portal?.nombreCea || null;
  const out = [];

  for (const prog of programas) {
    const servicios = await listarServiciosMatricula(prog);
    if (!programaAdmiteMatriculaVirtual(prog, servicios)) continue;
    const serv = servicios[0] || null;
    const cfg = cfgMap.get(String(prog.idPrograma)) || null;
    if (soloPublicados && !(cfg && cfg.publicadoPortal)) continue;
    if (catFilter != null && !idsCategoriasConfig(cfg).includes(catFilter)) continue;

    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const hay =
        re.test(prog.nombreProg || '') ||
        re.test(prog.codigoProg || '') ||
        re.test(prog.descripcionVirtual || '') ||
        re.test(prog.descripcion || '');
      if (!hay) continue;
    }

    out.push(mapCursoPublico(prog, serv, cfg, { categoriasMap, autor }));
  }

  out.sort((a, b) => String(a.nombreProg).localeCompare(String(b.nombreProg), 'es'));
  return out;
}

async function obtenerCursoVirtual(idPrograma, { requierePublicado = true } = {}) {
  const prog = await buscarPrograma(idPrograma);
  if (!prog) return null;
  const servicios = await listarServiciosMatricula(prog);
  if (!programaAdmiteMatriculaVirtual(prog, servicios)) return null;
  const serv = servicios[0] || null;
  const cfg = await configPorPrograma(prog.idPrograma);
  if (requierePublicado && !(cfg && cfg.publicadoPortal)) return null;
  const [categoriasMap, portal] = await Promise.all([mapaCategorias(), obtenerConfigPortalPublica()]);
  return mapCursoPublico(prog, serv, cfg, {
    detalle: true,
    categoriasMap,
    autor: portal?.nombreCea || null,
  });
}

async function listarCursosVirtualesAdmin() {
  const programas = await cat.programas
    .find({ estado: { $in: [/^activo$/i, 'ACTIVO', 'Activo', null] } })
    .lean();
  const [configs, categoriasMap, portal] = await Promise.all([
    CapacitacionVirtualConfig.find().lean(),
    mapaCategorias(),
    obtenerConfigPortalPublica(),
  ]);
  const cfgMap = new Map(configs.map((c) => [String(c.idPrograma), c]));
  const autor = portal?.nombreCea || null;
  const out = [];

  for (const prog of programas) {
    const servicios = await listarServiciosMatricula(prog);
    if (!programaAdmiteMatriculaVirtual(prog, servicios)) continue;
    const serv = servicios[0] || null;
    const cfg = cfgMap.get(String(prog.idPrograma)) || null;
    out.push({
      ...mapCursoPublico(prog, serv, cfg, { detalle: true, categoriasMap, autor }),
      config: cfg
        ? { ...cfg, idCategorias: idsCategoriasConfig(cfg) }
        : {
            idPrograma: String(prog.idPrograma),
            publicadoPortal: false,
            modoCertificado: 'al_pagar',
            requierePagoParaCursar: false,
            pctMinCompletitud: 80,
            pctMinEvaluaciones: 60,
            intentosMaxEval: 3,
            idCategorias: [],
            nivel: null,
            materiales: [],
            sesionesMeet: [],
          },
    });
  }

  out.sort((a, b) => String(a.nombreProg).localeCompare(String(b.nombreProg), 'es'));
  return out;
}

module.exports = {
  publicUploadUrl,
  listarCursosVirtuales,
  obtenerCursoVirtual,
  listarCursosVirtualesAdmin,
  configPorPrograma,
  servicioMatriculaPrograma,
};
