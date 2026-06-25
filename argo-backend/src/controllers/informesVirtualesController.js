const {
  informeMatriculasVirtuales,
  informeIngresosEnLinea,
  filasMatriculasCsv,
  filasIngresosCsv,
} = require('../services/informesVirtuales');

exports.matriculasVirtuales = async (req, res, next) => {
  try {
    const { desde, hasta } = req.query || {};
    res.json(await informeMatriculasVirtuales({ desde, hasta }));
  } catch (e) {
    next(e);
  }
};

exports.ingresosEnLinea = async (req, res, next) => {
  try {
    const { desde, hasta } = req.query || {};
    res.json(await informeIngresosEnLinea({ desde, hasta }));
  } catch (e) {
    next(e);
  }
};

exports.exportarMatriculas = async (req, res, next) => {
  try {
    const { desde, hasta } = req.query || {};
    const data = await informeMatriculasVirtuales({ desde, hasta });
    const csv = filasMatriculasCsv(data.filas);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="matriculas-virtuales.csv"');
    res.send(`\uFEFF${csv}`);
  } catch (e) {
    next(e);
  }
};

exports.exportarIngresos = async (req, res, next) => {
  try {
    const { desde, hasta } = req.query || {};
    const data = await informeIngresosEnLinea({ desde, hasta });
    const csv = filasIngresosCsv(data.filas);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ingresos-en-linea.csv"');
    res.send(`\uFEFF${csv}`);
  } catch (e) {
    next(e);
  }
};
