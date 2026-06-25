const Matricula = require('../models/Matricula');
const { parseNumDoc, numDocFromParams, numDocQuery } = require('../utils/numDoc');
const {
  num,
} = require('../services/programaServicio');
const { normalizarTipoRegularJornada, TIPO_REGULAR_JORNADA_DEFAULT } = require('../constants/tipoRegularJornada');
const { crearMatriculaDesdeBody } = require('../services/matriculaCreator');
const { buscarPrograma } = require('../services/programaServicio');
const { previewRevalidacionMatricula } = require('../services/revalidacionPrograma');
const {
  cargarMatriculaCuotas,
  actualizarCuotasSemestreMatricula,
} = require('../services/ajusteCuotasSemestre');

exports.crearMatriculaDesdeBody = crearMatriculaDesdeBody;

exports.previewRevalidacion = async (req, res, next) => {
  try {
    const numDoc = parseNumDoc(req.query.numDoc);
    const idPrograma = req.query.idPrograma || req.query.idProg;
    if (numDoc == null || !idPrograma) {
      return res.status(400).json({ message: 'numDoc e idPrograma son obligatorios' });
    }
    const prog = await buscarPrograma(idPrograma);
    if (!prog) return res.status(404).json({ message: 'Programa no encontrado' });
    res.json(await previewRevalidacionMatricula(numDoc, prog));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const result = await crearMatriculaDesdeBody(req.body, req.idSede, { usuario: req.user, desdePortal: false });
    res.status(201).json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

function normalizarPagada(v) {
  if (v === true || v === 'true') return 'Pagado';
  if (v === false || v === 'false') return 'No Pago';
  if (v == null || v === '') return 'No Pago';
  return String(v);
}

exports.listarPorAlumno = async (req, res, next) => {
  try {
    const numDoc = numDocFromParams(req.params.numDoc);
    if (numDoc == null) return res.status(400).json({ message: 'numDoc inválido' });
    const filter = numDocQuery(numDoc);
    const rows = await Matricula.find(filter).sort({ createdAt: -1 }).lean();
    res.json(
      rows.map((r) => ({
        ...r,
        valorMat: num(r.valorMat),
        pagada: normalizarPagada(r.pagada),
      })),
    );
  } catch (e) {
    next(e);
  }
};

exports.obtenerCuotasSemestre = async (req, res, next) => {
  try {
    const info = await cargarMatriculaCuotas(req.params.id);
    res.json(info);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.actualizarCuotasSemestre = async (req, res, next) => {
  try {
    const info = await actualizarCuotasSemestreMatricula(req.params.id, req.body, req.user);
    res.json(info);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};
