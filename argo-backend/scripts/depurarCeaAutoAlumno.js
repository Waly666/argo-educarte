/**
 * Depura por qué no se generaron clases CEA al primer abono.
 * Uso: node scripts/depurarCeaAutoAlumno.js <alumnoId|numDoc>
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const DatosAlumno = require('../src/models/DatosAlumno');
const Matricula = require('../src/models/Matricula');
const Liquidacion = require('../src/models/Liquidacion');
const Ingreso = require('../src/models/Ingreso');
const InscripcionClaseCea = require('../src/models/InscripcionClaseCea');
const ClaseProgramadaCea = require('../src/models/ClaseProgramadaCea');
const { models: cat } = require('../src/models/catalogos');
const { onPrimerAbonoIngreso, completarClasesGrupalesAlumno } = require('../src/services/programacionCeaAuto');
const { buscarProgramaCea } = require('../src/services/programacionCeaRastreo');
const {
  esServicioHoraPractica,
  esServicioMatricula,
  esProgramaLicenciaConduccion,
} = require('../src/services/programaServicio');

function num(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
  return Number(v) || 0;
}

async function resolverAlumno(arg) {
  const raw = String(arg || '').trim();
  if (!raw) return null;
  if (/^[a-fA-F0-9]{24}$/.test(raw)) {
    const a = await DatosAlumno.findById(raw).lean();
    if (a) return a;
  }
  const n = Number(raw);
  if (Number.isFinite(n)) return DatosAlumno.findOne({ numDoc: n }).lean();
  return null;
}

async function resolverServicio(idServ) {
  if (idServ == null || idServ === '') return null;
  const idServStr = String(idServ);
  const n = Number(idServ);
  return cat.servicios
    .findOne({ $or: [{ idServ: idServStr }, ...(Number.isFinite(n) ? [{ idServ: n }] : [])] })
    .lean();
}

async function main() {
  const args = process.argv.slice(2);
  const completar = args.includes('--completar');
  const arg = args.find((a) => !a.startsWith('--'));
  if (!arg) {
    console.error('Uso: node scripts/depurarCeaAutoAlumno.js <alumnoId|numDoc> [--completar]');
    process.exit(1);
  }

  await connectDB();

  const alumno = await resolverAlumno(arg);
  if (!alumno) {
    console.log('Alumno no encontrado:', arg);
    process.exit(1);
  }

  console.log('=== ALUMNO ===');
  console.log({ _id: alumno._id, numDoc: alumno.numDoc, nombre: [alumno.nombre1, alumno.apellido1].filter(Boolean).join(' ') });

  const mats = await Matricula.find({ numDoc: alumno.numDoc }).lean();
  console.log('\n=== MATRÍCULAS ===', mats.length);
  for (const m of mats) {
    const prog = await cat.programas.findOne({ $or: [{ idProg: m.idProg }, { idPrograma: m.idProg }] }).lean();
    const esCea = prog ? await esProgramaLicenciaConduccion(prog) : false;
    console.log({
      _id: m._id,
      idProg: m.idProg,
      estado: m.estado,
      pagada: m.pagada,
      clasesCeaAutoGeneradas: m.clasesCeaAutoGeneradas,
      programa: prog?.nomCert || prog?.nombreProg || prog?.codigoProg,
      esProgramaCea: esCea,
      horasTeoria: prog?.horasTeoria,
      horasPractica: prog?.horasPractica,
      horasTaller: prog?.horasTaller,
    });
  }

  const liqs = await Liquidacion.find({ numDoc: alumno.numDoc }).sort({ createdAt: 1 }).lean();
  console.log('\n=== LIQUIDACIONES ===', liqs.length);
  for (const l of liqs) {
    const serv = l.idServ ? await resolverServicio(l.idServ) : null;
    console.log({
      _id: l._id,
      descripcion: l.descripcion,
      idMat: l.idMat ? String(l.idMat) : null,
      idServ: l.idServ,
      valor: num(l.valor),
      abonado: num(l.abonado),
      saldo: num(l.saldo),
      estado: l.estado,
      servicio: serv?.descrServicio || null,
      esHoraPractica: serv ? esServicioHoraPractica(serv) : null,
      esMatricula: serv ? esServicioMatricula(serv) : null,
    });
  }

  const ingresos = await Ingreso.find({ numDoc: alumno.numDoc }).sort({ createdAt: 1 }).lean();
  console.log('\n=== INGRESOS ===', ingresos.length);
  for (const ing of ingresos) {
    console.log({
      _id: ing._id,
      numRecibo: ing.numRecibo,
      idLiquidacion: ing.idLiquidacion ? String(ing.idLiquidacion) : null,
      valor: num(ing.valor),
      fecha: ing.fecha,
      createdAt: ing.createdAt,
    });
  }

  const ins = await InscripcionClaseCea.find({ numDoc: alumno.numDoc }).lean();
  console.log('\n=== INSCRIPCIONES CEA ===', ins.length);
  if (ins.length) {
    const clases = await ClaseProgramadaCea.find({ _id: { $in: ins.map((i) => i.idClase) } }).lean();
    for (const c of clases) {
      console.log({ idClase: c._id, tipo: c.tipoClase, estado: c.estado, idProg: c.idProg });
    }
  }

  // Simular onPrimerAbonoIngreso para cada liquidación con abono
  console.log('\n=== SIMULACIÓN onPrimerAbonoIngreso ===');
  for (const l of liqs.filter((x) => num(x.abonado) > 0)) {
    const r = await onPrimerAbonoIngreso({ numDoc: alumno.numDoc, liq: l, req: {} });
    console.log('Liq', l._id, l.descripcion?.slice(0, 40), '→', r);
  }

  if (completar) {
    console.log('\n=== COMPLETAR clases grupales faltantes ===');
    const r = await completarClasesGrupalesAlumno(alumno.numDoc);
    console.log(r);
    const ins2 = await InscripcionClaseCea.find({ numDoc: alumno.numDoc }).lean();
    const clases2 = await ClaseProgramadaCea.find({ _id: { $in: ins2.map((i) => i.idClase) } }).lean();
    const byTipo = {};
    for (const c of clases2) {
      byTipo[c.tipoClase] = (byTipo[c.tipoClase] || 0) + 1;
    }
    console.log('Inscripciones tras completar:', ins2.length, 'por tipo:', byTipo);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
