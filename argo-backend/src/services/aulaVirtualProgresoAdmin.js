const Matricula = require('../models/Matricula');
const UsuarioPortal = require('../models/UsuarioPortal');
const Certificado = require('../models/Certificado');
const ProgresoVirtualCurso = require('../models/ProgresoVirtualCurso');
const { listarMatriculasPrograma } = require('./programaMatriculas');
const { configPorPrograma } = require('./aulaVirtualCatalogo');
const {
  evaluarAprobacion,
  mapIntentosPublicos,
} = require('./aulaVirtualProgreso');

const ONLINE_MS = 10 * 60 * 1000;
const RECIENTE_MS = 24 * 60 * 60 * 1000;

function paginacion(query) {
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));
  const skip = Math.max(0, parseInt(query.skip, 10) || 0);
  return { limit, skip };
}

function estadoConexion(fechaActividad, ultimoAccesoPortal) {
  const fechas = [fechaActividad, ultimoAccesoPortal]
    .filter(Boolean)
    .map((f) => new Date(f).getTime())
    .filter((t) => !Number.isNaN(t));
  if (!fechas.length) {
    return { codigo: 'sin_datos', label: 'Sin actividad', enLinea: false };
  }
  const ultima = Math.max(...fechas);
  const diff = Date.now() - ultima;
  if (diff <= ONLINE_MS) {
    return { codigo: 'en_linea', label: 'En línea', enLinea: true };
  }
  if (diff <= RECIENTE_MS) {
    return { codigo: 'reciente', label: 'Reciente', enLinea: false };
  }
  return { codigo: 'desconectado', label: 'Desconectado', enLinea: false };
}

function mapClasesPublicas(clases) {
  if (!Array.isArray(clases)) return [];
  return clases
    .slice()
    .sort((a, b) => a.numero - b.numero)
    .map((c) => ({
      numero: c.numero,
      pct: c.pct ?? 0,
      aprobada: !!c.aprobada,
    }));
}

function pasaFiltro(filtro, row) {
  if (!filtro) return true;
  if (filtro === 'aprobado') return row.progreso.aprobado;
  if (filtro === 'sin_iniciar') return row.progreso.sinIniciar;
  if (filtro === 'certificado') return row.progreso.certificadoEmitido;
  return true;
}

/**
 * Resumen de progreso por alumno matriculado en un curso virtual (admin ERP).
 */
async function listarProgresoAlumnosAdmin(idPrograma, query = {}, ctx = {}) {
  const idProg = String(idPrograma || '').trim();
  const { limit, skip } = paginacion(query);
  if (!idProg) {
    return { items: [], total: 0, skip, limit, reglas: null };
  }

  const cfg = (await configPorPrograma(idProg)) || {};
  const reglas = {
    modoCertificado: cfg.modoCertificado || 'al_pagar',
    pctMinCompletitud: Number(cfg.pctMinCompletitud) || 80,
    pctMinEvaluaciones: Number(cfg.pctMinEvaluaciones) || 60,
    intentosMaxEval: Math.max(1, Number(cfg.intentosMaxEval) || 3),
  };

  const filtro = String(query.filtro || '').trim().toLowerCase();
  const usaFiltroProgreso = ['aprobado', 'sin_iniciar', 'certificado'].includes(filtro);
  const matParams = {
    q: query.q,
    modalidad: 'virtual',
    limit: usaFiltroProgreso ? 500 : limit,
    skip: usaFiltroProgreso ? 0 : skip,
  };

  const { items: mats, total: totalMats } = await listarMatriculasPrograma(idProg, matParams, ctx);

  if (!mats.length) {
    return { items: [], total: usaFiltroProgreso ? 0 : totalMats, skip, limit, reglas };
  }

  const nums = mats.map((m) => m.numDoc);
  const [progresos, portales, certs] = await Promise.all([
    ProgresoVirtualCurso.find({ idPrograma: idProg, numDoc: { $in: nums } }).lean(),
    UsuarioPortal.find({ numDoc: { $in: nums } }).lean(),
    Certificado.find({ idProg, numDoc: { $in: nums } })
      .select('numDoc codigoCert fechaEmision generadoAutoVirtual')
      .sort({ fechaEmision: -1 })
      .lean(),
  ]);

  const progMap = new Map(progresos.map((p) => [Number(p.numDoc), p]));
  const portalMap = new Map(portales.map((p) => [Number(p.numDoc), p]));
  const certMap = new Map();
  for (const c of certs) {
    const nd = Number(c.numDoc);
    if (!certMap.has(nd)) certMap.set(nd, c);
  }

  const rows = [];
  for (const m of mats) {
    const prog = progMap.get(Number(m.numDoc));
    const portal = portalMap.get(Number(m.numDoc));
    const cert = certMap.get(Number(m.numDoc));
    const estado = await evaluarAprobacion(m.numDoc, idProg);

    const pctCompletitud = estado.pctCompletitud ?? 0;
    const sinIniciar =
      !prog || (pctCompletitud === 0 && !estado.intentosEval && !(prog?.clases?.length));

    const conn = estadoConexion(prog?.fechaUltimaActividad, portal?.ultimoAcceso);

    rows.push({
      idMatricula: m.idMatricula,
      alumnoId: m.alumnoId,
      numDoc: m.numDoc,
      nombreCompleto: m.nombreCompleto,
      celular: m.celular,
      correo: m.correo,
      emailPortal: portal?.email || null,
      fechaMat: m.fechaMat,
      pago: {
        pagado: m.saldo <= 0,
        saldo: m.saldo,
        valorMat: m.valorMat,
        pagada: m.pagada,
      },
      progreso: {
        pctCompletitud,
        promedioClases: estado.promedioClases,
        clasesAprobadas: estado.clasesAprobadas,
        totalClases: estado.totalClases,
        clases: mapClasesPublicas(estado.clases),
        mejorNotaEval: estado.mejorNotaEval,
        ultimaNotaEval: estado.ultimaNotaEval,
        intentosEval: estado.intentosEval,
        intentosRestantes: estado.intentosRestantes,
        intentos: mapIntentosPublicos(prog?.intentos),
        aprobado: estado.aprobado,
        cumpleCompletitud: estado.cumpleCompletitud,
        cumpleNota: estado.cumpleNota,
        certificadoEmitido: estado.certificadoEmitido || !!cert,
        sinIniciar,
        contadorSyncs: prog?.contadorSyncs || 0,
        fechaUltimaActividad: prog?.fechaUltimaActividad
          ? new Date(prog.fechaUltimaActividad).toISOString()
          : null,
      },
      certificado: cert
        ? {
            codigoCert: cert.codigoCert || null,
            fechaEmision: cert.fechaEmision ? new Date(cert.fechaEmision).toISOString() : null,
            generadoAutoVirtual: !!cert.generadoAutoVirtual,
          }
        : null,
      portal: {
        activo: portal?.activo !== false,
        ultimoAcceso: portal?.ultimoAcceso ? new Date(portal.ultimoAcceso).toISOString() : null,
      },
      conexion: conn,
    });
  }

  if (usaFiltroProgreso) {
    const filtrados = rows.filter((r) => pasaFiltro(filtro, r));
    return {
      items: filtrados.slice(skip, skip + limit),
      total: filtrados.length,
      skip,
      limit,
      reglas,
    };
  }

  return { items: rows, total: totalMats, skip, limit, reglas };
}

module.exports = { listarProgresoAlumnosAdmin, estadoConexion };
