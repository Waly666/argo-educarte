const XLSX = require('xlsx');

const DatosAlumno = require('../models/DatosAlumno');
const Matricula = require('../models/Matricula');
const Liquidacion = require('../models/Liquidacion');
const Certificado = require('../models/Certificado');
const { models: cat } = require('../models/catalogos');
const { obtenerInforme } = require('../constants/informesAcademicosCatalogo');
const {
  num,
  buscarPrograma,
  listarServiciosDePrograma,
} = require('../services/programaServicio');
const { filtrarProgramas } = require('../services/sedeOferta');
const {
  cargarIndiceTipCap,
  filaCatalogoPorValorTipCap,
  programaCoincideIdTipCap,
} = require('../services/tipoCapacitacionMatch');
const {
  clasificarPrograma,
  normalizarTipoCertificado,
  TIPOS_LABEL,
} = require('../services/clasificacionCertificado');
const { filtroBusquedaAlumno, concatNombreAlumno } = require('../utils/busquedaAlumnoNombre');
const { filtrosExcluirJornadaCapacitacion } = require('../utils/filtrosCertificadoAcademico');
const { parseNumDoc } = require('../utils/numDoc');

const LIMITE_PAGINA = 100;
const LIMITE_EXPORT = 15000;

function parseFechaQuery(val, finDeDia) {
  if (!val) return null;
  const s = String(val).trim();
  if (!s) return null;
  const d = new Date(finDeDia ? `${s}T23:59:59.999` : `${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    const err = new Error(`Fecha inválida: ${s}`);
    err.status = 400;
    throw err;
  }
  return d;
}

function rangoFechas(query, claveDesde = 'desde', claveHasta = 'hasta') {
  let desde = parseFechaQuery(query[claveDesde], false);
  let hasta = parseFechaQuery(query[claveHasta], true);
  if (desde && hasta && desde > hasta) {
    const t = desde;
    desde = hasta;
    hasta = t;
  }
  return { desde, hasta, activo: !!(desde || hasta) };
}

function paginacion(query) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || LIMITE_PAGINA, 1), LIMITE_PAGINA);
  const skip = Math.max(parseInt(query.skip, 10) || 0, 0);
  return { limit, skip };
}

function idProgCanonico(raw) {
  const q = String(raw || '').trim();
  if (!q) return null;
  const n = Number(q);
  return Number.isFinite(n) ? n : q;
}

async function resolverNumDocsPorPrograma(idPrograma, idSede) {
  const id = idProgCanonico(idPrograma);
  if (!id) return null;
  const filtro = { idProg: String(id) };
  if (idSede) filtro.idSede = String(idSede);
  const mats = await Matricula.find(filtro).select('numDoc').lean();
  return [...new Set(mats.map((m) => m.numDoc).filter((n) => n != null))];
}

async function resolverNumDocsPorServicio(idServicio) {
  const id = String(idServicio || '').trim();
  if (!id) return null;
  const liqs = await Liquidacion.find({ idServ: id }).select('numDoc').lean();
  return [...new Set(liqs.map((l) => l.numDoc).filter((n) => n != null))];
}

async function resolverNumDocsPorMatriculaFiltros(query, idSede) {
  const condiciones = [];
  const idProg = idProgCanonico(query.idPrograma);
  if (idProg) condiciones.push({ idProg: String(idProg) });
  if (idSede) condiciones.push({ idSede: String(idSede) });
  const pagada = String(query.pagada || '').trim();
  if (pagada) condiciones.push({ pagada: new RegExp(`^${pagada.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
  const { desde, hasta, activo } = rangoFechas(query);
  if (activo) {
    const f = {};
    if (desde) f.$gte = desde;
    if (hasta) f.$lte = hasta;
    if (Object.keys(f).length) condiciones.push({ fechaMat: f });
  }
  if (!condiciones.length) return null;
  const filter = condiciones.length === 1 ? condiciones[0] : { $and: condiciones };
  const mats = await Matricula.find(filter).select('numDoc').lean();
  return [...new Set(mats.map((m) => m.numDoc).filter((n) => n != null))];
}

async function intersectarNumDocs(listas) {
  const validas = listas.filter((l) => Array.isArray(l));
  if (!validas.length) return null;
  let set = new Set(validas[0]);
  for (let i = 1; i < validas.length; i++) {
    const next = new Set(validas[i]);
    set = new Set([...set].filter((x) => next.has(x)));
  }
  return [...set];
}

function etiquetaTipoCap(idTipCap, indice) {
  if (idTipCap == null || idTipCap === '') return '';
  const row = filaCatalogoPorValorTipCap(idTipCap, indice);
  if (row) return String(row.tipoCap || row.descripcion || row.nombre || '').trim();
  return String(idTipCap);
}

function etiquetaTipoCertificado(prog) {
  const explicito = normalizarTipoCertificado(prog?.tipoCertificado);
  const tipo = explicito || clasificarPrograma(prog);
  return TIPOS_LABEL[tipo] || tipo || '';
}

async function reporteProgramasServicios(query, ctx) {
  const q = String(query.q || '').trim();
  const soloActivos = query.activos !== 'false';
  const idProgFiltro = idProgCanonico(query.idPrograma);
  const idTipCapFiltro = String(query.idTipCap || '').trim();

  const filter = {};
  if (soloActivos) filter.estado = { $in: [/^activo$/i, 'ACTIVO', 'Activo', null] };
  if (q.length >= 2) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ nombreProg: re }, { codigoProg: re }, { nomCert: re }];
  }
  if (idProgFiltro) {
    const n = Number(idProgFiltro);
    filter.$or = [
      { idPrograma: idProgFiltro },
      ...(Number.isFinite(n) ? [{ idPrograma: n }, { idProg: n }] : []),
      { idProg: idProgFiltro },
    ];
  }

  let programas = await cat.programas.find(filter).sort({ codigoProg: 1, nombreProg: 1 }).lean();
  if (ctx.idSede) programas = await filtrarProgramas(programas, ctx.idSede);

  const indice = await cargarIndiceTipCap();
  if (idTipCapFiltro) {
    programas = programas.filter((p) => programaCoincideIdTipCap(p, idTipCapFiltro, indice));
  }

  const filas = [];
  for (const prog of programas) {
    const tipoCap = etiquetaTipoCap(prog.idTipCap, indice);
    const tipoCert = etiquetaTipoCertificado(prog);
    const servicios = await listarServiciosDePrograma(prog);
    if (!servicios.length) {
      filas.push({
        codigoProg: prog.codigoProg || '',
        nombreProg: prog.nombreProg || '',
        tipoCap,
        tipoCertificado: tipoCert,
        estadoProg: prog.estado || 'Activo',
        descrServicio: '(sin servicios)',
        tipoServ: '',
        tarifa1: num(prog.valorMatricula),
        tarifa2: 0,
        tarifa3: 0,
        tarifaVirtual: 0,
      });
      continue;
    }
    for (const s of servicios) {
      filas.push({
        codigoProg: prog.codigoProg || '',
        nombreProg: prog.nombreProg || '',
        tipoCap,
        tipoCertificado: tipoCert,
        estadoProg: prog.estado || 'Activo',
        descrServicio: s.descrServicio || '',
        tipoServ: s.tipoServ != null ? String(s.tipoServ) : '',
        tarifa1: num(s.tarifa1),
        tarifa2: num(s.tarifa2),
        tarifa3: num(s.tarifa3),
        tarifaVirtual: num(s.tarifaVirtual),
      });
    }
  }

  return paginarFilas(filas, query);
}

