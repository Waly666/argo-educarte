const DatosAlumno = require('../models/DatosAlumno');
const Cliente     = require('../models/Cliente');
const { models } = require('../models/catalogos');
const divipola = models.divipola;
const jornadaModel = models.jornada;
const estadoCivilModel = models.estadoCivil;
const upload = require('../middleware/upload');
const { procesarCedulaImagen } = require('../services/cedulaOcr');
const { obtenerConfigRequisitosDocumentos } = require('../services/configRequisitosDocumentos');
const { calcularDocumentosRequeridos, patchDocsAlumno, validarDocumentosParaPrograma, validarDocumentosPendientesAlumno, mensajeDocumentosPendientes } = require('../services/alumnoDocumentos');
const { enriquecerIndicadoresLista, movimientosHoyPorAlumnos } = require('../services/alumnoIndicadores');
const { listarComprobantesRecientes } = require('../services/comprobantesAlertas');
const {
  resolverJornadasFiltro,
  numDocsParticipantesJornadas,
  numDocsConCertificadoJornada,
  filtroAlumnosPorNumDocs,
  enriquecerCertificadoJornada,
} = require('../services/alumnosJornadaCapLista');
const mongoose = require('mongoose');
const { parseNumDoc, numDocFromParams, numDocQueryNativo, numDocInvalidMessage } = require('../utils/numDoc');
const {
  normalizarAlertaPagoEnDto,
  listarAlertasPagoHoy,
} = require('../services/alertaPagoAlumno');

function claveNumDocIndicador(numDoc) {
  const n = parseNumDoc(numDoc);
  return n != null ? n : numDoc;
}
const { esAdmin } = require('../utils/roles');
const { filtroBusquedaAlumno } = require('../utils/busquedaAlumnoNombre');
const {
  TIPO_ALUMNO_DEFAULT,
  TIPO_JORNADAS_CAPACITACION,
  normalizarTipoAlumno,
} = require('../constants/tipoAlumno');

const GENEROS_VALIDOS = new Set(['M', 'F']);
const TIPOS_SANGRE_VALIDOS = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

function normalizarGenero(v) {
  const t = String(v || '').toUpperCase().trim();
  if (t === 'M' || t.startsWith('MASC')) return 'M';
  if (t === 'F' || t.startsWith('FEM')) return 'F';
  return GENEROS_VALIDOS.has(t) ? t : '';
}

function normalizarTipoSangre(v) {
  const t = String(v || '').toUpperCase().replace(/\s/g, '');
  const m = t.match(/^(AB|A|B|O)(\+|-)$/);
  if (m && TIPOS_SANGRE_VALIDOS.has(`${m[1]}${m[2]}`)) return `${m[1]}${m[2]}`;
  return TIPOS_SANGRE_VALIDOS.has(t) ? t : '';
}

const DEFAULT_JORNADAS = [
  { idJornada: '1', descripcion: '1) DIURNA' },
  { idJornada: '2', descripcion: '2) NOCTURNA' },
  { idJornada: '3', descripcion: '3) FIN DE SEMANA' },
];
const DEFAULT_ESTADOS_CIVIL = [
  { idEstadoCivil: '1', descripcion: '1) SOLTERO' },
  { idEstadoCivil: '2', descripcion: '2) CASADO' },
  { idEstadoCivil: '3', descripcion: '3) UNIÓN LIBRE' },
  { idEstadoCivil: '4', descripcion: '4) SEPARADO' },
  { idEstadoCivil: '5', descripcion: '5) VIUDO' },
  { idEstadoCivil: '6', descripcion: '6) DIVORCIADO' },
  { idEstadoCivil: '7', descripcion: '7) SIN INFORMACIÓN' },
];

let cacheJornadaLabels = null;
let cacheEstadoCivilLabels = null;

function codigoDesdeDoc(doc, codeFields) {
  for (const f of codeFields) {
    if (doc[f] != null && doc[f] !== '') return String(doc[f]).trim();
  }
  const desc = doc.descripcion ? String(doc.descripcion).trim() : '';
  const m = desc.match(/^(\d+)/);
  return m ? m[1] : '';
}

