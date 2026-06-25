const Certificado = require('../models/Certificado');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const PlantillaCertificado = require('../models/PlantillaCertificado');
const Liquidacion = require('../models/Liquidacion');
const DatosAlumno = require('../models/DatosAlumno');
const Cliente = require('../models/Cliente');
const { normalizarTipoRegularJornada } = require('../constants/tipoRegularJornada');
const { models: cat } = require('../models/catalogos');
const { obtenerConfigCertificado, siguienteCodigoCertificado, normalizeDiasAvisoCert, DEFAULT_DIAS_AVISO_POR_VENCER, DEFAULT_DIAS_AVISO_VENCIDO } = require('../services/configCertificado');
const { reglaPorClave } = require('../services/configAlertas');
const { buscarPrograma } = require('../services/programaServicio');
const { parseNumDoc, numDocFromParams, numDocEquals, numDocQuery } = require('../utils/numDoc');
const { coincideBusquedaAlumno, coincideBusquedaTexto, coincideBusquedaDocumento, filtroBusquedaAlumno } = require('../utils/busquedaAlumnoNombre');
const { regexSinTildes } = require('../utils/regexSinTildes');
const {
  clasificarProgramaAsync,
  orientacionPorTipo,
  TIPOS,
  TIPOS_LABEL,
} = require('../services/clasificacionCertificado');
const { resolverPlantillaImpresion } = require('../services/plantillaCertificado');

const { TIPO_JORNADAS_CAPACITACION } = require('../constants/tipoRegularJornada');
const { esProgramaJornadasCap } = require('../services/jornadaCapacitacion');
const {
  autorizarAnulacionSimple,
  metadatosAnulacion,
  sufijoAutoriza,
} = require('../services/anulacionComprobante');
const { esComprobanteAnulado } = require('../utils/comprobanteEstado');
const { registrarEliminacion } = require('../services/auditoria');

function tipoCertCategoria(tipoFormato, alumno) {
  if (tipoFormato === TIPOS.JORNADA_CAPACITACION) return TIPO_JORNADAS_CAPACITACION;
  return normalizarTipoRegularJornada(alumno?.tipoAlumno);
}

/** Certificados emitidos por jornadas de capacitación (gestión aparte). */
function esCertificadoJornadaCapacitacion(cert) {
  if (!cert) return false;
  if (cert.generadoAutoJornada) return true;
  if (cert.idJornada) return true;
  if (cert.tipoFormatoCert === TIPOS.JORNADA_CAPACITACION) return true;
  return false;
}

function filtrosExcluirJornadaCapacitacion() {
  return {
    generadoAutoJornada: { $ne: true },
    tipoFormatoCert: { $ne: TIPOS.JORNADA_CAPACITACION },
    $or: [{ idJornada: null }, { idJornada: { $exists: false } }],
  };
}

/** Programas cuyo certificado lo emite el cierre automático de jornada — no manual en ficha alumno. */
async function esProgramaCertificadoJornadaAuto(prog, tipoFormato) {
  if (tipoFormato === TIPOS.JORNADA_CAPACITACION) return true;
  return esProgramaJornadasCap(prog);
}
function num(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
  return Number(v) || 0;
}

async function resolverPlantilla(prog, config, idPlantillaManual, tipoFormato) {
  if (idPlantillaManual) {
    const p = await PlantillaCertificado.findById(idPlantillaManual).lean();
    if (p && p.activa !== false) return p;
  }
  const tipo =
    tipoFormato || (await clasificarProgramaAsync(prog, cat.catTipoCapacitacion));
  return resolverPlantillaImpresion(config, tipo, null);
}

exports.tiposCertificado = async (_req, res) => {
  res.json(
    Object.values(TIPOS).map((id) => ({
      id,
      label: TIPOS_LABEL[id],
    })),
  );
};

async function programaPorId(idProg) {
  return buscarPrograma(idProg);
}

async function descrPrograma(idProg) {
  const p = await programaPorId(idProg);
  return p?.descripcion || p?.nombreProg || p?.nomCert || null;
}

function encabezadoCurso(prog) {
  return (prog?.nomCert || prog?.descripcion || prog?.nombreProg || '').trim();
}

