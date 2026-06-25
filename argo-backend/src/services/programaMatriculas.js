const Matricula = require('../models/Matricula');
const Liquidacion = require('../models/Liquidacion');
const DatosAlumno = require('../models/DatosAlumno');
const { concatNombreAlumno, filtroBusquedaAlumno } = require('../utils/busquedaAlumnoNombre');
const { num } = require('./programaServicio');

const TARIFA_VIRTUAL = 4;

function paginacion(query) {
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));
  const skip = Math.max(0, parseInt(query.skip, 10) || 0);
  return { limit, skip };
}

function etiquetaTarifa(tarifa) {
  const t = Number(tarifa);
  if (t === TARIFA_VIRTUAL) return 'Virtual';
  if (t === 3) return 'Refrendación';
  if (t === 2) return 'Tarifa 2';
  return 'Presencial';
}

/**
 * Matriculas de un programa con datos de alumno y saldo.
 * @param {string} idProg idPrograma canónico
 */
async function listarMatriculasPrograma(idProg, query = {}, ctx = {}) {
  if (!idProg) {
    return { items: [], total: 0, skip: 0, limit: paginacion(query).limit };
  }

  const condiciones = [{ idProg: String(idProg) }];
  if (ctx.idSede) condiciones.push({ idSede: String(ctx.idSede) });

  const pagada = String(query.pagada || '').trim();
  if (pagada) {
    condiciones.push({
      pagada: new RegExp(`^${pagada.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    });
  }

  const modalidad = String(query.modalidad || '').trim().toLowerCase();
  if (modalidad === 'virtual') condiciones.push({ tarifa: TARIFA_VIRTUAL });
  if (modalidad === 'presencial') condiciones.push({ tarifa: { $ne: TARIFA_VIRTUAL } });

  const q = String(query.q || '').trim();
  if (q) {
    const fb = filtroBusquedaAlumno(q);
    if (fb) {
      const alumnos = await DatosAlumno.find(fb).select('numDoc').limit(5000).lean();
      const nums = alumnos.map((a) => a.numDoc);
      if (!nums.length) {
        const { limit } = paginacion(query);
        return { items: [], total: 0, skip: 0, limit };
      }
      condiciones.push({ numDoc: { $in: nums } });
    }
  }

  const filter = condiciones.length === 1 ? condiciones[0] : { $and: condiciones };
  const { limit, skip } = paginacion(query);

  const [mats, total] = await Promise.all([
    Matricula.find(filter).sort({ fechaMat: -1 }).skip(skip).limit(limit).lean(),
    Matricula.countDocuments(filter),
  ]);

  const nums = mats.map((m) => m.numDoc);
  const idMats = mats.map((m) => m._id);
  const [alumnos, liqs] = await Promise.all([
    nums.length ? DatosAlumno.find({ numDoc: { $in: nums } }).lean() : [],
    idMats.length ? Liquidacion.find({ idMat: { $in: idMats } }).lean() : [],
  ]);

  const alumMap = new Map(alumnos.map((a) => [a.numDoc, a]));
  const saldoPorMat = new Map();
  for (const l of liqs) {
    const k = String(l.idMat);
    saldoPorMat.set(k, (saldoPorMat.get(k) || 0) + num(l.saldo));
  }

  const items = mats.map((m) => {
    const a = alumMap.get(m.numDoc);
    const tarifa = Number(m.tarifa) || 1;
    return {
      idMatricula: String(m._id),
      numDoc: m.numDoc,
      alumnoId: a?._id ? String(a._id) : null,
      nombreCompleto: a ? concatNombreAlumno(a) : '',
      celular: a?.celular || null,
      correo: a?.correo || null,
      fechaMat: m.fechaMat,
      valorMat: num(m.valorMat),
      tarifa,
      modalidad: tarifa === TARIFA_VIRTUAL ? 'virtual' : 'presencial',
      modalidadLabel: etiquetaTarifa(tarifa),
      pagada: m.pagada || '',
      saldo: saldoPorMat.get(String(m._id)) || 0,
      estado: m.estado || 'activa',
    };
  });

  return { items, total, skip, limit };
}

module.exports = { listarMatriculasPrograma, TARIFA_VIRTUAL, etiquetaTarifa };
