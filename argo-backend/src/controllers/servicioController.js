const { models: cat } = require('../models/catalogos');
const Liquidacion = require('../models/Liquidacion');
const {
  buscarPrograma,
  num,
  maxNumericId,
  insertarCatalogo,
  servicioPermiteCantidad,
} = require('../services/programaServicio');
const { filtrarServicios } = require('../services/sedeOferta');

function escRegexServicio(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.listar = async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const esCatalogo = req.query.catalogo === '1';
    const soloProg = req.query.soloPrograma === 'true';
    const sinProg = req.query.sinPrograma === 'true';
    const minQ = esCatalogo ? 1 : 2;

    const clauses = [];
    if (soloProg) clauses.push({ idProg: { $ne: null } });
    else if (sinProg) {
      clauses.push({
        $or: [{ idProg: null }, { idProg: { $exists: false } }, { idProg: '' }],
      });
    }
    if (q.length >= minQ) {
      const re = new RegExp(escRegexServicio(q), 'i');
      clauses.push({ $or: [{ descrServicio: re }, { tipoServ: re }] });
    }
    const filter = clauses.length ? (clauses.length === 1 ? clauses[0] : { $and: clauses }) : {};

    const limitRaw = Number(req.query.limit);
    let limit = limitRaw > 0 ? limitRaw : 0;
    if (!limit && esCatalogo) limit = q.length >= 1 ? 35 : 40;
    let query = cat.servicios.find(filter).sort({ idServ: 1 });
    if (limit > 0) query = query.limit(limit);
    let rows = await query.lean();
    if (req.idSede && req.query.catalogo !== '1') {
      rows = await filtrarServicios(rows, req.idSede);
    }
    const out = [];
    for (const s of rows) {
      let programa = null;
      if (s.idProg != null) programa = await buscarPrograma(s.idProg);
      out.push({
        ...s,
        tarifa1: num(s.tarifa1),
        tarifa2: num(s.tarifa2),
        tarifa3: num(s.tarifa3),
        tarifaVirtual: num(s.tarifaVirtual),
        programaNombre: programa?.nombreProg || null,
        programaCodigo: programa?.codigoProg || null,
        permiteCantidad: servicioPermiteCantidad(s),
      });
    }
    res.json(out);
  } catch (e) {
    next(e);
  }
};

exports.obtener = async (req, res, next) => {
  try {
    const id = req.params.id;
    const n = Number(id);
    const serv = await cat.servicios
      .findOne({
        $or: [{ idServ: id }, ...(Number.isFinite(n) ? [{ idServ: n }] : [])],
      })
      .lean();
    if (!serv) return res.status(404).json({ message: 'Servicio no encontrado' });
    const programa = serv.idProg != null ? await buscarPrograma(serv.idProg) : null;
    res.json({ servicio: serv, programa });
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const id = req.params.id;
    const n = Number(id);
    const serv = await cat.servicios.findOne({
      $or: [{ idServ: id }, ...(Number.isFinite(n) ? [{ idServ: n }] : [])],
    });
    if (!serv) return res.status(404).json({ message: 'Servicio no encontrado' });

    const body = req.body || {};
    const patch = {};
    if (body.descrServicio != null) patch.descrServicio = String(body.descrServicio).trim();
    if (body.tipoServ != null) {
      const ts = body.tipoServ;
      patch.tipoServ = typeof ts === 'number' ? ts : String(ts).trim();
    }
    if (body.idProg != null && body.idProg !== '') {
      const ip = body.idProg;
      patch.idProg = Number.isFinite(Number(ip)) ? Number(ip) : String(ip);
    }
    if (body.tarifa1 != null) patch.tarifa1 = num(body.tarifa1);
    if (body.tarifa2 != null) patch.tarifa2 = num(body.tarifa2);
    if (body.tarifa3 != null) patch.tarifa3 = num(body.tarifa3);
    if (body.tarifaVirtual != null) patch.tarifaVirtual = num(body.tarifaVirtual);
    if (body.facturar != null) patch.facturar = body.facturar;
    if (body.iva != null) patch.iva = num(body.iva);
    if (body.condicionIva != null) {
      const c = String(body.condicionIva).trim().toLowerCase();
      patch.condicionIva = ['gravado', 'exento', 'excluido'].includes(c) ? c : 'gravado';
    }

    if (serv.idProg != null && patch.tarifa1 != null) {
      const prog = await buscarPrograma(serv.idProg);
      if (prog) {
        await cat.programas.updateOne(
          { idPrograma: prog.idPrograma },
          { $set: { valorMatricula: patch.tarifa1, fechaMod: new Date() } },
        );
      }
    }
    patch.fechaMod = new Date();
    patch.userChangeRecord = req.user?.username || 'sistema';

    await cat.servicios.updateOne({ _id: serv._id }, { $set: patch });
    const actualizado = await cat.servicios.findById(serv._id).lean();
    res.json({ servicio: actualizado });
  } catch (e) {
    next(e);
  }
};