exports.elegibles = async (req, res, next) => {
  try {
    const numDoc = numDocFromParams(req.params.numDoc);
    if (numDoc == null) return res.status(400).json({ message: 'numDoc inválido' });
    const q = numDocQuery(numDoc);
    const liqs = await Liquidacion.find({ $and: [q, { idProg: { $ne: null } }] }).lean();
    const certs = await Certificado.find(q).lean();
    const certIds = new Set(certs.map((c) => String(c.idLiquidacion)));

    const out = [];
    for (const it of liqs) {
      const saldo = num(it.saldo);
      if (saldo > 0.0001) continue;
      if (certIds.has(String(it._id))) continue;
      const prog = await programaPorId(it.idProg);
      const tipoFormato = await clasificarProgramaAsync(prog, cat.catTipoCapacitacion);
      if (await esProgramaCertificadoJornadaAuto(prog, tipoFormato)) continue;
      const cfg = await obtenerConfigCertificado();
      const plantillaSug = await resolverPlantilla(prog, cfg, null, tipoFormato);
      const alumno = await DatosAlumno.findOne(numDocQuery(numDoc)).lean();
      const tipoCert = tipoCertCategoria(tipoFormato, alumno);
      out.push({
        ...it,
        valor: num(it.valor),
        abonado: num(it.abonado),
        saldo,
        programaDescr: prog?.descripcion || prog?.nombreProg || null,
        nomCert: prog?.nomCert || null,
        horas: prog?.horas != null ? Number(prog.horas) : null,
        tipoFormatoCert: tipoFormato,
        tipoFormatoCertLabel: TIPOS_LABEL[tipoFormato],
        tipoCertificado: tipoCert,
        formatoOrientacion: plantillaSug?.orientacion || orientacionPorTipo(cfg, tipoFormato),
        plantillaSugeridaId: plantillaSug?._id ? String(plantillaSug._id) : null,
        plantillaSugeridaNombre: plantillaSug?.nombre || null,
        tieneFormato: !!plantillaSug,
      });
    }
    res.json(out);
  } catch (e) {
    next(e);
  }
};

exports.listarPorAlumno = async (req, res, next) => {
  try {
    const numDoc = numDocFromParams(req.params.numDoc);
    if (numDoc == null) return res.status(400).json({ message: 'numDoc inválido' });
    const certs = await Certificado.find(numDocQuery(numDoc)).sort({ fechaEmision: -1 }).lean();
    const out = [];
    for (const c of certs) {
      const descr = await descrPrograma(c.idProg);
      const prog = await programaPorId(c.idProg);
      out.push({
        ...c,
        programaDescr: descr,
        nomCert: prog?.nomCert || null,
      });
    }
    res.json(out);
  } catch (e) {
    next(e);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const { numDoc: numDocRaw, idLiquidacion, idPlantilla, numActa, numFolio, numRunt, observaciones, fechaEmision } =
      req.body || {};
    const numDoc = parseNumDoc(numDocRaw);
    if (numDoc == null || !idLiquidacion) {
      return res.status(400).json({ message: 'numDoc e idLiquidacion son obligatorios' });
    }
    const liq = await Liquidacion.findById(idLiquidacion);
    if (!liq) return res.status(404).json({ message: 'Item de liquidación no encontrado' });
    if (!numDocEquals(liq.numDoc, numDoc)) return res.status(400).json({ message: 'No corresponde al alumno' });
    if (!liq.idProg) return res.status(400).json({ message: 'El ítem no es de un programa educativo' });
    if (num(liq.saldo) > 0.0001) return res.status(400).json({ message: 'El programa no está totalmente pagado' });

    const dup = await Certificado.findOne({ idLiquidacion });
    if (dup) return res.status(409).json({ message: 'Ya existe un certificado para este programa' });

    const cfg = await obtenerConfigCertificado();
    const prog = await programaPorId(liq.idProg);
    const tipoFormato = await clasificarProgramaAsync(prog, cat.catTipoCapacitacion);
    if (await esProgramaCertificadoJornadaAuto(prog, tipoFormato)) {
      return res.status(403).json({
        message:
          'Los certificados de jornadas de capacitación se generan automáticamente al cumplir las sesiones de la jornada.',
      });
    }
    const plantilla = await resolverPlantilla(prog, cfg, idPlantilla, tipoFormato);
    if (!plantilla) {
      return res.status(400).json({
        message: `No hay plantilla de certificado para «${TIPOS_LABEL[tipoFormato]}». Configúrela en Config. Certificados.`,
      });
    }

    const alumno = await DatosAlumno.findOne(numDocQuery(numDoc)).lean();
    const tipoCert = tipoCertCategoria(tipoFormato, alumno);

    const fechaEm = fechaEmision ? parseFechaLocal(fechaEmision) || new Date(fechaEmision) : new Date();
    let fechaVe = null;
    const dias = Number(prog?.diasVencimiento || prog?.vigenciaDias || 0);
    if (dias > 0) fechaVe = new Date(fechaEm.getTime() + dias * 24 * 60 * 60 * 1000);

    const codigoCert = await siguienteCodigoCertificado();
    const encabezado = encabezadoCurso(prog);

    // Empresa del alumno al momento de emitir
    let empresaId   = null;
    let empresaNombre = null;
    if (alumno?.empresaId) {
      empresaId = alumno.empresaId;
      const cli = await Cliente.findById(empresaId, { razonSocial: 1, nombres: 1, nombreComercial: 1, identificacion: 1 }).lean();
      if (cli) {
        empresaNombre = (cli.razonSocial?.trim() || cli.nombreComercial?.trim() || cli.nombres?.trim() || cli.identificacion || null);
      }
    }

    const cert = await Certificado.create({
      numDoc,
      idLiquidacion: liq._id,
      idProg: liq.idProg,
      codigoCert,
      encabezado,
      idPlantilla: plantilla._id,
      orientacion: plantilla.orientacion || 'vertical',
      tipoFormatoCert: tipoFormato,
      tipoCertificado: tipoCert,
      numActa,
      numFolio,
      numRunt,
      observaciones,
      fechaEmision: fechaEm,
      fechaVencimiento: fechaVe,
      empresaId,
      empresaNombre,
    });
    const descr = await descrPrograma(cert.idProg);
    res.status(201).json({
      ...cert.toObject(),
      programaDescr: descr,
      nomCert: prog?.nomCert || null,
      encabezado,
      tipoFormatoCert: tipoFormato,
      tipoFormatoCertLabel: TIPOS_LABEL[tipoFormato],
      tipoCertificado: tipoCert,
    });
  } catch (e) {
    next(e);
  }
};

