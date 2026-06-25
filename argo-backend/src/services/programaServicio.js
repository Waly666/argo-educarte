const { models: cat } = require('../models/catalogos');
const mongoose = require('mongoose');
const Liquidacion = require('../models/Liquidacion');
const { TARIFA_VIRTUAL } = require('../constants/tarifa');
const { actualizarSaldosLiquidacionesPorServicio } = require('./liquidacionMatricula');
const { cargarIndiceTipCap, resolverIdTipCapCanonico } = require('./tipoCapacitacionMatch');

function num(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
  return Number(v) || 0;
}

/** Valor a liquidar según tarifa (1–3 presencial; 4 = tarifaVirtual del servicio). */
function valorTarifaServicio(serv, tarifa, prog) {
  const t = Number(tarifa);
  if (t === TARIFA_VIRTUAL) {
    return num(serv?.tarifaVirtual);
  }
  if (serv && serv[`tarifa${t}`] != null && serv[`tarifa${t}`] !== '') {
    return num(serv[`tarifa${t}`]);
  }
  return num(prog?.valorMatricula);
}

async function maxNumericId(collection, field) {
  const rows = await collection.find({ [field]: { $exists: true, $ne: null } }).lean();
  let max = 0;
  for (const r of rows) {
    const raw = r[field];
    const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

/** Inserción directa en Mongo (catálogos con esquema flexible). */
async function insertarCatalogo(collection, doc) {
  const { coerceDocument } = require('../utils/coerceTypes');
  const normalizado = coerceDocument(doc);
  const res = await collection.collection.insertOne(normalizado);
  return { ...normalizado, _id: res.insertedId };
}

function inferirTipoServ(idTipCap) {
  const t = String(idTipCap ?? '').toLowerCase();
  if (/diplomado/.test(t)) return 'DIP';
  if (/tecnico|competenc/.test(t)) return 'TEC';
  if (/licencia|conduccion/.test(t)) return 'CUR';
  if (/curso|no formal/.test(t)) return 'CUR';
  return 'CUR';
}

function etiquetaSemestre(tipoServ) {
  if (tipoServ === 'DIP') return 'DIPLOMADO';
  if (tipoServ === 'TEC') return 'TECNICO';
  return 'CURSO';
}

function prefijoCodigo(tipoServ) {
  if (tipoServ === 'DIP') return 'DIP';
  if (tipoServ === 'TEC') return 'TEC';
  return 'CUR';
}

async function generarCodigoProg(idTipCap) {
  const tipoServ = inferirTipoServ(idTipCap);
  const pref = prefijoCodigo(tipoServ);
  const rows = await cat.programas
    .find({ codigoProg: new RegExp(`^${pref}`, 'i') })
    .select('codigoProg')
    .lean();
  let max = 0;
  for (const r of rows) {
    const m = String(r.codigoProg || '').match(/(\d+)\s*$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${pref}${String(max + 1).padStart(3, '0')}`;
}

async function buscarPrograma(idPrograma) {
  const q = String(idPrograma ?? '').trim();
  if (!q) return null;
  const n = Number(q);
  const or = [
    { idPrograma: q },
    { idProg: q },
    { codigoProg: q },
    ...(Number.isFinite(n) ? [{ idPrograma: n }, { idProg: n }] : []),
  ];
  if (mongoose.isValidObjectId(q)) {
    or.unshift({ _id: q });
  }
  return cat.programas.findOne({ $or: or }).lean();
}

function idProgDePrograma(prog) {
  const idProg = prog.idPrograma ?? prog.idProg;
  return Number.isFinite(Number(idProg)) ? Number(idProg) : idProg;
}

function filtroIdProg(idProg) {
  const n = Number(idProg);
  return {
    $or: [{ idProg }, { idProg: String(idProg) }, ...(Number.isFinite(n) ? [{ idProg: n }] : [])],
  };
}

/** Programa con semestres definidos (1 o más). Vacío/null/0 → un solo servicio clásico. */
function programaUsaSemestres(prog) {
  const s = Number(prog?.semestres);
  return Number.isFinite(s) && s >= 1;
}

function repartirValor(total, n) {
  const t = Math.round(Number(total) || 0);
  const k = Math.max(1, Math.floor(n));
  const base = Math.floor(t / k);
  const arr = Array(k).fill(base);
  let rest = t - base * k;
  for (let i = 0; i < rest; i++) arr[i] += 1;
  return arr;
}

function descrServicioSemestre(numSemestre, prog, tipoServ) {
  const nombre = (prog.nombreProg || prog.nomCert || 'Programa').trim();
  const etiqueta = etiquetaSemestre(tipoServ);
  return `${numSemestre} SEM ${etiqueta} ${nombre}`;
}

function esServicioHoraPractica(s) {
  if (!s) return false;
  if (s.rolServicio === 'hora_practica') return true;
  if (s.excluirMatricula === true && s.usaCantidad === true) return true;
  return /\bhoras?\b.*\bpractic/i.test(String(s.descrServicio || s.descripcion || ''));
}

function esServicioMatricula(s) {
  return servicioVinculadoPrograma(s) && !esServicioHoraPractica(s);
}

function servicioVinculadoPrograma(s) {
  const ip = s?.idProg;
  return ip != null && String(ip).trim() !== '';
}

/** Matrícula u otro servicio de programa que no admite cantidad al liquidar manualmente. */
function esServicioMatriculaPrograma(s) {
  return esServicioMatricula(s);
}

function tarifaFijaServicio(s) {
  return num(s?.tarifa1) > 0;
}

/** Cantidad × tarifa solo si hay tarifa unitaria (hora práctica o usaCantidad explícito). */
function servicioPermiteCantidad(s) {
  if (!s) return false;
  if (s.valorVariable === true) return false;
  if (s.usaCantidad === false) return false;
  if (esServicioMatriculaPrograma(s)) return false;
  if (!tarifaFijaServicio(s)) return false;
  if (esServicioHoraPractica(s)) return true;
  if (s.usaCantidad === true) return true;
  return false;
}

function limpiarNombreServicioCantidad(descr) {
  return String(descr || '')
    .replace(/\s+x\s*\d+\s*$/i, '')
    .replace(/\s*\(\s*\d+\s*h\s*\)\s*$/i, '')
    .replace(/\s*\(\s*cant\.\s*\d+\s*\)\s*$/i, '')
    .trim();
}

/** Ej.: «HORA CLASE PRACTICA LICENCIA A1 x 3» — baseDescr es el texto elegido por el usuario o del catálogo. */
function descripcionConCantidad(s, baseDescr, cant) {
  const nombre = limpiarNombreServicioCantidad(String(baseDescr || '').trim() || 'Servicio adicional');
  return `${nombre} x ${cant}`;
}

/** @deprecated Use descripcionConCantidad */
function sufijoCantidadLiquidacion(s, cant) {
  return `x ${cant}`;
}

async function esProgramaLicenciaConduccion(prog) {
  if (!prog?.idTipCap && prog?.idTipCap !== 0) return false;
  try {
    const indice = await cargarIndiceTipCap();
    const canon = resolverIdTipCapCanonico(prog.idTipCap, indice);
    if (canon === '4') return true;
    const norm = indice.normalizarTextoCap(String(prog.idTipCap || ''));
    return norm.includes('licencia') && norm.includes('conduccion');
  } catch {
    const t = String(prog.idTipCap || '').toLowerCase();
    return t.includes('licencia') && t.includes('conduccion');
  }
}

/** Ej.: «HORA CLASE PRACTICA LICENCIA A1» */
function descrHoraPracticaLicencia(prog) {
  const nombre = String(prog.nomCert || prog.nombreProg || '').trim();
  const codigo = String(prog.codigoProg || '').trim();
  const m =
    nombre.match(/\b([ABC]\s*\d?)\b/i) ||
    codigo.match(/\b([ABC]\d?)\b/i) ||
    nombre.match(/\b(A1|A2|B1|B2|C1|C2|C3)\b/i);
  if (m) {
    const cat = String(m[1]).replace(/\s+/g, '').toUpperCase();
    return `HORA CLASE PRACTICA LICENCIA ${cat}`;
  }
  if (/licencia/i.test(nombre)) {
    return `HORA CLASE PRACTICA ${nombre}`.toUpperCase();
  }
  return `HORA CLASE PRACTICA ${nombre || codigo || 'LICENCIA'}`.toUpperCase();
}

function ordenarServicios(rows) {
  return [...rows].sort((a, b) => {
    const ha = esServicioHoraPractica(a) ? 1 : 0;
    const hb = esServicioHoraPractica(b) ? 1 : 0;
    if (ha !== hb) return ha - hb;
    const na = Number(a.numSemestre);
    const nb = Number(b.numSemestre);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    if (Number.isFinite(na)) return -1;
    if (Number.isFinite(nb)) return 1;
    return Number(a.idServ) - Number(b.idServ);
  });
}

async function listarServiciosMatricula(prog) {
  const rows = await listarServiciosDePrograma(prog);
  return rows.filter(esServicioMatricula);
}

async function buscarServicioHoraPractica(prog) {
  const rows = await listarServiciosDePrograma(prog);
  return rows.find(esServicioHoraPractica) || null;
}

async function listarServiciosDePrograma(prog) {
  if (!prog) return [];
  const idProg = idProgDePrograma(prog);
  const rows = await cat.servicios.find(filtroIdProg(idProg)).lean();
  return ordenarServicios(rows);
}

async function buscarServicioDePrograma(prog) {
  const lista = await listarServiciosMatricula(prog);
  return lista[0] || null;
}

function docServicioDesdePrograma(prog, servicioBody, usuario, extras = {}) {
  const valor = num(servicioBody?.tarifa1 ?? servicioBody?.valorMatricula ?? prog.valorMatricula);
  const t2 = num(servicioBody?.tarifa2);
  const t3 = num(servicioBody?.tarifa3);
  const tVirtual = num(servicioBody?.tarifaVirtual);
  const now = new Date();
  const user = usuario?.username || 'sistema';
  const idProg = idProgDePrograma(prog);
  const tipoServ = (servicioBody?.tipoServ || '').trim() || inferirTipoServ(prog.idTipCap);
  const doc = {
    tipoServ,
    idProg,
    rolServicio: 'matricula',
    excluirMatricula: false,
    descrServicio:
      (servicioBody?.descrServicio || '').trim() ||
      prog.nombreProg ||
      prog.nomCert ||
      'Matrícula programa',
    facturar: servicioBody?.facturar ?? 'NO',
    iva: num(servicioBody?.iva),
    tarifa1: valor,
    fechaAudi: now,
    userAddReg: user,
    fechaMod: now,
    userChangeRecord: user,
  };
  if (t2 > 0) doc.tarifa2 = t2;
  if (t3 > 0) doc.tarifa3 = t3;
  if (servicioBody?.tarifaVirtual != null && servicioBody?.tarifaVirtual !== '') {
    doc.tarifaVirtual = tVirtual;
  } else if (tVirtual > 0) {
    doc.tarifaVirtual = tVirtual;
  }
  return { ...doc, ...extras };
}

async function crearServicioDocumento(prog, servicioBody, usuario, campos) {
  const idServ = await maxNumericId(cat.servicios, 'idServ');
  const doc = { idServ, ...docServicioDesdePrograma(prog, servicioBody, usuario, campos) };
  return insertarCatalogo(cat.servicios, doc);
}

async function crearServiciosPorSemestres(prog, servicioBody, usuario) {
  const { esSoloVirtual, modalidadesEfectivas } = require('./programaModalidad');
  const n = Math.floor(Number(prog.semestres));
  const soloVir = esSoloVirtual(modalidadesEfectivas(prog));
  const total = soloVir
    ? num(servicioBody?.tarifaVirtual)
    : num(servicioBody?.tarifa1 ?? servicioBody?.valorMatricula ?? prog.valorMatricula);
  const valores = repartirValor(total, n);
  const tipoServ = (servicioBody?.tipoServ || '').trim() || inferirTipoServ(prog.idTipCap);
  const creados = [];
  for (let i = 1; i <= n; i++) {
    const bodySem = soloVir
      ? {
          ...servicioBody,
          tarifa1: 0,
          tarifa2: 0,
          tarifa3: 0,
          tarifaVirtual: valores[i - 1],
          descrServicio: descrServicioSemestre(i, prog, tipoServ),
          tipoServ,
        }
      : {
          ...servicioBody,
          tarifa1: valores[i - 1],
          descrServicio: descrServicioSemestre(i, prog, tipoServ),
          tipoServ,
        };
    const s = await crearServicioDocumento(prog, bodySem, usuario, { numSemestre: i });
    creados.push(s);
  }
  return creados;
}

/**
 * Crea servicio(s) de matrícula. Con semestres → N servicios numerados.
 */
async function crearServicioParaPrograma(prog, servicioBody, usuario, opts = {}) {
  if (programaUsaSemestres(prog)) {
    if (!opts.forzarNuevo) {
      const existentes = await listarServiciosMatricula(prog);
      if (existentes.length) return existentes;
    }
    return crearServiciosPorSemestres(prog, servicioBody, usuario);
  }

  if (!opts.forzarNuevo) {
    const existente = await buscarServicioDePrograma(prog);
    if (existente) return existente;
  }
  return crearServicioDocumento(prog, servicioBody, usuario);
}

async function eliminarServiciosSinLiquidacion(idServConservar, prog) {
  const todos = await listarServiciosDePrograma(prog);
  for (const s of todos) {
    if (String(s.idServ) === String(idServConservar)) continue;
    if (esServicioHoraPractica(s)) continue;
    const usado = await Liquidacion.countDocuments({ idServ: String(s.idServ) });
    if (!usado) await cat.servicios.deleteOne({ idServ: s.idServ });
  }
}

async function sincronizarServicioUnico(prog, servicioBody, usuario) {
  let serv = await buscarServicioDePrograma(prog);
  const base = docServicioDesdePrograma(prog, servicioBody, usuario);
  const idProg = base.idProg;
  const tarifaAnterior = serv ? num(serv.tarifa1) : null;

  if (serv) {
    const unset = { numSemestre: '' };
    if (base.tarifa2 == null) unset.tarifa2 = '';
    if (base.tarifa3 == null) unset.tarifa3 = '';
    await cat.servicios.updateOne(
      { idServ: serv.idServ },
      { $set: { ...base, idProg }, $unset: unset },
    );
    const actualizado = await cat.servicios.findOne({ idServ: serv.idServ }).lean();
    if (tarifaAnterior != null && num(base.tarifa1) !== tarifaAnterior) {
      await actualizarSaldosLiquidacionesPorServicio(serv.idServ, base.tarifa1);
    }
    await eliminarServiciosSinLiquidacion(serv.idServ, prog);
    return actualizado;
  }
  const nuevo = await crearServicioDocumento(prog, servicioBody, usuario);
  await eliminarServiciosSinLiquidacion(nuevo.idServ, prog);
  return nuevo;
}

async function sincronizarServiciosPorSemestres(prog, servicioBody, usuario) {
  const { esSoloVirtual, modalidadesEfectivas } = require('./programaModalidad');
  const n = Math.floor(Number(prog.semestres));
  const soloVir = esSoloVirtual(modalidadesEfectivas(prog));
  const total = soloVir
    ? num(servicioBody?.tarifaVirtual ?? prog.valorMatricula)
    : num(servicioBody?.tarifa1 ?? servicioBody?.valorMatricula ?? prog.valorMatricula);
  const valores = repartirValor(total, n);
  const tipoServ = (servicioBody?.tipoServ || '').trim() || inferirTipoServ(prog.idTipCap);
  const existentes = ordenarServicios(
    (await listarServiciosDePrograma(prog)).filter(esServicioMatricula),
  );
  const sinNumero = existentes.filter((s) => s.numSemestre == null || s.numSemestre === '');
  const porNumero = new Map();
  for (const s of existentes) {
    const k = Number(s.numSemestre);
    if (Number.isFinite(k) && k >= 1) porNumero.set(k, s);
  }

  const usados = new Set();
  const resultado = [];

  for (let i = 1; i <= n; i++) {
    let serv = porNumero.get(i);
    if (!serv && sinNumero.length) {
      const candidato = sinNumero.find((s) => !usados.has(s.idServ));
      if (candidato) {
        serv = candidato;
        usados.add(candidato.idServ);
      }
    }
    const descr = descrServicioSemestre(i, prog, tipoServ);
    const tarifa1 = soloVir ? 0 : valores[i - 1];
    const tarifaVirtual = soloVir ? valores[i - 1] : num(servicioBody?.tarifaVirtual ?? serv?.tarifaVirtual);
    const patch = {
      tipoServ,
      idProg: idProgDePrograma(prog),
      descrServicio: descr,
      facturar: servicioBody?.facturar ?? serv?.facturar ?? 'NO',
      iva: num(servicioBody?.iva ?? serv?.iva),
      tarifa1,
      numSemestre: i,
      fechaMod: new Date(),
      userChangeRecord: usuario?.username || 'sistema',
    };
    if (soloVir) {
      patch.tarifaVirtual = tarifaVirtual;
      patch.tarifa2 = 0;
      patch.tarifa3 = 0;
    } else if (servicioBody?.tarifaVirtual != null && servicioBody?.tarifaVirtual !== '') {
      patch.tarifaVirtual = num(servicioBody.tarifaVirtual);
    }
    const tarifaAnterior = serv ? num(soloVir ? serv.tarifaVirtual : serv.tarifa1) : null;
    const tarifaNueva = soloVir ? tarifaVirtual : tarifa1;

    if (serv) {
      await cat.servicios.updateOne({ idServ: serv.idServ }, { $set: patch });
      const actualizado = await cat.servicios.findOne({ idServ: serv.idServ }).lean();
      resultado.push(actualizado);
      if (tarifaAnterior !== tarifaNueva) {
        await actualizarSaldosLiquidacionesPorServicio(serv.idServ, tarifaNueva);
      }
    } else {
      const bodySem = soloVir
        ? {
            ...servicioBody,
            tarifa1: 0,
            tarifa2: 0,
            tarifa3: 0,
            tarifaVirtual: tarifaVirtual,
            descrServicio: descr,
            tipoServ,
          }
        : { ...servicioBody, tarifa1, descrServicio: descr, tipoServ };
      const nuevo = await crearServicioDocumento(prog, bodySem, usuario, { numSemestre: i });
      resultado.push(nuevo);
    }
  }

  return ordenarServicios(resultado);
}

async function sincronizarServicioHoraPractica(prog, servicioBody, usuario) {
  if (!(await esProgramaLicenciaConduccion(prog))) return null;

  const tarifa1 = num(
    servicioBody?.tarifaHoraPractica ??
      servicioBody?.horaPracticaTarifa1 ??
      servicioBody?.tarifaHoraPractica1,
  );
  let serv = await buscarServicioHoraPractica(prog);
  const idProg = idProgDePrograma(prog);
  const user = usuario?.username || 'sistema';
  const now = new Date();

  if (tarifa1 <= 0 && !serv) return null;

  const patch = {
    tipoServ: (servicioBody?.tipoServHoraPractica || serv?.tipoServ || 'CEA').trim() || 'CEA',
    idProg,
    rolServicio: 'hora_practica',
    excluirMatricula: true,
    usaCantidad: true,
    unidadMedida: 'hora',
    descrServicio: descrHoraPracticaLicencia(prog),
    facturar: servicioBody?.facturarHoraPractica ?? serv?.facturar ?? servicioBody?.facturar ?? 'NO',
    iva: num(servicioBody?.ivaHoraPractica ?? serv?.iva ?? servicioBody?.iva),
    tarifa1: tarifa1 > 0 ? tarifa1 : num(serv?.tarifa1),
    fechaMod: now,
    userChangeRecord: user,
  };

  if (serv) {
    await cat.servicios.updateOne({ idServ: serv.idServ }, { $set: patch });
    const actualizado = await cat.servicios.findOne({ idServ: serv.idServ }).lean();
    const tarifaAnterior = num(serv.tarifa1);
    if (patch.tarifa1 !== tarifaAnterior) {
      await actualizarSaldosLiquidacionesPorServicio(serv.idServ, patch.tarifa1, { soloPendientes: true });
    }
    return actualizado;
  }

  if (patch.tarifa1 <= 0) return null;

  const idServ = await maxNumericId(cat.servicios, 'idServ');
  const doc = {
    idServ,
    ...patch,
    tarifa1: patch.tarifa1,
    fechaAudi: now,
    userAddReg: user,
  };
  return insertarCatalogo(cat.servicios, doc);
}

async function sincronizarServicioPrograma(prog, servicioBody, usuario) {
  let matricula;
  if (programaUsaSemestres(prog)) {
    matricula = await sincronizarServiciosPorSemestres(prog, servicioBody, usuario);
  } else {
    matricula = await sincronizarServicioUnico(prog, servicioBody, usuario);
  }
  const horaPractica = await sincronizarServicioHoraPractica(prog, servicioBody, usuario);
  if (Array.isArray(matricula)) {
    return horaPractica ? [...matricula, horaPractica] : matricula;
  }
  return horaPractica ? [matricula, horaPractica].filter(Boolean) : matricula;
}

async function serviciosTienenLiquidaciones(prog) {
  const servs = await listarServiciosDePrograma(prog);
  for (const s of servs) {
    const n = await Liquidacion.countDocuments({ idServ: String(s.idServ) });
    if (n > 0) return true;
  }
  return false;
}

/** Curso virtual en portal: tarifa virtual del servicio de matrícula > 0. */
function esCapacitacionVirtualServicio(serv) {
  return num(serv?.tarifaVirtual) > 0;
}

async function adjuntarVirtualidadProgramas(rows) {
  if (!rows?.length) return rows || [];
  const { enriquecerProgramaModalidad } = require('./programaModalidad');
  const ids = [...new Set(rows.map((r) => String(r.idPrograma)))];
  const servs = await cat.servicios
    .find({
      idProg: { $in: ids },
      excluirMatricula: { $ne: true },
      rolServicio: { $ne: 'hora_practica' },
    })
    .lean();
  const servsPorProg = new Map();
  for (const s of servs) {
    const k = String(s.idProg);
    if (!servsPorProg.has(k)) servsPorProg.set(k, []);
    servsPorProg.get(k).push(s);
  }
  return rows.map((r) => {
    const id = String(r.idPrograma);
    const serviciosProg = servsPorProg.get(id) || [];
    const tarifaVirtual = serviciosProg.reduce((m, s) => Math.max(m, num(s.tarifaVirtual)), 0);
    return enriquecerProgramaModalidad(
      {
        ...r,
        tarifaVirtual,
      },
      serviciosProg,
    );
  });
}

module.exports = {
  num,
  maxNumericId,
  insertarCatalogo,
  inferirTipoServ,
  etiquetaSemestre,
  generarCodigoProg,
  buscarPrograma,
  idProgDePrograma,
  filtroIdProg,
  programaUsaSemestres,
  repartirValor,
  descrServicioSemestre,
  descrHoraPracticaLicencia,
  esServicioHoraPractica,
  esServicioMatricula,
  esServicioMatriculaPrograma,
  servicioVinculadoPrograma,
  tarifaFijaServicio,
  valorTarifaServicio,
  servicioPermiteCantidad,
  descripcionConCantidad,
  sufijoCantidadLiquidacion,
  esProgramaLicenciaConduccion,
  listarServiciosDePrograma,
  listarServiciosMatricula,
  buscarServicioDePrograma,
  buscarServicioHoraPractica,
  crearServicioParaPrograma,
  sincronizarServicioPrograma,
  sincronizarServicioHoraPractica,
  serviciosTienenLiquidaciones,
  esCapacitacionVirtualServicio,
  adjuntarVirtualidadProgramas,
};