function etiquetaDesdeDoc(doc) {
  if (doc.descripcion) return String(doc.descripcion).trim();
  if (doc.nombre) return String(doc.nombre).trim();
  return '';
}

async function buildLabelMap(model, codeFields, defaults) {
  const docs = await model.find({}).lean();
  const lista = docs.length ? docs : defaults;
  const map = new Map();

  const registrar = (codigo, etiqueta) => {
    if (!codigo || !etiqueta) return;
    const c = String(codigo).trim();
    const e = String(etiqueta).trim();
    map.set(c, e);
    const m = c.match(/^(\d+)/);
    if (m) map.set(m[1], e);
  };

  for (const doc of lista) {
    const etiqueta = etiquetaDesdeDoc(doc) || codigoDesdeDoc(doc, codeFields);
    const codigo = codigoDesdeDoc(doc, codeFields);
    if (codigo) registrar(codigo, etiqueta);
    if (doc.descripcion) registrar(String(doc.descripcion).trim(), etiqueta);
  }
  return map;
}

async function getJornadaLabels() {
  if (!cacheJornadaLabels) {
    cacheJornadaLabels = await buildLabelMap(jornadaModel, ['idJornada', 'id', 'codigo'], DEFAULT_JORNADAS);
  }
  return cacheJornadaLabels;
}

async function getEstadoCivilLabels() {
  if (!cacheEstadoCivilLabels) {
    cacheEstadoCivilLabels = await buildLabelMap(
      estadoCivilModel,
      ['idEstadoCivil', 'id', 'codigo'],
      DEFAULT_ESTADOS_CIVIL,
    );
  }
  return cacheEstadoCivilLabels;
}

function labelCatalogo(map, valor) {
  if (valor == null || valor === '') return '';
  const v = String(valor).trim();
  if (map.has(v)) return map.get(v);
  const m = v.match(/^(\d+)/);
  if (m && map.has(m[1])) return map.get(m[1]);
  return v;
}

async function aplicarArchivos(dto, files, alumnoPrev) {
  const config = await obtenerConfigRequisitosDocumentos();
  if (files?.foto?.[0]) dto.urlFoto = upload.publicUrl('alumnos', files.foto[0].filename);
  if (files?.cedula?.[0]) {
    const url = upload.publicUrl('alumnos', files.cedula[0].filename);
    dto.urlCedula = url;
    const tipo = config.tiposDocumento.find((t) => t.codigo === 'CEDULA');
    if (tipo) Object.assign(dto, patchDocsAlumno(alumnoPrev || dto, tipo.id, url, config));
  }
  if (files?.licencia?.[0]) {
    const url = upload.publicUrl('alumnos', files.licencia[0].filename);
    dto.urlLicencia = url;
    const tipo = config.tiposDocumento.find((t) => t.codigo === 'LICENCIA');
    if (tipo) Object.assign(dto, patchDocsAlumno(alumnoPrev || dto, tipo.id, url, config));
  }
}

function nombreCompleto(a) {
  const n = [a.nombre1, a.nombre2].filter(Boolean).join(' ').trim();
  const ap = [a.apellido1, a.apellido2].filter(Boolean).join(' ').trim();
  return { nombres: n, apellidos: ap, nombreCompleto: [ap, n].filter(Boolean).join(' ').trim() };
}

const SORT_ALUMNOS_KEYS = {
  fechaReg: ['fechaReg'],
  numDoc: ['numDoc'],
  nombre: ['apellido1', 'apellido2', 'nombre1', 'nombre2'],
  fechaNac: ['fechaNac'],
  jornada: ['jornada'],
  estadoCivil: ['estadoCivil'],
  correo: ['correo'],
  celular: ['celular'],
  direccion: ['direccion'],
  munOrigen: ['codMunicipio', 'munOrigen'],
};

function resolveSortAlumnos(sortRaw, dirRaw) {
  const sortKey = String(sortRaw || '').trim() || 'fechaReg';
  const dir = String(dirRaw || '').toLowerCase() === 'asc' ? 1 : -1;
  if (sortKey === 'fechaReg') {
    return { fechaReg: dir, _id: dir };
  }
  const fields = SORT_ALUMNOS_KEYS[sortKey] || SORT_ALUMNOS_KEYS.fechaReg;
  const out = {};
  for (const f of fields) out[f] = dir;
  return out;
}