function paginarFilas(filas, query) {
  const { limit, skip } = paginacion(query);
  const total = filas.length;
  const items = filas.slice(skip, skip + limit);
  return { items, total, skip, limit };
}

async function reporteAlumnos(query, ctx) {
  const condiciones = [];
  const q = String(query.q || '').trim();
  if (q) {
    const fb = filtroBusquedaAlumno(q);
    if (fb) condiciones.push(fb);
  }
  const jornada = String(query.jornada || '').trim();
  if (jornada) condiciones.push({ jornada: new RegExp(`^${jornada.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
  const tipoAlumno = String(query.tipoAlumno || '').trim();
  if (tipoAlumno) condiciones.push({ tipoAlumno });

  const numDocsSets = [];
  if (query.idPrograma) numDocsSets.push(await resolverNumDocsPorPrograma(query.idPrograma, ctx.idSede));
  if (query.idServicio) numDocsSets.push(await resolverNumDocsPorServicio(query.idServicio));
  if (query.pagada || query.desde || query.hasta) {
    numDocsSets.push(await resolverNumDocsPorMatriculaFiltros(query, ctx.idSede));
  }

  const numDocs = await intersectarNumDocs(numDocsSets);
  if (Array.isArray(numDocs)) {
    if (!numDocs.length) return { items: [], total: 0, skip: 0, limit: paginacion(query).limit };
    condiciones.push({ numDoc: { $in: numDocs } });
  }

  const filter = condiciones.length === 0 ? {} : condiciones.length === 1 ? condiciones[0] : { $and: condiciones };
  const { limit, skip } = paginacion(query);

  const [docs, total] = await Promise.all([
    DatosAlumno.find(filter).sort({ apellido1: 1, nombre1: 1 }).skip(skip).limit(limit).lean(),
    DatosAlumno.countDocuments(filter),
  ]);

  const nums = docs.map((d) => d.numDoc);
  const matFilter = nums.length ? { numDoc: { $in: nums } } : null;
  const mats = matFilter ? await Matricula.find(matFilter).select('numDoc idProg').lean() : [];
  const progIds = [...new Set(mats.map((m) => String(m.idProg)).filter(Boolean))];
  const progs = progIds.length
    ? await cat.programas.find({ idProg: { $in: progIds } }).select('idProg nombreProg codigoProg').lean()
    : [];
  const progMap = new Map(progs.map((p) => [String(p.idProg), p]));

  const progPorAlumno = new Map();
  for (const m of mats) {
    const p = progMap.get(String(m.idProg));
    const label = p ? `${p.codigoProg || ''} ${p.nombreProg || ''}`.trim() : String(m.idProg);
    if (!progPorAlumno.has(m.numDoc)) progPorAlumno.set(m.numDoc, new Set());
    if (label) progPorAlumno.get(m.numDoc).add(label);
  }

  const items = docs.map((d) => ({
    numDoc: d.numDoc,
    nombre: concatNombreAlumno(d),
    jornada: d.jornada || '',
    tipoAlumno: d.tipoAlumno || '',
    programas: [...(progPorAlumno.get(d.numDoc) || [])].join('; '),
    fechaReg: d.fechaReg || null,
    celular: d.celular || '',
    correo: d.correo || '',
  }));

  return { items, total, skip, limit };
}

async function reporteMatriculas(query, ctx) {
  const condiciones = [];
  const idProg = idProgCanonico(query.idPrograma);
  if (idProg) condiciones.push({ idProg: String(idProg) });
  if (ctx.idSede) condiciones.push({ idSede: String(ctx.idSede) });
  const pagada = String(query.pagada || '').trim();
  if (pagada) condiciones.push({ pagada: new RegExp(`^${pagada.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
  const { desde, hasta, activo } = rangoFechas(query);
  if (activo) {
    const f = {};
    if (desde) f.$gte = desde;
    if (hasta) f.$lte = hasta;
    condiciones.push({ fechaMat: f });
  }

  const q = String(query.q || '').trim();
  if (q) {
    const fb = filtroBusquedaAlumno(q);
    if (fb) {
      const alumnos = await DatosAlumno.find(fb).select('numDoc').limit(5000).lean();
      const nums = alumnos.map((a) => a.numDoc);
      if (!nums.length) return { items: [], total: 0, skip: 0, limit: paginacion(query).limit };
      condiciones.push({ numDoc: { $in: nums } });
    }
  }

  if (query.idServicio) {
    const idServ = String(query.idServicio).trim();
    const liqs = await Liquidacion.find({ idServ }).select('idMat numDoc').lean();
    const idMats = liqs.map((l) => l.idMat).filter(Boolean);
    if (!idMats.length) return { items: [], total: 0, skip: 0, limit: paginacion(query).limit };
    condiciones.push({ _id: { $in: idMats } });
  }

  const filter = condiciones.length === 0 ? {} : condiciones.length === 1 ? condiciones[0] : { $and: condiciones };
  const { limit, skip } = paginacion(query);

  const [mats, total] = await Promise.all([
    Matricula.find(filter).sort({ fechaMat: -1 }).skip(skip).limit(limit).lean(),
    Matricula.countDocuments(filter),
  ]);

  const nums = mats.map((m) => m.numDoc);
  const idMats = mats.map((m) => m._id);
  const [alumnos, progsRaw, liqs] = await Promise.all([
    nums.length ? DatosAlumno.find({ numDoc: { $in: nums } }).lean() : [],
    (() => {
      const ids = [...new Set(mats.map((m) => String(m.idProg)).filter(Boolean))];
      return ids.length ? cat.programas.find({ idProg: { $in: ids } }).lean() : [];
    })(),
    idMats.length ? Liquidacion.find({ idMat: { $in: idMats } }).lean() : [],
  ]);

  const alumMap = new Map(alumnos.map((a) => [a.numDoc, a]));
  const progMap = new Map(progsRaw.map((p) => [String(p.idProg), p]));
  const saldoPorMat = new Map();
  for (const l of liqs) {
    const k = String(l.idMat);
    saldoPorMat.set(k, (saldoPorMat.get(k) || 0) + num(l.saldo));
  }

  const items = mats.map((m) => {
    const a = alumMap.get(m.numDoc);
    const p = progMap.get(String(m.idProg));
    return {
      numDoc: m.numDoc,
      nombre: a ? concatNombreAlumno(a) : '',
      programa: p ? `${p.codigoProg || ''} ${p.nombreProg || ''}`.trim() : String(m.idProg),
      fechaMat: m.fechaMat,
      valorMat: num(m.valorMat),
      pagada: m.pagada || '',
      saldo: saldoPorMat.get(String(m._id)) || 0,
      jornada: a?.jornada || '',
    };
  });

  return { items, total, skip, limit };
}

async function reporteCertificados(query, ctx) {
  const qBase = { ...filtrosExcluirJornadaCapacitacion() };
  const idProg = idProgCanonico(query.idPrograma);
  if (idProg) qBase.idProg = String(idProg);
  const tipoFmt = String(query.tipoFormatoCert || '').trim();
  if (tipoFmt) qBase.tipoFormatoCert = tipoFmt;
  const { desde, hasta, activo } = rangoFechas(query);
  if (activo) {
    qBase.fechaEmision = {};
    if (desde) qBase.fechaEmision.$gte = desde;
    if (hasta) qBase.fechaEmision.$lte = hasta;
    if (!Object.keys(qBase.fechaEmision).length) delete qBase.fechaEmision;
  }

  const q = String(query.q || '').trim();
  if (q) {
    const fb = filtroBusquedaAlumno(q);
    if (fb) {
      const alumnos = await DatosAlumno.find(fb).select('numDoc').limit(5000).lean();
      const nums = alumnos.map((a) => a.numDoc);
      if (!nums.length) return { items: [], total: 0, skip: 0, limit: paginacion(query).limit };
      qBase.numDoc = { $in: nums };
    }
  }

  const { limit, skip } = paginacion(query);
  const [rows, total] = await Promise.all([
    Certificado.find(qBase).sort({ fechaEmision: -1 }).skip(skip).limit(limit).lean(),
    Certificado.countDocuments(qBase),
  ]);

  const nums = rows.map((c) => c.numDoc);
  const idProgs = [...new Set(rows.map((c) => String(c.idProg || '')).filter(Boolean))];
  const [alumnos, progs] = await Promise.all([
    nums.length ? DatosAlumno.find({ numDoc: { $in: nums } }).lean() : [],
    idProgs.length ? cat.programas.find({ idProg: { $in: idProgs } }).lean() : [],
  ]);
  const alumMap = new Map(alumnos.map((a) => [a.numDoc, a]));
  const progMap = new Map(progs.map((p) => [String(p.idProg), p]));

  const items = rows.map((c) => {
    const a = alumMap.get(c.numDoc);
    const p = progMap.get(String(c.idProg));
    return {
      numDoc: c.numDoc,
      nombre: a ? concatNombreAlumno(a) : '',
      programa: p ? `${p.codigoProg || ''} ${p.nombreProg || ''}`.trim() : String(c.idProg || ''),
      tipoFormatoCert: c.tipoFormatoCert || '',
      codCertificado: c.codCertificado || c.codigo || '',
      fechaEmision: c.fechaEmision,
      fechaVencimiento: c.fechaVencimiento,
      estado: c.estado || '',
    };
  });

  return { items, total, skip, limit };
}

async function reporteCartera(query, ctx) {
  const condiciones = [{ saldo: { $gt: 0 } }];
  if (ctx.idSede) condiciones.push({ idSede: String(ctx.idSede) });
  const idProg = idProgCanonico(query.idPrograma);
  if (idProg) condiciones.push({ idProg: String(idProg) });
  const idServ = String(query.idServicio || '').trim();
  if (idServ) condiciones.push({ idServ });
  const { desde, hasta, activo } = rangoFechas(query);
  if (activo) {
    const f = {};
    if (desde) f.$gte = desde;
    if (hasta) f.$lte = hasta;
    condiciones.push({ fechaCreacion: f });
  }

  const q = String(query.q || '').trim();
  if (q) {
    const nd = parseNumDoc(q);
    if (nd != null) condiciones.push({ numDoc: nd });
    else {
      const fb = filtroBusquedaAlumno(q);
      if (fb) {
        const alumnos = await DatosAlumno.find(fb).select('numDoc').limit(5000).lean();
        const nums = alumnos.map((a) => a.numDoc);
        if (!nums.length) return { items: [], total: 0, skip: 0, limit: paginacion(query).limit };
        condiciones.push({ numDoc: { $in: nums } });
      }
    }
  }

  const filter = condiciones.length === 1 ? condiciones[0] : { $and: condiciones };
  const { limit, skip } = paginacion(query);

  const [rows, total] = await Promise.all([
    Liquidacion.find(filter).sort({ saldo: -1, fechaCreacion: -1 }).skip(skip).limit(limit).lean(),
    Liquidacion.countDocuments(filter),
  ]);

  const nums = rows.map((r) => r.numDoc);
  const idProgs = [...new Set(rows.map((r) => String(r.idProg || '')).filter(Boolean))];
  const idServs = [...new Set(rows.map((r) => String(r.idServ || '')).filter(Boolean))];
  const [alumnos, progs, servs] = await Promise.all([
    nums.length ? DatosAlumno.find({ numDoc: { $in: nums } }).lean() : [],
    idProgs.length ? cat.programas.find({ idProg: { $in: idProgs } }).lean() : [],
    idServs.length ? cat.servicios.find({ idServ: { $in: idServs } }).lean() : [],
  ]);
  const alumMap = new Map(alumnos.map((a) => [a.numDoc, a]));
  const progMap = new Map(progs.map((p) => [String(p.idProg), p]));
  const servMap = new Map(servs.map((s) => [String(s.idServ), s]));

  const items = rows.map((r) => {
    const a = alumMap.get(r.numDoc);
    const p = progMap.get(String(r.idProg));
    const s = servMap.get(String(r.idServ));
    return {
      numDoc: r.numDoc,
      nombre: a ? concatNombreAlumno(a) : '',
      programa: p ? `${p.codigoProg || ''} ${p.nombreProg || ''}`.trim() : String(r.idProg || ''),
      servicio: s?.descrServicio || String(r.idServ || ''),
      valor: num(r.valor),
      abonado: num(r.abonado),
      saldo: num(r.saldo),
      estado: r.estado || '',
      fechaCreacion: r.fechaCreacion,
    };
  });

  return { items, total, skip, limit };
}

const EJECUTORES = {
  'programas-servicios': reporteProgramasServicios,
  alumnos: reporteAlumnos,
  matriculas: reporteMatriculas,
  certificados: reporteCertificados,
  cartera: reporteCartera,
};

async function ejecutarInforme(id, query, ctx = {}) {
  const meta = obtenerInforme(id);
  if (!meta) {
    const err = new Error('Informe no encontrado');
    err.status = 404;
    throw err;
  }
  const fn = EJECUTORES[id];
  if (!fn) {
    const err = new Error('Informe no implementado');
    err.status = 501;
    throw err;
  }
  const resultado = await fn(query, ctx);
  return { informe: meta.id, etiqueta: meta.etiqueta, columnas: meta.columnas, ...resultado };
}

async function exportarInformeExcel(id, query, ctx = {}) {
  const meta = obtenerInforme(id);
  if (!meta) {
    const err = new Error('Informe no encontrado');
    err.status = 404;
    throw err;
  }
  const qExport = { ...query, limit: LIMITE_EXPORT, skip: 0 };
  const fn = EJECUTORES[id];
  const { items } = await fn(qExport, ctx);
  const headers = meta.columnas.map((c) => c.etiqueta);
  const rows = items.map((row) =>
    meta.columnas.map((col) => {
      const v = row[col.clave];
      if (v == null) return '';
      if (col.tipo === 'fecha' && v) {
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
      }
      if (col.tipo === 'moneda') return num(v);
      return v;
    }),
  );
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!pageSetup'] = {
    paperSize: 1,
    orientation: 'portrait',
    fitToWidth: 1,
    fitToHeight: 0,
  };
  ws['!margins'] = {
    left: 0.7,
    right: 0.7,
    top: 0.75,
    bottom: 0.75,
    header: 0.3,
    footer: 0.3,
  };
  XLSX.utils.book_append_sheet(wb, ws, meta.etiqueta.slice(0, 31));
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return { buffer, nombre: `informe-${id}-${new Date().toISOString().slice(0, 10)}.xlsx` };
}

module.exports = {
  ejecutarInforme,
  exportarInformeExcel,
  LIMITE_PAGINA,
  LIMITE_EXPORT,
};
