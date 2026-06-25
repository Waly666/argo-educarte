const QRCode = require('qrcode');
const Ingreso = require('../models/Ingreso');
const Liquidacion = require('../models/Liquidacion');
const DatosAlumno = require('../models/DatosAlumno');
const { models: cat } = require('../models/catalogos');
const { obtenerConfigRecibo } = require('../services/configRecibo');
const { numDocQuery } = require('../utils/numDoc');
const { generarHtmlIngreso } = require('../services/comprobanteHtml');
const { numDocToString } = require('../utils/numDoc');
const { esIngresoCaja } = require('../utils/ingresoClasificacion');

function num(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
  return Number(v) || 0;
}

function nombreAlumno(a) {
  if (!a) return '';
  return [a.nombre1, a.nombre2, a.apellido1, a.apellido2].filter(Boolean).join(' ').trim();
}

async function enriquecerIngreso(p) {
  const tipo = await cat.catTipoPago
    .findOne({ $or: [{ idTipoPago: p.idTipoPago }, { codigo: p.idTipoPago }] })
    .lean();
  const { resolverTipoIngresoIngreso, formaPagoDesdeCatalogo } = require('../services/tipoIngresoResolver');
  const tipoIng = await resolverTipoIngresoIngreso(p);
  const banco = p.idBanco
    ? await cat.bancos
        .findOne({
          $or: [
            { idBanco: p.idBanco },
            { idbanco: p.idBanco },
            { idbanco: Number(p.idBanco) },
            { codigo: p.idBanco },
          ],
        })
        .lean()
    : null;
  let cuentaBancariaDescr = null;
  if (p.idCuentaBancaria) {
    const n = Number(p.idCuentaBancaria);
    const cuenta = await cat.cuentasBancarias
      .findOne({
        $or: [
          { idCuentaBancaria: p.idCuentaBancaria },
          ...(Number.isFinite(n) ? [{ idCuentaBancaria: n }, { idCuenta: n }] : []),
          { idCuenta: p.idCuentaBancaria },
          { numCuenta: p.idCuentaBancaria },
          ...(Number.isFinite(n) ? [{ numCuenta: n }] : []),
        ],
      })
      .lean();
    if (cuenta) {
      cuentaBancariaDescr = [(cuenta.banco || '').trim(), (cuenta.tipo || '').trim(), cuenta.numCuenta ?? '']
        .filter(Boolean)
        .join(' — ');
    }
  }
  return {
    ...p,
    valor: num(p.valor),
    tipoPagoDescr: tipo?.descripcion || tipo?.nombre || p.idTipoPago,
    formaPago: p.formaPago || formaPagoDesdeCatalogo(tipo, p.idTipoPago),
    bancoDescr: p.bancoEmisor || banco?.descripcion || banco?.nombre || banco?.banco || null,
    cuentaBancariaDescr,
    numTransferencia: p.numTransferencia || p.numComprobante || null,
    tipoIngreso: p.tipoIngreso || tipoIng?.tipo || null,
    tipoIngresoDescr: p.tipoIngreso || tipoIng?.tipo || null,
    esIngresoCaja: esIngresoCaja(p),
  };
}

async function armarRecibo(id) {
  const ing = await Ingreso.findById(id).lean();
  if (!ing) return null;

  const esCaja = esIngresoCaja(ing);

  const liq = ing.idLiquidacion ? await Liquidacion.findById(ing.idLiquidacion).lean() : null;
  const idSedeDoc = ing.idSede || liq?.idSede || null;

  let detalleItems = null;
  if (Array.isArray(ing.detalle) && ing.detalle.length) {
    const ids = ing.detalle.map((d) => d.idLiquidacion).filter(Boolean);
    const liqs = ids.length ? await Liquidacion.find({ _id: { $in: ids } }).lean() : [];
    const liqMap = Object.fromEntries(liqs.map((l) => [String(l._id), l]));
    detalleItems = ing.detalle.map((d) => {
      const l = liqMap[String(d.idLiquidacion)];
      return {
        descripcion: d.descripcion || l?.descripcion || 'Ítem',
        valor: num(d.valor),
        saldo: l ? num(l.saldo) : null,
      };
    });
  }

  const [config, alumno, ingreso] = await Promise.all([
    obtenerConfigRecibo(idSedeDoc),
    ing.numDoc ? DatosAlumno.findOne(numDocQuery(ing.numDoc)).lean() : null,
    enriquecerIngreso(ing),
  ]);

  const prefIng = (config.prefijoComprobanteIngreso || 'CI').trim();
  const numeroRecibo = ing.numRecibo || `${prefIng}-${String(ing._id).slice(-8).toUpperCase()}`;
  const qrTexto = JSON.stringify({
    recibo: numeroRecibo,
    ingresoId: String(ing._id),
    numDoc: ing.numDoc || ing.documentoTercero || null,
    valor: ingreso.valor,
    fecha: ing.fecha || ing.createdAt,
    nit: config.nit || '',
    tipo: esCaja ? 'caja' : 'alumno',
  });

  let qrDataUrl = null;
  if (config.mostrarQr !== false) {
    try {
      qrDataUrl = await QRCode.toDataURL(qrTexto, { width: 140, margin: 1, errorCorrectionLevel: 'M' });
    } catch {
      qrDataUrl = null;
    }
  }

  const pagador = esCaja
    ? {
        numDoc: ing.documentoTercero || '—',
        nombreCompleto: ing.recibidoDe || ing.concepto || 'Tercero',
        tipoPersona: ing.tipoPersona || null,
      }
    : alumno
      ? {
          numDoc: numDocToString(alumno.numDoc ?? ing.numDoc),
          tipoDoc: alumno.tipoDoc,
          nombreCompleto: nombreAlumno(alumno),
          celular: alumno.celular,
          correo: alumno.correo,
        }
      : {
          numDoc: numDocToString(ing.numDoc) || '—',
          nombreCompleto: ing.recibidoDe || ing.recibiDe || String(ing.numDoc || '—'),
        };

  return {
    config,
    ingreso,
    esIngresoCaja: esCaja,
    alumno: pagador,
    liquidacion: liq
      ? {
          descripcion: liq.descripcion,
          valor: num(liq.valor),
          abonado: num(liq.abonado),
          saldo: num(liq.saldo),
          estado: liq.estado,
        }
      : esCaja
        ? {
            descripcion: ing.concepto || ingreso.tipoIngresoDescr || 'Ingreso de caja',
            valor: ingreso.valor,
            abonado: ingreso.valor,
            saldo: 0,
            estado: 'pagado',
          }
        : null,
    detalle: detalleItems,
    numeroRecibo,
    qrDataUrl,
    qrTexto,
  };
}

exports.datos = async (req, res, next) => {
  try {
    const data = await armarRecibo(req.params.id);
    if (!data) return res.status(404).json({ message: 'Ingreso no encontrado' });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

exports.html = async (req, res, next) => {
  try {
    const data = await armarRecibo(req.params.id);
    if (!data) return res.status(404).send('Ingreso no encontrado');

    const html = generarHtmlIngreso(data);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    next(e);
  }
};

exports.armarRecibo = armarRecibo;