function mapListaItem(doc) {
  const extra = nombreCompleto(doc);
  const codMun = doc.codMunicipio || doc.munOrigen || '';
  return {
    _id: doc._id,
    numDoc: doc.numDoc,
    tipoDoc: doc.tipoDoc,
    expedida: doc.expedida,
    nombre1: doc.nombre1,
    nombre2: doc.nombre2,
    apellido1: doc.apellido1,
    apellido2: doc.apellido2,
    nombres: extra.nombres,
    apellidos: extra.apellidos,
    nombreCompleto: extra.nombreCompleto,
    genero: doc.genero,
    fechaNac: doc.fechaNac,
    tipoSangre: doc.tipoSangre,
    jornada: doc.jornada,
    estadoCivil: doc.estadoCivil,
    estrato: doc.estrato,
    celular: doc.celular,
    correo: doc.correo,
    direccion: doc.direccion,
    munOrigen: doc.munOrigen,
    codMunicipio: codMun || undefined,
    urlFoto: doc.urlFoto,
    urlCedula: doc.urlCedula,
    urlLicencia: doc.urlLicencia,
    docsAlumno: doc.docsAlumno,
    fechaReg: doc.fechaReg || doc.fechaAudi || null,
    fechaMod: doc.fechaMod || doc.fechaAudi,
    empresaId: doc.empresaId || null,
    empresaNombre: null,
  };
}

/** Resuelve el nombre de la empresa (Cliente) para una lista de items. */
async function enriquecerEmpresas(items) {
  const ids = [...new Set(items.map((i) => String(i.empresaId || '')).filter(Boolean))];
  if (!ids.length) return items;
  const mongoose = require('mongoose');
  const clientes = await Cliente.find({
    _id: { $in: ids.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id)) },
  }, { razonSocial: 1, nombres: 1, nombreComercial: 1, identificacion: 1 }).lean();
  const map = new Map(clientes.map((c) => [String(c._id), c]));
  return items.map((it) => {
    if (!it.empresaId) return it;
    const cli = map.get(String(it.empresaId));
    if (!cli) return it;
    const nombre = cli.razonSocial?.trim() || cli.nombreComercial?.trim() || cli.nombres?.trim() || cli.identificacion || '';
    return { ...it, empresaNombre: nombre || null };
  });
}

async function enriquecerCatalogos(items) {
  const [jMap, eMap] = await Promise.all([getJornadaLabels(), getEstadoCivilLabels()]);
  return items.map((it) => ({
    ...it,
    jornadaLabel: labelCatalogo(jMap, it.jornada) || it.jornada,
    estadoCivilLabel: labelCatalogo(eMap, it.estadoCivil) || it.estadoCivil,
  }));
}

async function enriquecerMunicipios(items) {
  const codes = [
    ...new Set(
      items
        .map((i) => String(i.codMunicipio || i.munOrigen || '').trim())
        .filter(Boolean),
    ),
  ];
  if (!codes.length) return items;
  const munis = await divipola.find({ codMunicipio: { $in: codes } }).lean();
  const map = Object.fromEntries(
    munis.map((r) => [
      r.codMunicipio,
      {
        munOrigenLabel: `${r.nombreMunicipio} - ${r.nombreDepto}`,
        nombreMunicipio: r.nombreMunicipio,
        nombreDepto: r.nombreDepto,
      },
    ]),
  );
  return items.map((it) => {
    const cod = String(it.codMunicipio || it.munOrigen || '').trim();
    const m = cod ? map[cod] : null;
    return m ? { ...it, ...m } : it;
  });
}

