const DocEmpleado = require('../models/DocEmpleado');
const Empleado = require('../models/Empleado');
const { models } = require('../models/catalogos');
const upload = require('../middleware/upload');
const {
  calcularDocumentosRequeridos,
  validarFechasDocumentoEmpleado,
  enriquecerDocumentos,
  enriquecerDocumentoRegistrado,
} = require('../services/empleadoDocumentos');
const {
  calcularAlertasDocumentosEmpleados,
  calcularAlertasDocsFaltantesEmpleados,
} = require('../services/empleadoAlertasDocumentos');
const { obtenerConfigRequisitosDocumentosEmpleados } = require('../services/configRequisitosDocumentosEmpleados');

const itemDocModel = models.itemDocumentosInstructores;

async function buscarEmpleado(id) {
  const q = String(id);
  const n = Number(q);
  return Empleado.findOne({
    $or: [{ idEmpleado: q }, ...(Number.isFinite(n) ? [{ idEmpleado: n }] : [])],
  }).lean();
}

async function buscarEmpleadoOr404(req, res) {
  const emp = await buscarEmpleado(req.params.id);
  if (!emp) {
    res.status(404).json({ message: 'Empleado no encontrado' });
    return null;
  }
  return emp;
}

function pickDocumento(body) {
  const dto = {};
  const idRaw = body.idDocumento ?? body.idDocInst ?? body.idDocVehi;
  if (idRaw != null && idRaw !== '') dto.idDocumento = idRaw;
  if (body.documento != null) dto.documento = String(body.documento).trim();
  if (body.numero != null) dto.numero = String(body.numero).trim();
  if (body.fechaExp) dto.fechaExp = new Date(body.fechaExp);
  if (body.fechaVence) dto.fechaVence = new Date(body.fechaVence);
  return dto;
}

exports.documentosRequeridos = async (req, res, next) => {
  try {
    const emp = await buscarEmpleadoOr404(req, res);
    if (!emp) return;
    res.json(await calcularDocumentosRequeridos(emp));
  } catch (e) {
    next(e);
  }
};

exports.listarDocumentos = async (req, res, next) => {
  try {
    const emp = await buscarEmpleadoOr404(req, res);
    if (!emp) return;
    res.json(await enriquecerDocumentos(emp.idEmpleado));
  } catch (e) {
    next(e);
  }
};

exports.crearDocumento = async (req, res, next) => {
  try {
    const emp = await buscarEmpleadoOr404(req, res);
    if (!emp) return;

    const dto = pickDocumento(req.body);
    if (!dto.documento && dto.idDocumento != null) {
      const config = await obtenerConfigRequisitosDocumentosEmpleados();
      const meta = (config.tiposDocumento || []).find((t) => t.id === String(dto.idDocumento));
      if (meta?.nombre) dto.documento = meta.nombre;
      if (!dto.documento) {
        const tipo = await itemDocModel.findOne({ idDocInst: dto.idDocumento }).lean();
        if (tipo?.documentoInst) dto.documento = String(tipo.documentoInst).trim();
      }
    }
    if (!dto.documento) return res.status(400).json({ message: 'documento es obligatorio' });

    const valFechas = await validarFechasDocumentoEmpleado(dto);
    if (!valFechas.ok) return res.status(valFechas.status).json({ message: valFechas.message });

    if (req.file) dto.urlArchivo = upload.publicUrl('empleados', req.file.filename);

    const user = req.user?.username || 'sistema';
    const now = new Date();
    const doc = await DocEmpleado.create({
      ...dto,
      idEmpleado: Number(emp.idEmpleado),
      fechaAudi: now,
      userAddReg: user,
      userChangeRecord: user,
    });
    const config = await obtenerConfigRequisitosDocumentosEmpleados();
    res.status(201).json(await enriquecerDocumentoRegistrado(doc.toObject(), config));
  } catch (e) {
    next(e);
  }
};

exports.actualizarDocumento = async (req, res, next) => {
  try {
    const emp = await buscarEmpleadoOr404(req, res);
    if (!emp) return;

    const docPrev = await DocEmpleado.findOne({
      _id: req.params.docId,
      idEmpleado: Number(emp.idEmpleado),
    });
    if (!docPrev) return res.status(404).json({ message: 'Documento no encontrado' });

    const dto = pickDocumento(req.body);
    if (req.file) dto.urlArchivo = upload.publicUrl('empleados', req.file.filename);

    const merged = {
      idDocumento: dto.idDocumento ?? docPrev.idDocumento,
      fechaExp: dto.fechaExp ?? docPrev.fechaExp,
      fechaVence: dto.fechaVence ?? docPrev.fechaVence,
      ...dto,
    };
    const valFechas = await validarFechasDocumentoEmpleado(merged);
    if (!valFechas.ok) return res.status(valFechas.status).json({ message: valFechas.message });

    const user = req.user?.username || 'sistema';
    const updated = await DocEmpleado.findByIdAndUpdate(
      docPrev._id,
      { ...dto, userChangeRecord: user, fechaMod: new Date() },
      { new: true },
    ).lean();
    const config = await obtenerConfigRequisitosDocumentosEmpleados();
    res.json(await enriquecerDocumentoRegistrado(updated, config));
  } catch (e) {
    next(e);
  }
};

exports.eliminarDocumento = async (req, res, next) => {
  try {
    const emp = await buscarEmpleadoOr404(req, res);
    if (!emp) return;

    const result = await DocEmpleado.deleteOne({
      _id: req.params.docId,
      idEmpleado: Number(emp.idEmpleado),
    });
    if (!result.deletedCount) return res.status(404).json({ message: 'Documento no encontrado' });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

/** Resumen global de vencimientos — cualquier usuario autenticado con alarma. */
exports.alertasDocumentos = async (_req, res, next) => {
  try {
    res.json(await calcularAlertasDocumentosEmpleados());
  } catch (e) {
    next(e);
  }
};

/** Documentos requeridos sin registrar — alerta global. */
exports.alertasDocumentosFaltantes = async (_req, res, next) => {
  try {
    res.json(await calcularAlertasDocsFaltantesEmpleados());
  } catch (e) {
    next(e);
  }
};
