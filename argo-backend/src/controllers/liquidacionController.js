const mongoose = require('mongoose');
const Liquidacion = require('../models/Liquidacion');
const Matricula = require('../models/Matricula');
const DatosAlumno = require('../models/DatosAlumno');
const { esTarifaVirtual } = require('../constants/tarifa');
const { models: cat } = require('../models/catalogos');
const { parseNumDoc, numDocFromParams, numDocQuery } = require('../utils/numDoc');
const { buscarNumDocsAlumno } = require('../utils/busquedaAlumnoNombre');
const {
  servicioPermiteCantidad,
  descripcionConCantidad,
} = require('../services/programaServicio');

function num(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
  return Number(v) || 0;
}
function toDec(n) { return mongoose.Types.Decimal128.fromString(String(Number(n) || 0)); }

async function buscarServicioCatalogo(idServ) {
  const raw = String(idServ ?? '').trim();
  if (!raw) return null;
  const n = Number(raw);
  const or = [{ idServ: raw }];
  if (Number.isFinite(n)) or.push({ idServ: n });
  return cat.servicios.findOne({ $or: or }).lean();
}

function plano(doc, extra = {}) {
  const o = doc.toObject ? doc.toObject() : doc;
  const valor = num(o.valor);
  const abonado = num(o.abonado);
  const saldo = num(o.saldo) || Math.max(0, valor - abonado);
  const fecha = o.fechaCreacion || o.createdAt || null;
  return {
    ...o,
    valor,
    abonado,
    saldo,
    cantidad: o.cantidad != null ? Number(o.cantidad) : undefined,
    valorUnitario: o.valorUnitario != null ? num(o.valorUnitario) : undefined,
    fecha,
    fechaCreacion: fecha,
    ...extra,
  };
}

async function enriquecerItemsLiquidacion(docs) {
  const idMats = [
    ...new Set(
      docs
        .map((d) => d.idMat)
        .filter(Boolean)
        .map((id) => String(id)),
    ),
  ];
  const tarifaPorMat = new Map();
  if (idMats.length) {
    const mats = await Matricula.find({ _id: { $in: idMats } }).select('tarifa').lean();
    for (const m of mats) tarifaPorMat.set(String(m._id), Number(m.tarifa));
  }
  return docs.map((doc) => {
    const raw = doc.toObject ? doc.toObject() : doc;
    const tarifaMatricula = raw.idMat ? tarifaPorMat.get(String(raw.idMat)) ?? null : null;
    const esVirtual = esTarifaVirtual(tarifaMatricula);
    return plano(doc, { tarifaMatricula, esVirtual });
  });
}

function nombreAlumno(a) {
  if (!a) return '';
  return [a.nombre1, a.nombre2, a.apellido1, a.apellido2].filter(Boolean).join(' ').trim();
}

/** Todos los ítems con saldo pendiente (histórico completo, sin filtro de caja ni fecha). */
function filtroSaldoPendiente(extra = {}) {
  return {
    ...extra,
    $expr: {
      $gt: [
        {
          $subtract: [
            { $toDouble: { $ifNull: ['$valor', 0] } },
            { $toDouble: { $ifNull: ['$abonado', 0] } },
          ],
        },
        0.0001,
      ],
    },
  };
}

exports.listarConSaldo = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const limit = Math.min(2000, Math.max(1, Number(req.query.limit) || 500));

    let filtro = filtroSaldoPendiente();
    if (req.idSede) {
      filtro = { ...filtro, idSede: String(req.idSede).trim() };
    }

    if (q) {
      const nd = parseNumDoc(q);
      if (nd != null) {
        filtro = filtroSaldoPendiente({ numDoc: nd });
      } else {
        const numDocs = await buscarNumDocsAlumno(DatosAlumno, q);
        if (!numDocs.length) {
          return res.json({
            items: [],
            total: 0,
            skip,
            limit,
            totales: { valor: 0, abonado: 0, saldo: 0 },
          });
        }
        filtro = filtroSaldoPendiente({ numDoc: { $in: numDocs } });
      }
    }

    const [total, docs, agg] = await Promise.all([
      Liquidacion.countDocuments(filtro),
      Liquidacion.find(filtro)
        .sort({ fechaCreacion: -1, createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Liquidacion.aggregate([
        { $match: filtro },
        {
          $group: {
            _id: null,
            valor: { $sum: { $toDouble: { $ifNull: ['$valor', 0] } } },
            abonado: { $sum: { $toDouble: { $ifNull: ['$abonado', 0] } } },
            saldo: {
              $sum: {
                $subtract: [
                  { $toDouble: { $ifNull: ['$valor', 0] } },
                  { $toDouble: { $ifNull: ['$abonado', 0] } },
                ],
              },
            },
          },
        },
      ]),
    ]);

    const numDocs = [...new Set(docs.map((d) => d.numDoc).filter((n) => n != null))];
    const alumnos = numDocs.length
      ? await DatosAlumno.find({ numDoc: { $in: numDocs } }).lean()
      : [];
    const alumnoMap = Object.fromEntries(alumnos.map((a) => [String(a.numDoc), a]));
    const { resolverTipoIngresoDesdeIdServ } = require('../services/tipoIngresoResolver');

    const items = [];
    for (const doc of docs) {
      const p = plano(doc);
      const a = alumnoMap[String(doc.numDoc)];
      const tipoIng = doc.idServ ? await resolverTipoIngresoDesdeIdServ(doc.idServ) : null;
      items.push({
        ...p,
        alumnoNombre: nombreAlumno(a) || String(doc.numDoc),
        alumnoDoc: doc.numDoc,
        tipoIngresoDescr: tipoIng?.tipo || null,
      });
    }

    items.sort(
      (a, b) =>
        new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime() ||
        b.saldo - a.saldo ||
        String(a.descripcion || '').localeCompare(String(b.descripcion || ''), 'es'),
    );

    const totRow = agg[0] || { valor: 0, abonado: 0, saldo: 0 };
    res.json({
      items,
      total,
      skip,
      limit,
      totales: {
        valor: totRow.valor || 0,
        abonado: totRow.abonado || 0,
        saldo: totRow.saldo || 0,
      },
    });
  } catch (e) {
    next(e);
  }
};