exports.listar = async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const tipoQ = (req.query.tipoAlumno || '').toString().trim();
    const idJornada = (req.query.idJornada || '').toString().trim();
    const fechaJornada = (req.query.fechaJornada || '').toString().trim();
    const certJornada = (req.query.certJornada || '').toString().trim().toLowerCase();
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
    const condiciones = [];
    if (tipoQ) {
      condiciones.push({ tipoAlumno: normalizarTipoAlumno(tipoQ) });
    }
    if (q) {
      condiciones.push(filtroBusquedaAlumno(q));
    }

    let jornadaIds = [];
    const filtroJornadaActivo = !!(idJornada || fechaJornada);
    if (filtroJornadaActivo) {
      jornadaIds = await resolverJornadasFiltro({ idJornada, fechaJornada });
      if (!jornadaIds.length) {
        return res.json({
          items: [],
          total: 0,
          skip,
          limit,
          jornadaFiltro: { activo: true, jornadaIds: [], mensaje: 'No hay jornadas para el filtro indicado.' },
        });
      }
      let numDocs = await numDocsParticipantesJornadas(jornadaIds);
      if (certJornada === 'con' || certJornada === 'sin') {
        const conCert = new Set(await numDocsConCertificadoJornada(jornadaIds));
        numDocs =
          certJornada === 'con'
            ? numDocs.filter((nd) => conCert.has(nd))
            : numDocs.filter((nd) => !conCert.has(nd));
      }
      if (!numDocs.length) {
        return res.json({
          items: [],
          total: 0,
          skip,
          limit,
          jornadaFiltro: {
            activo: true,
            jornadaIds: jornadaIds.map(String),
            mensaje: 'No hay alumnos inscritos o con asistencia para el filtro indicado.',
          },
        });
      }
      const filtroNum = filtroAlumnosPorNumDocs(numDocs);
      if (filtroNum) condiciones.push(filtroNum);
    }

    const filter = condiciones.length === 0 ? {} : condiciones.length === 1 ? condiciones[0] : { $and: condiciones };
    const sort = resolveSortAlumnos(req.query.sort, req.query.dir);
    const [docs, total] = await Promise.all([
      DatosAlumno.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      DatosAlumno.countDocuments(filter),
    ]);
    let items = await enriquecerMunicipios(docs.map(mapListaItem));
    items = await enriquecerCatalogos(items);
    items = await enriquecerEmpresas(items);
    items = await enriquecerIndicadoresLista(items);
    if (filtroJornadaActivo && jornadaIds.length) {
      items = await enriquecerCertificadoJornada(items, jornadaIds);
    }
    const payload = { items, total, skip, limit };
    if (filtroJornadaActivo) {
      payload.jornadaFiltro = { activo: true, jornadaIds: jornadaIds.map(String) };
    }
    res.json(payload);
  } catch (e) {
    next(e);
  }
};