/** Servicio independiente (trámites, seguros, RUNT, etc.) sin programa vinculado. */
exports.crear = async (req, res, next) => {
  try {
    const body = req.body || {};
    const descrServicio = String(body.descrServicio || '').trim();
    if (!descrServicio) {
      return res.status(400).json({ message: 'descrServicio es obligatorio' });
    }

    const tarifa1 = num(body.tarifa1);
    const valorVariable = body.valorVariable === true || body.valorVariable === 'true' || tarifa1 <= 0;
    if (!valorVariable && tarifa1 <= 0) {
      return res.status(400).json({
        message: 'Indique tarifa 1 mayor a 0, o deje tarifa en 0 si el valor se define al liquidar',
      });
    }

    const idProgRaw = body.idProg;
    const vincularProg = idProgRaw != null && idProgRaw !== '';
    let idProg = null;
    if (vincularProg) {
      const prog = await buscarPrograma(idProgRaw);
      if (!prog) return res.status(404).json({ message: 'Programa no encontrado' });
      const dup = await cat.servicios.findOne({ idProg: prog.idPrograma }).lean();
      if (dup) {
        return res.status(409).json({
          message: 'Ese programa ya tiene un servicio de matrícula vinculado',
        });
      }
      idProg = prog.idPrograma;
    }

    const idServ = await maxNumericId(cat.servicios, 'idServ');
    const user = req.user?.username || 'sistema';
    const now = new Date();
    const tipoServ =
      body.tipoServ != null && body.tipoServ !== ''
        ? typeof body.tipoServ === 'number'
          ? body.tipoServ
          : String(body.tipoServ).trim()
        : 'SEG';

    const doc = {
      idServ,
      tipoServ,
      idProg,
      descrServicio,
      facturar: body.facturar ?? 'NO',
      iva: num(body.iva),
      condicionIva: ['gravado', 'exento', 'excluido'].includes(String(body.condicionIva || '').toLowerCase())
        ? String(body.condicionIva).toLowerCase()
        : 'gravado',
      tarifa1: valorVariable ? 0 : tarifa1,
      tarifa2: valorVariable ? null : num(body.tarifa2) > 0 ? num(body.tarifa2) : null,
      tarifa3: valorVariable ? null : num(body.tarifa3) > 0 ? num(body.tarifa3) : null,
      tarifaVirtual: valorVariable ? null : num(body.tarifaVirtual) || 0,
      valorVariable: valorVariable || undefined,
      usaCantidad: !valorVariable && body.usaCantidad === true,
      excluirMatricula: !idProg ? true : undefined,
      fechaAudi: now,
      userAddReg: user,
      fechaMod: now,
      userChangeRecord: user,
    };

    const servicio = await insertarCatalogo(cat.servicios, doc);
    res.status(201).json({
      servicio,
      message: idProg
        ? `Servicio #${idServ} creado y vinculado al programa`
        : `Servicio #${idServ} creado (sin programa vinculado)`,
    });
  } catch (e) {
    next(e);
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    const id = req.params.id;
    const n = Number(id);
    const serv = await cat.servicios
      .findOne({
        $or: [{ idServ: id }, ...(Number.isFinite(n) ? [{ idServ: n }] : [])],
      })
      .lean();
    if (!serv) return res.status(404).json({ message: 'Servicio no encontrado' });

    if (serv.idProg != null && serv.idProg !== '') {
      return res.status(409).json({
        message:
          'No se puede eliminar: es servicio de matrícula de un programa. Use el menú Programas.',
      });
    }

    const usado = await Liquidacion.countDocuments({ idServ: String(serv.idServ) });
    if (usado > 0) {
      return res.status(409).json({
        message: 'No se puede eliminar: el servicio tiene liquidaciones asociadas',
      });
    }

    await cat.servicios.deleteOne({ idServ: serv.idServ });
    res.json({ ok: true, message: `Servicio «${serv.descrServicio}» eliminado` });
  } catch (e) {
    next(e);
  }
};
