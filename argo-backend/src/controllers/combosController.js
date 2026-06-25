const {
  listarCombos,
  obtenerCombo,
  crearCombo,
  actualizarCombo,
  eliminarCombo,
  previstaCombo,
  TARIFA_COMBO,
} = require('../services/combosPrograma');
const { crearMatriculaDesdeBody } = require('../services/matriculaCreator');
const { parseNumDoc, numDocQuery } = require('../utils/numDoc');
const DatosAlumno = require('../models/DatosAlumno');

exports.listar = async (req, res, next) => {
  try {
    const soloActivos = req.query.todos !== 'true';
    res.json(await listarCombos({ soloActivos }));
  } catch (e) {
    next(e);
  }
};

exports.obtener = async (req, res, next) => {
  try {
    res.json(await obtenerCombo(req.params.id));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const { nombre, descripcion, programas } = req.body || {};
    const doc = await crearCombo({
      nombre,
      descripcion,
      programas,
      usuarioErp: req.user?.username || req.user?.nick,
    });
    res.status(201).json({ combo: doc, message: `Combo "${doc.nombre}" creado.` });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const doc = await actualizarCombo(req.params.id, req.body || {});
    res.json({ combo: doc, message: `Combo "${doc.nombre}" actualizado.` });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    res.json(await eliminarCombo(req.params.id));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.prevista = async (req, res, next) => {
  try {
    res.json(await previstaCombo(req.params.id));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

/**
 * POST /combos/:id/aplicar
 * Body: { numDoc }
 * Crea una matrícula + liquidación por cada programa del combo (tarifa 2).
 */
exports.aplicar = async (req, res, next) => {
  try {
    const numDoc = parseNumDoc(req.body?.numDoc);
    if (numDoc == null) {
      return res.status(400).json({ message: 'numDoc es obligatorio' });
    }

    const alumno = await DatosAlumno.findOne(numDocQuery(numDoc)).lean();
    if (!alumno) {
      return res.status(404).json({ message: 'Alumno no encontrado en ARGO' });
    }

    const vista = await previstaCombo(req.params.id);
    if (!vista.programas.length) {
      return res.status(400).json({ message: 'El combo no tiene programas configurados' });
    }

    const resultados = [];
    const errores = [];

    for (const p of vista.programas) {
      try {
        const r = await crearMatriculaDesdeBody(
          {
            numDoc,
            idPrograma: p.idPrograma,
            tarifa: TARIFA_COMBO,
            observaciones: `Combo: ${vista.nombre}`,
          },
          req.idSede,
        );
        resultados.push({
          idPrograma: p.idPrograma,
          nombreProg: p.nombreProg,
          valor: p.valor,
          matricula: r.matricula,
          liquidacion: r.liquidacion,
        });
      } catch (err) {
        errores.push({
          idPrograma: p.idPrograma,
          nombreProg: p.nombreProg,
          error: err.message || 'Error al matricular',
        });
      }
    }

    const totalValor = resultados.reduce((acc, r) => acc + (r.valor || 0), 0);

    res.status(errores.length && !resultados.length ? 400 : 201).json({
      ok: resultados.length > 0,
      combo: { id: vista.id, nombre: vista.nombre },
      numDoc,
      nombreAlumno: [alumno.apellido1, alumno.apellido2, alumno.nombre1, alumno.nombre2]
        .filter(Boolean).join(' '),
      totalValor,
      resultados,
      errores,
      message: errores.length
        ? `${resultados.length} matrícula(s) creada(s). ${errores.length} no se pudo(n) procesar.`
        : `${resultados.length} matrícula(s) creada(s) a tarifa 2 (combo "${vista.nombre}").`,
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};
