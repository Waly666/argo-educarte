const { listarInformes, obtenerInforme } = require('../constants/informesAcademicosCatalogo');
const { ejecutarInforme, exportarInformeExcel } = require('../services/informesAcademicos');
const { registrarAuditoria } = require('../services/auditoria');

exports.catalogo = async (_req, res) => {
  res.json({ informes: listarInformes() });
};

exports.obtener = async (req, res) => {
  const meta = obtenerInforme(req.params.id);
  if (!meta) return res.status(404).json({ message: 'Informe no encontrado' });
  res.json(meta);
};

exports.ejecutar = async (req, res, next) => {
  try {
    const r = await ejecutarInforme(req.params.id, req.query, { idSede: req.idSede });
    registrarAuditoria({
      req,
      accion: 'informe_academico',
      entidad: 'informes',
      resumen: `Informe ${r.etiqueta}: ${r.total} filas`,
      datosDespues: { informe: req.params.id, filtros: req.query, total: r.total },
    }).catch(() => {});
    res.json(r);
  } catch (e) {
    next(e);
  }
};

exports.exportar = async (req, res, next) => {
  try {
    const { buffer, nombre } = await exportarInformeExcel(req.params.id, req.query, {
      idSede: req.idSede,
    });
    registrarAuditoria({
      req,
      accion: 'informe_academico_export',
      entidad: 'informes',
      resumen: `Exportación Excel: ${req.params.id}`,
      datosDespues: { informe: req.params.id, filtros: req.query },
    }).catch(() => {});
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (e) {
    next(e);
  }
};