exports.escanearCedula = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      return res.status(400).json({ message: 'Envíe una imagen del frente de la cédula en el campo "imagen".' });
    }
    if (!/^image\//.test(file.mimetype || '')) {
      return res.status(400).json({ message: 'El archivo debe ser una imagen (JPEG, PNG, etc.).' });
    }
    const resultado = await procesarCedulaImagen(file.buffer);
    const sugerido = { ...resultado.sugerido };
    sugerido.genero = normalizarGenero(sugerido.genero);
    sugerido.tipoSangre = normalizarTipoSangre(sugerido.tipoSangre);
    if (sugerido.numDoc) sugerido.numDoc = parseNumDoc(sugerido.numDoc) ?? sugerido.numDoc;
    res.json({
      sugerido,
      meta: resultado.meta,
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.porId = async (req, res, next) => {
  try {
    const a = await buscarAlumnoPorIdParam(req.params.id);
    if (!a) return res.status(404).json({ message: 'Alumno no encontrado' });
    let empresaNombre = null;
    if (a.empresaId) {
      const cli = await Cliente.findById(a.empresaId, { razonSocial: 1, nombres: 1, nombreComercial: 1, identificacion: 1 }).lean();
      if (cli) {
        empresaNombre = cli.razonSocial?.trim() || cli.nombreComercial?.trim() || cli.nombres?.trim() || cli.identificacion || null;
      }
    }
    res.json({ ...a, empresaNombre });
  } catch (e) {
    next(e);
  }
};

/** Comprobantes / facturas recientes (alertas globales en cabecera). */
exports.comprobantesRecientes = async (req, res, next) => {
  try {
    let desde = null;
    if (req.query.desde) {
      const d = new Date(String(req.query.desde));
      if (!Number.isNaN(d.getTime())) desde = d;
    }
    const rows = await listarComprobantesRecientes(desde);
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

/** Alumnos con recordatorio de cobro programado para hoy (cajero). */
exports.alertasPagoHoy = async (req, res, next) => {
  try {
    const rows = await listarAlertasPagoHoy(new Date());
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

/** Comprobantes y factura emitidos hoy (alarmas en ficha y lista). */
exports.indicadoresHoy = async (req, res, next) => {
  try {
    const a = await buscarAlumnoPorIdParam(req.params.id);
    if (!a) return res.status(404).json({ message: 'Alumno no encontrado' });
    if (a.numDoc == null) {
      return res.json({
        comprobanteIngresoHoy: null,
        comprobanteEgresoHoy: null,
        facturaHoy: null,
      });
    }
    const map = await movimientosHoyPorAlumnos([a.numDoc]);
    const mov = map.get(claveNumDocIndicador(a.numDoc)) || {
      ingreso: null,
      egreso: null,
      factura: null,
    };
    res.json({
      comprobanteIngresoHoy: mov.ingreso,
      comprobanteEgresoHoy: mov.egreso,
      facturaHoy: mov.factura,
    });
  } catch (e) {
    next(e);
  }
};

exports.documentosRequeridos = async (req, res, next) => {
  try {
    const a = await buscarAlumnoPorIdParam(req.params.id);
    if (!a) return res.status(404).json({ message: 'Alumno no encontrado' });
    res.json(await calcularDocumentosRequeridos(a));
  } catch (e) {
    next(e);
  }
};

exports.validarDocumentos = async (req, res, next) => {
  try {
    const a = await buscarAlumnoPorIdParam(req.params.id);
    if (!a) return res.status(404).json({ message: 'Alumno no encontrado' });
    const idPrograma = req.query.idPrograma;
    if (idPrograma) {
      const val = await validarDocumentosParaPrograma(a, idPrograma);
      if (val.error) return res.status(404).json({ message: val.error });
      return res.json(val);
    }
    res.json(await validarDocumentosPendientesAlumno(a));
  } catch (e) {
    next(e);
  }
};

exports.subirDocumento = async (req, res, next) => {
  try {
    const idDoc = String(req.params.idDoc || '').trim();
    const file = req.file;
    if (!idDoc) return res.status(400).json({ message: 'Tipo de documento inválido' });
    if (!file?.filename) {
      return res.status(400).json({ message: 'Envíe el archivo en el campo "archivo"' });
    }

    const config = await obtenerConfigRequisitosDocumentos();
    const meta = config.tiposDocumento.find((t) => t.id === idDoc && t.activo !== false);
    if (!meta) return res.status(400).json({ message: 'Tipo de documento no configurado' });

    const prev = await buscarAlumnoPorIdParam(req.params.id);
    if (!prev) return res.status(404).json({ message: 'Alumno no encontrado' });

    const url = upload.publicUrl('alumnos', file.filename);
    const dto = {
      ...patchDocsAlumno(prev, idDoc, url, config),
      fechaMod: new Date(),
      userChangeRecord: req.user?.username || req.user?.sub || 'sistema',
    };

    const requeridos = await calcularDocumentosRequeridos(prev);
    const permitido = requeridos.documentos.some((d) => d.id === idDoc);
    if (!permitido) {
      return res.status(400).json({
        message: 'Este documento no es requerido según las matrículas del alumno',
      });
    }

    const a = await DatosAlumno.findByIdAndUpdate(prev._id, dto, { new: true }).lean();
    const resumen = await calcularDocumentosRequeridos(a);
    res.json({ alumno: a, ...resumen });
  } catch (e) {
    next(e);
  }
};

exports.porDocumento = async (req, res, next) => {
  try {
    const numDoc = numDocFromParams(req.params.numDoc);
    if (numDoc == null) return res.status(400).json({ message: 'numDoc inválido' });
    const a = await buscarAlumnoPorIdParam(String(numDoc));
    if (!a) return res.status(404).json({ message: 'Alumno no encontrado' });
    res.json(a);
  } catch (e) {
    next(e);
  }
};

exports.verificarDocumento = async (req, res, next) => {
  try {
    const numDoc = numDocFromParams(req.params.numDoc);
    const excludeId = req.query.excludeId;
    if (numDoc == null) return res.status(400).json({ message: 'numDoc requerido o inválido' });
    const a = await alumnoConMismoNumDoc(numDoc, excludeId || null);
    if (!a) return res.json({ existe: false });
    res.json({
      existe: true,
      _id: a._id,
      numDoc: a.numDoc,
      nombreCompleto: nombreCompleto(a).nombreCompleto,
      nombres: nombreCompleto(a).nombres,
      apellidos: nombreCompleto(a).apellidos,
    });
  } catch (e) {
    next(e);
  }
};

const CAMPOS_ALUMNO = [
  'tipoAlumno', 'tipoDoc', 'numDoc', 'expedida', 'apellido1', 'apellido2', 'nombre1', 'nombre2',
  'fechaNac', 'observaciones', 'genero', 'tipoSangre', 'jornada', 'estadoCivil', 'estrato',
  'regimenSalud', 'nivelFormacion', 'ocupacion', 'discapacidad', 'munOrigen', 'codMunicipio',
  'correo', 'direccion', 'celular', 'multiCulturalidad', 'urlFoto', 'urlCedula', 'urlLicencia',
  'duracionSesionPracticaCea', 'empresaId', 'alertaPago', 'alertaPagoFrecuencia',
];

function nombreMayusculas(v) {
  return String(v || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function coleccionAlumnos() {
  return mongoose.connection.collection('datosAlumnos');
}

/** Acepta _id Mongo o numDoc en la URL (ej. /alumnos/1007122432). */
async function buscarAlumnoPorIdParam(idParam) {
  const raw = String(idParam || '').trim();
  if (!raw) return null;

  if (mongoose.isValidObjectId(raw)) {
    const porId = await DatosAlumno.findById(raw).lean();
    if (porId) return porId;
  }

  const numDoc = parseNumDoc(raw);
  if (numDoc == null) return null;
  const filter = numDocQueryNativo(numDoc);
  if (!filter) return null;
  return coleccionAlumnos().findOne(filter);
}

function filtroNumDocExcluyendo(numDoc, excludeId) {
  const q = numDocQueryNativo(numDoc);
  if (!q) return null;
  if (!excludeId) return q;
  const id =
    excludeId instanceof mongoose.Types.ObjectId
      ? excludeId
      : mongoose.Types.ObjectId.isValid(String(excludeId))
        ? new mongoose.Types.ObjectId(String(excludeId))
        : excludeId;
  return { $and: [q, { _id: { $ne: id } }] };
}

/** Búsqueda en colección nativa: Mongoose no encuentra numDoc guardado como string. */
async function alumnoConMismoNumDoc(numDoc, excludeId = null) {
  const filter = filtroNumDocExcluyendo(numDoc, excludeId);
  if (!filter) return null;
  return coleccionAlumnos().findOne(filter);
}

function respuestaDuplicado(res, existe) {
  return res.status(409).json({
    message: 'Ya existe un alumno con ese número de documento',
    existingId: existe._id,
    numDoc: existe.numDoc,
    ...nombreCompleto(existe),
  });
}

function pickAlumno(body) {
  const dto = {};
  for (const k of CAMPOS_ALUMNO) {
    if (body[k] !== undefined && body[k] !== '') dto[k] = body[k];
  }
  for (const k of ['apellido1', 'apellido2', 'nombre1', 'nombre2']) {
    if (dto[k]) dto[k] = nombreMayusculas(dto[k]);
  }
  // codMunicipio debe coincidir con munOrigen (código divipola)
  if (dto.munOrigen) dto.codMunicipio = String(dto.munOrigen).trim();
  else if (dto.codMunicipio) dto.munOrigen = String(dto.codMunicipio).trim();
  if (dto.numDoc != null && dto.numDoc !== '') {
    const nd = parseNumDoc(dto.numDoc);
    if (nd != null) dto.numDoc = nd;
  }
  if (body.tipoAlumno !== undefined || dto.tipoAlumno !== undefined) {
    dto.tipoAlumno = normalizarTipoAlumno(dto.tipoAlumno);
  }
  if (body.alertaPagoFrecuencia) dto.alertaPagoFrecuencia = body.alertaPagoFrecuencia;
  if (body.alertaPago) dto.alertaPago = body.alertaPago;
  if (dto.fechaNac) dto.fechaNac = new Date(dto.fechaNac);
  normalizarAlertaPagoEnDto(dto);
  return dto;
}

exports.crear = async (req, res, next) => {
  try {
    const body = req.body;
    const dto = pickAlumno(body);
    if (dto.numDoc == null || !dto.nombre1 || !dto.apellido1) {
      return res.status(400).json({ message: 'Documento, primer nombre y primer apellido son obligatorios' });
    }
    dto.numDoc = parseNumDoc(dto.numDoc);
    if (dto.numDoc == null) {
      return res.status(400).json({ message: numDocInvalidMessage() });
    }
    const existe = await alumnoConMismoNumDoc(dto.numDoc);
    if (existe) return respuestaDuplicado(res, existe);

    await aplicarArchivos(dto, req.files);
    const now = new Date();
    dto.fechaReg = dto.fechaReg ? new Date(dto.fechaReg) : now;
    dto.fechaAudi = now;
    dto.fechaMod = now;
    dto.userAddReg = dto.userAddReg || req.user?.username || req.user?.sub || 'sistema';
    if (dto.fechaNac) dto.fechaNac = new Date(dto.fechaNac);
    const esJornadaCap =
      body.esJornadaCap === true ||
      body.esJornadaCap === 'true' ||
      body.esJornadaCap === '1' ||
      body.esJornadaCap === 1;
    dto.tipoAlumno =
      body.tipoAlumno !== undefined && body.tipoAlumno !== ''
        ? normalizarTipoAlumno(body.tipoAlumno)
        : esJornadaCap
          ? TIPO_JORNADAS_CAPACITACION
          : TIPO_ALUMNO_DEFAULT;

    let a;
    try {
      a = await DatosAlumno.create(dto);
    } catch (err) {
      if (err?.code === 11000) {
        const dup = await alumnoConMismoNumDoc(dto.numDoc);
        if (dup) return respuestaDuplicado(res, dup);
      }
      throw err;
    }
    res.status(201).json(a);
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const prev = await buscarAlumnoPorIdParam(req.params.id);
    if (!prev) return res.status(404).json({ message: 'Alumno no encontrado' });
    const body = req.body;
    const dto = pickAlumno(body);
    if (dto.numDoc != null) {
      dto.numDoc = parseNumDoc(dto.numDoc);
      if (dto.numDoc == null) {
        return res.status(400).json({ message: numDocInvalidMessage() });
      }
      const dup = await alumnoConMismoNumDoc(dto.numDoc, prev._id);
      if (dup) return respuestaDuplicado(res, dup);
    }
    await aplicarArchivos(dto, req.files, prev);
    dto.fechaMod = new Date();
    dto.userChangeRecord = dto.userChangeRecord || req.user?.username || req.user?.sub || 'sistema';
    if (dto.fechaNac) dto.fechaNac = new Date(dto.fechaNac);

    const unset = {};
    if (
      body.alertaPagoFrecuencia === ''
      || body.alertaPago === ''
      || (body.alertaPagoFrecuencia == null && body.alertaPago == null
        && ('alertaPagoFrecuencia' in body || 'alertaPago' in body))
    ) {
      unset.alertaPagoFrecuencia = '';
      unset.alertaPago = '';
      delete dto.alertaPagoFrecuencia;
      delete dto.alertaPago;
    }

    const op = { $set: dto };
    if (Object.keys(unset).length) op.$unset = unset;

    const a = await DatosAlumno.findByIdAndUpdate(prev._id, op, { new: true });
    res.json(a);
  } catch (e) {
    next(e);
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    if (!esAdmin(req.user?.rol)) {
      return res.status(403).json({ message: 'Solo un administrador puede eliminar alumnos' });
    }
    const prev = await buscarAlumnoPorIdParam(req.params.id);
    if (!prev) return res.status(404).json({ message: 'Alumno no encontrado' });
    const r = await DatosAlumno.findByIdAndDelete(prev._id);
    if (!r) return res.status(404).json({ message: 'Alumno no encontrado' });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