exports.listarPorAlumno = async (req, res, next) => {
  try {
    const numDoc = numDocFromParams(req.params.numDoc);
    if (numDoc == null) return res.status(400).json({ message: 'numDoc inválido' });
    const filter = numDocQuery(numDoc);
    const docs = await Liquidacion.find(filter).sort({ createdAt: -1 });
    const items = await enriquecerItemsLiquidacion(docs);
    const totales = items.reduce(
      (acc, it) => {
        acc.valor += it.valor;
        acc.abonado += it.abonado;
        acc.saldo += it.saldo;
        return acc;
      },
      { valor: 0, abonado: 0, saldo: 0 },
    );
    res.json({ items, totales });
  } catch (e) {
    next(e);
  }
};

exports.obtener = async (req, res, next) => {
  try {
    const it = await Liquidacion.findById(req.params.id);
    if (!it) return res.status(404).json({ message: 'Item no encontrado' });
    res.json(plano(it));
  } catch (e) {
    next(e);
  }
};

function servicioUsaCantidad(serv) {
  return servicioPermiteCantidad(serv);
}

exports.crear = async (req, res, next) => {
  try {
    const { numDoc: numDocRaw, idServ, descripcion, valor, cantidad } = req.body || {};
    const numDoc = parseNumDoc(numDocRaw);
    if (numDoc == null || !idServ) {
      return res.status(400).json({ message: 'numDoc e idServ son obligatorios' });
    }

    const serv = await buscarServicioCatalogo(idServ);
    if (!serv) {
      return res.status(404).json({ message: 'Servicio no encontrado' });
    }

    const cantNum = Math.floor(Number(cantidad));
    const usaCantidad = servicioUsaCantidad(serv);
    const unitario = num(serv.tarifa1);

    let cant = usaCantidad ? cantNum : null;
    let v;

    if (usaCantidad) {
      if (!(cant > 0)) {
        return res.status(400).json({ message: 'Indique la cantidad (entero mayor a 0)' });
      }
      if (unitario <= 0) {
        return res.status(400).json({ message: 'El servicio no tiene tarifa unitaria configurada' });
      }
      v = unitario * cant;
    } else {
      if (valor == null || valor === '') {
        return res.status(400).json({ message: 'numDoc, idServ y valor son obligatorios' });
      }
      v = Number(valor);
      if (!(v > 0)) return res.status(400).json({ message: 'Valor inválido' });
    }

    const textoUsuario = String(descripcion || '').trim();
    const baseDescr =
      textoUsuario ||
      serv?.descrServicio ||
      serv?.descripcion ||
      serv?.nombre ||
      'Servicio adicional';
    const descr = usaCantidad ? descripcionConCantidad(serv, baseDescr, cant) : baseDescr;

    const doc = {
      numDoc,
      idServ: serv.idServ,
      idProg: serv.idProg || null,
      descripcion: descr,
      valor: toDec(v),
      abonado: toDec(0),
      saldo: toDec(v),
      estado: 'pendiente',
    };
    if (usaCantidad) {
      doc.cantidad = cant;
      doc.valorUnitario = toDec(unitario);
    }

    const it = await Liquidacion.create(doc);
    res.status(201).json(plano(it));
  } catch (e) {
    next(e);
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    const it = await Liquidacion.findById(req.params.id);
    if (!it) return res.status(404).json({ message: 'Item no encontrado' });
    if (num(it.abonado) > 0) {
      return res.status(400).json({ message: 'No se puede eliminar un ítem con pagos registrados' });
    }
    await it.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