function nombreCompletoAlumno(al) {
  if (!al) return '';
  const ap = [al.apellido1, al.apellido2].filter(Boolean).join(' ').trim();
  const n = [al.nombre1, al.nombre2].filter(Boolean).join(' ').trim();
  return [ap, n].filter(Boolean).join(' ').trim();
}

/** Nombre en listados: alumno → titular migrado → documento. */
function nombreMostrarCertificado(c, al) {
  const deAlumno = nombreCompletoAlumno(al);
  if (deAlumno) return deAlumno;
  const titular = String(c?.nombreTitular || '').trim();
  if (titular) return titular;
  if (c?.numDoc != null) return `Doc ${c.numDoc}`;
  return '';
}

function nombreClienteEmpresa(cli) {
  if (!cli) return null;
  return (
    cli.razonSocial?.trim()
    || cli.nombreComercial?.trim()
    || cli.nombres?.trim()
    || cli.identificacion
    || null
  );
}

async function filtroBusquedaVencidos(qRaw) {
  const q = String(qRaw || '').trim();
  if (!q) return null;

  const or = [
    { codigoCert: regexSinTildes(q) },
    { encabezado: regexSinTildes(q) },
    { nombreTitular: regexSinTildes(q) },
    { empresaNombre: regexSinTildes(q) },
    { codVerificacion: regexSinTildes(q) },
  ];

  const nd = parseNumDoc(q);
  if (nd != null) or.push({ numDoc: nd });

  const digits = q.replace(/\D/g, '');
  if (digits.length >= 3) {
    or.push({
      $expr: {
        $regexMatch: { input: { $toString: '$numDoc' }, regex: digits },
      },
    });
  }

  const filtroAl = filtroBusquedaAlumno(q);
  if (filtroAl) {
    const alumnos = await DatosAlumno.find(filtroAl).select('numDoc').limit(800).lean();
    const docs = [...new Set(alumnos.map((a) => a.numDoc).filter((n) => n != null))];
    if (docs.length) or.push({ numDoc: { $in: docs } });
  }

  return { $or: or };
}

async function queryBaseVencidos(req) {
  const base = {
    ...filtrosExcluirJornadaCapacitacion(),
    estado: 'vencido',
  };
  const andParts = [base];

  const tipoFmt = String(req.query.tipoFormatoCert || '').trim();
  if (tipoFmt) base.tipoFormatoCert = tipoFmt;

  const empresaIdParam = String(req.query.empresaId || '').trim();
  if (empresaIdParam && mongoose.isValidObjectId(empresaIdParam)) {
    const oid = new mongoose.Types.ObjectId(empresaIdParam);
    const alumnosEmp = await DatosAlumno.find({ empresaId: oid }).select('numDoc').limit(8000).lean();
    const docs = [...new Set(alumnosEmp.map((a) => a.numDoc).filter((n) => n != null))];
    const empresaOr = [{ empresaId: oid }];
    if (docs.length) empresaOr.push({ numDoc: { $in: docs } });
    andParts.push({ $or: empresaOr });
  }

  const desdeParam = String(req.query.vencimientoDesde || '').trim();
  const hastaParam = String(req.query.vencimientoHasta || '').trim();
  if (desdeParam || hastaParam) {
    base.fechaVencimiento = {};
    if (desdeParam) {
      const d = parseFechaLocal(desdeParam);
      if (d) {
        d.setHours(0, 0, 0, 0);
        base.fechaVencimiento.$gte = d;
      }
    }
    if (hastaParam) {
      const d = parseFechaLocal(hastaParam);
      if (d) {
        d.setHours(23, 59, 59, 999);
        base.fechaVencimiento.$lte = d;
      }
    }
    if (!Object.keys(base.fechaVencimiento).length) delete base.fechaVencimiento;
  }

  const busqueda = await filtroBusquedaVencidos(req.query.q);
  if (busqueda) andParts.push(busqueda);
  if (andParts.length === 1) return base;
  return { $and: andParts };
}

