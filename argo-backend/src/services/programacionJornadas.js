const JornadaCap = require('../models/JornadaCap');
const { esDiaProgramable } = require('../constants/jornadaCapacitacion');
const { parseFechaCalendario, fechaCalendarioIso, fechaCalendarioParaGuardar, hoyCalendario } = require('../utils/fechaCalendario');
const { estadoJornadaPorFecha } = require('./estadoJornadaCap');

function calcNumeObjeJornada(numeroAlumnos, numerojornadas) {
  const a = Number(numeroAlumnos) || 0;
  const j = Number(numerojornadas) || 0;
  if (j <= 0) return 0;
  return Math.ceil(a / j);
}

function slotKey(fecha, indiceEnDia) {
  return `${fechaCalendarioIso(fecha)}|${Math.max(1, parseInt(indiceEnDia, 10) || 1)}`;
}

/**
 * Genera jornadas faltantes hasta completar numerojornadas del contrato.
 * Respeta huecos si el usuario eliminó jornadas (misma fecha + indiceEnDia).
 */
async function generarJornadasContrato(contrato, userLogin = '') {
  if (!contrato?._id) throw new Error('Contrato inválido');
  const n = Math.max(0, parseInt(contrato.numerojornadas, 10) || 0);
  if (n < 1) throw new Error('numerojornadas debe ser mayor a 0');
  const inicioContrato = parseFechaCalendario(contrato.fechaInicJornadas);
  if (!inicioContrato) throw new Error('fechaInicJornadas inválida');
  const hoy = hoyCalendario();
  /** No programar jornadas en días ya pasados: desde max(inicio contrato, hoy). */
  const cursor = new Date(Math.max(inicioContrato.getTime(), hoy.getTime()));
  const ajustadoDesdeHoy = inicioContrato.getTime() < hoy.getTime();
  const fechaDesdeProgramacion = fechaCalendarioIso(cursor);

  const existentes = await JornadaCap.find({ idContrato: contrato._id }).lean();
  if (existentes.length >= n) {
    throw new Error(
      `El contrato ya tiene ${existentes.length} jornada(s) (meta: ${n}). Elimine alguna para volver a generar.`,
    );
  }
  const faltan = n - existentes.length;

  const flags = {
    incluiSab: !!contrato.incluiSab,
    incluiDom: !!contrato.incluiDom,
    incluiFest: !!contrato.incluiFest,
  };
  const porDia = Math.max(1, Math.min(20, parseInt(contrato.jornadasPorDia, 10) || 1));
  const numeObje = calcNumeObjeJornada(contrato.numeroAlumnos, n);
  const supervisor = String(contrato.supervisor || '').trim();
  const direccion = String(contrato.direccion || '').trim();

  const ocupados = new Set(existentes.map((j) => slotKey(j.fechaProgramacion, j.indiceEnDia)));

  const docs = [];
  let guard = 0;
  while (docs.length < faltan && guard < 800) {
    guard += 1;
    if (esDiaProgramable(cursor, flags)) {
      for (let i = 0; i < porDia && docs.length < faltan; i += 1) {
        const indiceEnDia = i + 1;
        const key = slotKey(cursor, indiceEnDia);
        if (ocupados.has(key)) continue;
        docs.push({
          idContrato: contrato._id,
          fechaProgramacion: fechaCalendarioParaGuardar(cursor),
          indiceEnDia,
          municipio: '',
          depto: '',
          direccion,
          lat: null,
          lng: null,
          numeObjeJornada: numeObje,
          supervisor,
          estado: estadoJornadaPorFecha(cursor),
          userAddReg: userLogin,
        });
        ocupados.add(key);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (docs.length < faltan) {
    throw new Error(
      `No fue posible programar ${faltan} jornada(s) faltante(s) con las reglas de calendario indicadas.`,
    );
  }

  const inserted = await JornadaCap.insertMany(docs);
  if (numeObje > 0) {
    await JornadaCap.updateMany({ idContrato: contrato._id }, { $set: { numeObjeJornada: numeObje } });
  }
  return {
    count: inserted.length,
    total: existentes.length + inserted.length,
    numeObjeJornada: numeObje,
    fechaDesde: fechaDesdeProgramacion,
    fechaInicioContrato: fechaCalendarioIso(inicioContrato),
    ajustadoDesdeHoy,
  };
}

module.exports = { generarJornadasContrato, calcNumeObjeJornada, slotKey };