async function mapearFilasVencidos(rows) {
  const numDocs = [...new Set(rows.map((c) => c.numDoc).filter((n) => n != null))];
  const idProgs = [...new Set(rows.map((c) => String(c.idProg || '')).filter(Boolean))];

  const [alumnosRows, programas] = await Promise.all([
    numDocs.length
      ? DatosAlumno.find({ numDoc: { $in: numDocs } })
        .select('numDoc empresaId apellido1 apellido2 nombre1 nombre2 expedida')
        .lean()
      : [],
    idProgs.length ? cat.programas.find({ idProg: { $in: idProgs } }).lean() : [],
  ]);

  const alByDoc = new Map(alumnosRows.map((a) => [a.numDoc, a]));
  const progById = new Map(programas.map((p) => [String(p.idProg), p]));

  const empresaIds = new Set();
  for (const c of rows) {
    const al = alByDoc.get(c.numDoc);
    const eid = c.empresaId || al?.empresaId;
    if (eid && mongoose.isValidObjectId(String(eid))) empresaIds.add(String(eid));
  }

  const clientes = empresaIds.size
    ? await Cliente.find(
      { _id: { $in: [...empresaIds].map((id) => new mongoose.Types.ObjectId(id)) } },
      { razonSocial: 1, nombres: 1, nombreComercial: 1, identificacion: 1 },
    ).lean()
    : [];
  const cliById = new Map(clientes.map((cl) => [String(cl._id), cl]));

  return rows.map((c) => {
    const al = alByDoc.get(c.numDoc);
    const prog = c.idProg ? progById.get(String(c.idProg)) : null;
    const empresaIdRaw = c.empresaId || al?.empresaId || null;
    const empresaId = empresaIdRaw ? String(empresaIdRaw) : null;
    let empresaNombre = String(c.empresaNombre || '').trim() || null;
    if (!empresaNombre && empresaId) {
      empresaNombre = nombreClienteEmpresa(cliById.get(empresaId));
    }
    return {
      ...c,
      _id: String(c._id),
      alumnoId: al?._id ? String(al._id) : null,
      nombreCompleto: nombreMostrarCertificado(c, al),
      expedida: (al?.expedida || '').trim() || null,
      programaDescr: prog?.descripcion || prog?.nombreProg || null,
      nomCert: prog?.nomCert || null,
      tipoFormatoCertLabel: TIPOS_LABEL[c.tipoFormatoCert] || c.tipoFormatoCert || null,
      empresaId,
      empresaNombre,
    };
  });
}

function ymdExport(val) {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CO');
}

function diasDesdeVencimientoExport(iso) {
  if (!iso) return '';
  const fv = new Date(iso);
  fv.setHours(0, 0, 0, 0);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diff = Math.floor((hoy.getTime() - fv.getTime()) / 86400000);
  if (diff < 0) return '';
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'ayer';
  return `hace ${diff} días`;
}

function ymdLocalDate(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Día civil YYYY-MM-DD sin desfase UTC (fechas guardadas a medianoche UTC). */
function ymdCalendario(val) {
  if (val == null || val === '') return '';
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getUTCHours();
  const min = d.getUTCMinutes();
  const sec = d.getUTCSeconds();
  const ms = d.getUTCMilliseconds();
  if ((h === 0 || h === 12) && min === 0 && sec === 0 && ms === 0) {
    return d.toISOString().slice(0, 10);
  }
  return ymdLocalDate(d);
}

function esFechaEmisionHoy(fechaEmision) {
  return ymdCalendario(fechaEmision) === ymdLocalDate(new Date());
}

function inicioDia(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function finDia(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Interpreta YYYY-MM-DD en hora local (evita desfase UTC al guardar). */
function parseFechaLocal(val) {
  if (val == null || val === '') return null;
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function noCache(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
}

function diasHastaVencimiento(fechaVencimiento, ref = new Date()) {
  if (!fechaVencimiento) return null;
  const fin = finDia(fechaVencimiento);
  const hoy = inicioDia(ref);
  const diffMs = fin.getTime() - hoy.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

function nivelUrgenciaPorVencer(diasRestantes) {
  if (diasRestantes == null) return 'aviso';
  if (diasRestantes <= 0) return 'hoy';
  if (diasRestantes <= 3) return 'critico';
  if (diasRestantes <= 7) return 'urgente';
  if (diasRestantes <= 10) return 'proximo';
  return 'aviso';
}

function mapAlertaPorVencerItem(c, al) {
  const diasRestantes = diasHastaVencimiento(c.fechaVencimiento);
  return {
    _id: String(c._id),
    codigoCert: c.codigoCert || null,
    numDoc: c.numDoc,
    alumnoId: al?._id ? String(al._id) : null,
    nombreCompleto: nombreMostrarCertificado(c, al),
    celular: al?.celular || null,
    encabezado: c.encabezado || null,
    tipoFormatoCert: c.tipoFormatoCert || null,
    tipoFormatoCertLabel: TIPOS_LABEL[c.tipoFormatoCert] || c.tipoFormatoCert || null,
    fechaEmision: c.fechaEmision,
    fechaVencimiento: c.fechaVencimiento,
    diasRestantes,
    nivelUrgencia: nivelUrgenciaPorVencer(diasRestantes),
  };
}

function mapAlertaVencidoItem(c, al) {
  const diasRestantes = diasHastaVencimiento(c.fechaVencimiento);
  const diasVencidos = diasRestantes != null && diasRestantes < 0 ? Math.abs(diasRestantes) : 0;
  return {
    _id: String(c._id),
    codigoCert: c.codigoCert || null,
    numDoc: c.numDoc,
    alumnoId: al?._id ? String(al._id) : null,
    nombreCompleto: nombreMostrarCertificado(c, al),
    celular: al?.celular || null,
    encabezado: c.encabezado || null,
    tipoFormatoCert: c.tipoFormatoCert || null,
    tipoFormatoCertLabel: TIPOS_LABEL[c.tipoFormatoCert] || c.tipoFormatoCert || null,
    fechaEmision: c.fechaEmision,
    fechaVencimiento: c.fechaVencimiento,
    diasRestantes,
    diasVencidos,
    nivelUrgencia: 'vencido',
  };
}

function claveNumDocCert(numDoc) {
  const n = parseNumDoc(numDoc);
  return n != null ? n : numDoc;
}

async function alumnosPorCertificados(rows) {
  const numDocs = [...new Set(rows.map((c) => claveNumDocCert(c.numDoc)).filter((n) => n != null))];
  if (!numDocs.length) return new Map();
  const valores = [];
  const seen = new Set();
  for (const nd of numDocs) {
    const n = parseNumDoc(nd);
    if (n == null) continue;
    for (const v of [n, String(n)]) {
      const key = `${typeof v}:${v}`;
      if (!seen.has(key)) {
        seen.add(key);
        valores.push(v);
      }
    }
  }
  if (!valores.length) return new Map();
  const alumnos = await DatosAlumno.find({ numDoc: { $in: valores } })
    .select('_id numDoc nombre1 nombre2 apellido1 apellido2 celular')
    .lean();
  const alByDoc = new Map();
  for (const a of alumnos) {
    const k = claveNumDocCert(a.numDoc);
    if (k != null) alByDoc.set(k, a);
  }
  return alByDoc;
}

async function diasVentanaPorVencer(req) {
  const diasQuery = req?.query?.dias != null ? parseInt(req.query.dias, 10) : null;
  if (diasQuery != null && diasQuery > 0 && diasQuery <= 90) return diasQuery;
  const regla = await reglaPorClave('alarmas.certificados.vencimiento');
  const d = Number(regla?.diasAntelacion) || 0;
  if (d > 0) return Math.min(d, 90);
  const cfg = await obtenerConfigCertificado();
  return normalizeDiasAvisoCert(cfg.diasAvisoCertificadoPorVencer, DEFAULT_DIAS_AVISO_POR_VENCER, 60);
}

async function diasVentanaVencidos(req) {
  const diasQuery = req?.query?.dias != null ? parseInt(req.query.dias, 10) : null;
  if (diasQuery != null && diasQuery > 0 && diasQuery <= 30) return diasQuery;
  const regla = await reglaPorClave('alarmas.certificados.vencidos');
  const d = Number(regla?.diasGracia) || 0;
  if (d > 0) return Math.min(d, 30);
  const cfg = await obtenerConfigCertificado();
  return normalizeDiasAvisoCert(cfg.diasAvisoCertificadoVencido, DEFAULT_DIAS_AVISO_VENCIDO, 30);
}

/** Certificados por vencer: ventana configurable; termina el día del vencimiento. */
exports.alertasPorVencer = async (req, res, next) => {
  try {
    const diasVentana = await diasVentanaPorVencer(req);
    const hoy = inicioDia();
    const limite = finDia(new Date(hoy.getTime() + diasVentana * 24 * 60 * 60 * 1000));

    const rows = await Certificado.find({
      ...filtrosExcluirJornadaCapacitacion(),
      fechaVencimiento: { $ne: null, $gte: hoy, $lte: limite },
      estado: 'vigente',
    })
      .sort({ fechaVencimiento: 1 })
      .limit(200)
      .lean();

    const alByDoc = await alumnosPorCertificados(rows);
    const items = [];
    let venceHoy = 0;
    let venceManana = 0;
    let critico = 0;
    let urgente = 0;

    for (const c of rows) {
      const al = alByDoc.get(claveNumDocCert(c.numDoc));
      const item = mapAlertaPorVencerItem(c, al);
      const { diasRestantes } = item;
      if (diasRestantes == null || diasRestantes < 0 || diasRestantes > diasVentana) continue;

      if (diasRestantes <= 0) venceHoy += 1;
      else if (diasRestantes === 1) venceManana += 1;
      if (diasRestantes <= 3) critico += 1;
      if (diasRestantes <= 7) urgente += 1;

      items.push(item);
    }

    res.json({
      total: items.length,
      diasVentana,
      venceHoy,
      venceManana,
      critico,
      urgente,
      items,
    });
  } catch (e) {
    next(e);
  }
};

/** Certificados ya vencidos: alerta configurable días después del vencimiento. */
exports.alertasVencidos = async (req, res, next) => {
  try {
    const diasVentana = await diasVentanaVencidos(req);
    const hoy = inicioDia();
    const desdeVencido = inicioDia(new Date(hoy.getTime() - diasVentana * 24 * 60 * 60 * 1000));

    const rows = await Certificado.find({
      ...filtrosExcluirJornadaCapacitacion(),
      fechaVencimiento: { $ne: null, $gte: desdeVencido, $lt: hoy },
      estado: { $ne: 'anulado' },
    })
      .sort({ fechaVencimiento: -1 })
      .limit(200)
      .lean();

    const alByDoc = await alumnosPorCertificados(rows);
    const items = [];

    for (const c of rows) {
      const al = alByDoc.get(claveNumDocCert(c.numDoc));
      const item = mapAlertaVencidoItem(c, al);
      const { diasVencidos } = item;
      if (!diasVencidos || diasVencidos < 1 || diasVencidos > diasVentana) continue;
      items.push(item);
    }

    res.json({
      total: items.length,
      diasVentana,
      items,
    });
  } catch (e) {
    next(e);
  }
};

/** @deprecated Use alertasPorVencer */
exports.alertasVencimiento = exports.alertasPorVencer;

/** Listado global de certificados emitidos (filtros por tipo, fechas y búsqueda). */
exports.listarGlobal = async (req, res, next) => {
  try {
    const q = { ...filtrosExcluirJornadaCapacitacion() };
    const tipoFmt = String(req.query.tipoFormatoCert || req.query.tipo || '').trim();
    if (tipoFmt) q.tipoFormatoCert = tipoFmt;

    const estadoParam = String(req.query.estado || '').trim().toLowerCase();
    if (estadoParam === 'vencido' || estadoParam === 'vigente' || estadoParam === 'anulado') {
      q.estado = estadoParam;
    }

    const empresaIdParam = String(req.query.empresaId || '').trim();
    if (empresaIdParam && require('mongoose').isValidObjectId(empresaIdParam)) {
      q.empresaId = new (require('mongoose').Types.ObjectId)(empresaIdParam);
    }

    if (req.query.desde || req.query.hasta) {
      q.fechaEmision = {};
      if (req.query.desde) {
        const d = parseFechaLocal(String(req.query.desde));
        if (d) {
          d.setHours(0, 0, 0, 0);
          q.fechaEmision.$gte = d;
        }
      }
      if (req.query.hasta) {
        const d = parseFechaLocal(String(req.query.hasta));
        if (d) {
          d.setHours(23, 59, 59, 999);
          q.fechaEmision.$lte = d;
        }
      }
      if (!Object.keys(q.fechaEmision).length) delete q.fechaEmision;
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
    const page  = Math.max(Number(req.query.page) || 1, 1);
    const skip  = (page - 1) * limit;

    const [total, rows] = await Promise.all([
      Certificado.countDocuments(q),
      Certificado.find(q).sort({ fechaEmision: -1 }).skip(skip).limit(limit).lean(),
    ]);
    const qRaw = String(req.query.q || '').trim();

    const numDocs = [...new Set(rows.map((c) => c.numDoc).filter((n) => n != null))];
    const jornadaIds = [...new Set(rows.map((c) => String(c.idJornada || '')).filter(Boolean))];
    const contratoIds = new Set(rows.map((c) => String(c.idContrato || '')).filter(Boolean));
    const idProgs = [...new Set(rows.map((c) => String(c.idProg || '')).filter(Boolean))];

    const JornadaCap = require('../models/JornadaCap');
    const Contratacion = require('../models/Contratacion');

    const [alumnosRows, jornadas, programas] = await Promise.all([
      numDocs.length ? DatosAlumno.find({ numDoc: { $in: numDocs } }).lean() : [],
      jornadaIds.length
        ? JornadaCap.find({ _id: { $in: jornadaIds } }).select('municipio direccion idContrato').lean()
        : [],
      idProgs.length ? cat.programas.find({ idProg: { $in: idProgs } }).lean() : [],
    ]);

    for (const j of jornadas) {
      if (j.idContrato) contratoIds.add(String(j.idContrato));
    }

    const contratos = contratoIds.size
      ? await Contratacion.find({ _id: { $in: [...contratoIds] } }).select('codContrato').lean()
      : [];

    const alByDoc = new Map(alumnosRows.map((a) => [a.numDoc, a]));
    const jornById = new Map(jornadas.map((j) => [String(j._id), j]));
    const contrById = new Map(contratos.map((c) => [String(c._id), c]));
    const progById = new Map(programas.map((p) => [String(p.idProg), p]));

    const items = [];

    for (const c of rows) {
      const al = alByDoc.get(c.numDoc);
      const nombreCompleto = nombreCompletoAlumno(al);
      const jornada = c.idJornada ? jornById.get(String(c.idJornada)) : null;
      const idContrato = c.idContrato || jornada?.idContrato;
      const codContrato = (contrById.get(String(idContrato || ''))?.codContrato || '').trim();
      const municipio = (jornada?.municipio || '').trim();
      const direccion = (jornada?.direccion || '').trim();
      const ubicacionJornada =
        municipio && direccion ? `${municipio} — ${direccion}` : municipio || direccion || '';
      const prog = c.idProg ? progById.get(String(c.idProg)) : null;

      if (qRaw) {
        const hay =
          (al && coincideBusquedaAlumno(al, qRaw)) ||
          coincideBusquedaTexto(nombreCompleto, qRaw) ||
          coincideBusquedaTexto(String(c.encabezado || ''), qRaw) ||
          coincideBusquedaTexto(String(c.codigoCert || ''), qRaw) ||
          coincideBusquedaTexto(String(c.codVerificacion || ''), qRaw) ||
          coincideBusquedaTexto(TIPOS_LABEL[c.tipoFormatoCert] || '', qRaw) ||
          coincideBusquedaDocumento(c.numDoc, qRaw) ||
          coincideBusquedaTexto(codContrato, qRaw) ||
          coincideBusquedaTexto(ubicacionJornada, qRaw);
        if (!hay) continue;
      }

      items.push({
        ...c,
        alumnoId: al?._id ? String(al._id) : null,
        nombreCompleto,
        expedida: (al?.expedida || '').trim() || null,
        programaDescr: prog?.descripcion || prog?.nombreProg || null,
        nomCert: prog?.nomCert || null,
        tipoFormatoCertLabel: TIPOS_LABEL[c.tipoFormatoCert] || c.tipoFormatoCert || null,
        codContrato: codContrato || null,
        municipio: municipio || null,
        direccion: direccion || null,
        ubicacionJornada: ubicacionJornada || null,
        empresaId: c.empresaId ? String(c.empresaId) : null,
        empresaNombre: c.empresaNombre || null,
      });
    }

    const emitidosHoy = items.filter((c) => esFechaEmisionHoy(c.fechaEmision)).length;
    const totalPages  = Math.ceil(total / limit) || 1;

    noCache(res);
    res.json({ total, page, limit, totalPages, emitidosHoy, items });
  } catch (e) {
    next(e);
  }
};

/** Certificados vencidos paginados — para la vista dedicada. */
exports.listarVencidos = async (req, res, next) => {
  try {
    const q = await queryBaseVencidos(req);

    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const [total, rows] = await Promise.all([
      Certificado.countDocuments(q),
      Certificado.find(q).sort({ fechaVencimiento: -1 }).skip(skip).limit(limit).lean(),
    ]);

    const items = await mapearFilasVencidos(rows);

    noCache(res);
    res.json({ total, page, limit, totalPages: Math.ceil(total / limit) || 1, items });
  } catch (e) {
    next(e);
  }
};

/** Exportar certificados vencidos filtrados a Excel. */
exports.exportarVencidos = async (req, res, next) => {
  try {
    const q = await queryBaseVencidos(req);
    const max = 15000;
    const total = await Certificado.countDocuments(q);
    if (total > max) {
      return res.status(400).json({
        message: `Hay ${total} certificados con el filtro actual. Refine la búsqueda (máximo ${max} filas por exportación).`,
      });
    }

    const rows = await Certificado.find(q).sort({ fechaVencimiento: -1 }).limit(max).lean();
    const items = await mapearFilasVencidos(rows);

    const headers = [
      'Código',
      'Alumno / titular',
      'Documento',
      'Empresa',
      'Encabezado / programa',
      'Emisión',
      'Venció',
      'Hace',
      'Estado',
    ];

    const dataRows = items.map((c) => [
      c.codigoCert || '',
      c.nombreCompleto || '',
      c.numDoc != null ? String(c.numDoc) : '',
      c.empresaNombre || '',
      c.encabezado || c.nomCert || c.programaDescr || '',
      ymdExport(c.fechaEmision),
      ymdExport(c.fechaVencimiento),
      diasDesdeVencimientoExport(c.fechaVencimiento),
      c.estado || 'vencido',
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    ws['!cols'] = [
      { wch: 16 },
      { wch: 32 },
      { wch: 14 },
      { wch: 28 },
      { wch: 40 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Vencidos');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fecha = new Date().toISOString().slice(0, 10);
    noCache(res);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="certificados-vencidos-${fecha}.xlsx"`);
    res.send(buffer);
  } catch (e) {
    next(e);
  }
};

/** Certificados emitidos desde una fecha (alertas en tiempo real). */
exports.recientes = async (req, res, next) => {
  try {
    const q = {};
    if (req.query.desde) {
      const d = new Date(String(req.query.desde));
      if (!Number.isNaN(d.getTime())) q.fechaEmision = { $gte: d };
    }
    const rows = await Certificado.find(q).sort({ fechaEmision: -1 }).limit(120).lean();
    const numDocs = [...new Set(rows.map((c) => c.numDoc).filter((n) => n != null))];
    const alumnos = numDocs.length ? await DatosAlumno.find({ numDoc: { $in: numDocs } }).lean() : [];
    const alByDoc = new Map(alumnos.map((a) => [a.numDoc, a]));
    res.json(
      rows.map((c) => ({
        ...c,
        nombreCompleto: nombreCompletoAlumno(alByDoc.get(c.numDoc)),
        tipoFormatoCertLabel: TIPOS_LABEL[c.tipoFormatoCert] || c.tipoFormatoCert || null,
      })),
    );
  } catch (e) {
    next(e);
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    const c = await Certificado.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Certificado no encontrado' });
    if (esCertificadoJornadaCapacitacion(c)) {
      return res.status(403).json({
        message: 'Los certificados de jornadas de capacitación se gestionan en el módulo Jornadas.',
      });
    }
    if (esComprobanteAnulado(c)) {
      return res.status(409).json({ message: 'Este certificado ya está anulado.' });
    }

    const auth = await autorizarAnulacionSimple(
      req,
      'Anular certificados requiere autorización de un administrador.',
    );
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.message, code: auth.code });
    }

    const antes = c.toObject();
    const motivo = String(req.body?.motivo || req.body?.motivoAnulacion || '').trim() || null;
    // No se borra: pasa a estado 'anulado' conservando el consecutivo (codigoCert)
    // para trazabilidad y auditoría.
    c.set(metadatosAnulacion(req, auth.supervisor, { motivo }));
    c.estado = 'anulado';
    await c.save();

    registrarEliminacion(req, 'certificado', antes, {
      resumen: `Anulación certificado ${antes.codigoCert || req.params.id}${sufijoAutoriza(auth.supervisor)}`,
    });
    res.json({ ok: true, estado: 'anulado' });
  } catch (e) {
    next(e);
  }
};

const CAMPOS_EDITABLES = [
  'tipoCertificado',
  'numActa',
  'numFolio',
  'numRunt',
  'observaciones',
  'encabezado',
  'codVerificacion',
  'fechaEmision',
  'fechaVencimiento',
];

function pickCertificadoEdit(body) {
  const dto = {};
  for (const k of CAMPOS_EDITABLES) {
    if (body[k] !== undefined) dto[k] = body[k];
  }
  if (dto.numActa !== undefined) dto.numActa = String(dto.numActa || '').trim();
  if (dto.numFolio !== undefined) dto.numFolio = String(dto.numFolio || '').trim();
  if (dto.numRunt !== undefined) dto.numRunt = String(dto.numRunt || '').trim();
  if (dto.observaciones !== undefined) dto.observaciones = String(dto.observaciones || '').trim();
  if (dto.encabezado !== undefined) dto.encabezado = String(dto.encabezado || '').trim();
  if (dto.codVerificacion !== undefined) {
    dto.codVerificacion = String(dto.codVerificacion || '').trim() || null;
  }
  if (dto.tipoCertificado !== undefined) {
    dto.tipoCertificado = normalizarTipoRegularJornada(dto.tipoCertificado);
  }
  if (dto.fechaEmision !== undefined) {
    if (!dto.fechaEmision) return { error: 'fechaEmision inválida' };
    const d = parseFechaLocal(dto.fechaEmision);
    if (!d) return { error: 'fechaEmision inválida' };
    dto.fechaEmision = d;
  }
  if (dto.fechaVencimiento !== undefined) {
    if (dto.fechaVencimiento === null || dto.fechaVencimiento === '') {
      dto.fechaVencimiento = null;
    } else {
      const d = parseFechaLocal(dto.fechaVencimiento);
      if (!d) return { error: 'fechaVencimiento inválida' };
      dto.fechaVencimiento = d;
    }
  }
  return { dto };
}

exports.actualizar = async (req, res, next) => {
  try {
    const existente = await Certificado.findById(req.params.id).lean();
    if (!existente) return res.status(404).json({ message: 'Certificado no encontrado' });
    if (esCertificadoJornadaCapacitacion(existente)) {
      return res.status(403).json({
        message: 'Los certificados de jornadas de capacitación se gestionan en el módulo Jornadas.',
      });
    }

    const picked = pickCertificadoEdit(req.body || {});
    if (picked.error) return res.status(400).json({ message: picked.error });
    if (!Object.keys(picked.dto).length) {
      return res.status(400).json({ message: 'No hay campos para actualizar' });
    }

    if (picked.dto.tipoCertificado === TIPO_JORNADAS_CAPACITACION) {
      return res.status(400).json({
        message: 'No puede cambiar un certificado regular a jornada de capacitación desde este listado.',
      });
    }

    if (picked.dto.codVerificacion) {
      const dup = await Certificado.countDocuments({
        codVerificacion: picked.dto.codVerificacion,
        _id: { $ne: req.params.id },
      });
      if (dup > 0) {
        return res.status(409).json({ message: 'Ya existe otro certificado con ese código de verificación.' });
      }
    }

    const cert = await Certificado.findByIdAndUpdate(
      req.params.id,
      { $set: picked.dto },
      { new: true, runValidators: true },
    );
    if (!cert) return res.status(404).json({ message: 'Certificado no encontrado' });

    const descr = await descrPrograma(cert.idProg);
    const prog = await programaPorId(cert.idProg);
    noCache(res);
    res.json({
      ...cert.toObject(),
      programaDescr: descr,
      nomCert: prog?.nomCert || null,
      tipoFormatoCert: cert.tipoFormatoCert || null,
      tipoFormatoCertLabel: TIPOS_LABEL[cert.tipoFormatoCert] || cert.tipoFormatoCert || null,
      tipoCertificado: cert.tipoCertificado,
    });
  } catch (e) {
    next(e);
  }
};
