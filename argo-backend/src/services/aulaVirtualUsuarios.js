const DatosAlumno = require('../models/DatosAlumno');
const UsuarioPortal = require('../models/UsuarioPortal');
const { parseNumDoc, numDocQuery } = require('../utils/numDoc');
const { TIPO_VIRTUAL } = require('../constants/tipoAlumno');
const { crearUsuarioPortalAlumno } = require('./aulaVirtualMatricula');

function nombreCompleto(a) {
  if (!a) return '';
  return [a.apellido1, a.apellido2, a.nombre1, a.nombre2].filter(Boolean).join(' ').trim();
}

function nombreMayusculas(v) {
  return String(v || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function coincideBusqueda(row, q) {
  const t = String(q || '').trim().toLowerCase();
  if (!t) return true;
  const soloDigitos = t.replace(/\D/g, '');
  if (soloDigitos && String(row.numDoc).includes(soloDigitos)) return true;
  if (row.email?.toLowerCase().includes(t)) return true;
  if (row.nombreCompleto?.toLowerCase().includes(t)) return true;
  if (row.celular?.toLowerCase().includes(t)) return true;
  return false;
}

async function asegurarAlumnoVirtual({ alumno, email, usuarioErp }) {
  const numDoc = parseNumDoc(alumno?.numDoc);
  if (numDoc == null) {
    const err = new Error('Número de documento inválido');
    err.status = 400;
    throw err;
  }

  const mail = String(email || '').trim().toLowerCase();
  let da = await DatosAlumno.findOne(numDocQuery(numDoc)).lean();
  if (!da) {
    const apellido1 = nombreMayusculas(alumno?.apellido1);
    const nombre1 = nombreMayusculas(alumno?.nombre1);
    if (!apellido1 || !nombre1) {
      const err = new Error('Apellido y nombre son obligatorios para crear la ficha del alumno');
      err.status = 400;
      throw err;
    }
    const creado = await DatosAlumno.create({
      tipoAlumno: TIPO_VIRTUAL,
      tipoDoc: alumno?.tipoDoc || '1',
      numDoc,
      expedida: alumno?.expedida || '',
      apellido1,
      apellido2: nombreMayusculas(alumno?.apellido2),
      nombre1,
      nombre2: nombreMayusculas(alumno?.nombre2),
      fechaNac: alumno?.fechaNac ? new Date(alumno.fechaNac) : null,
      genero: alumno?.genero || '',
      correo: mail,
      celular: String(alumno?.celular || '').trim(),
      direccion: String(alumno?.direccion || '').trim(),
      munOrigen: alumno?.munOrigen || alumno?.codMunicipio || '',
      codMunicipio: alumno?.codMunicipio || alumno?.munOrigen || '',
      userAddReg: usuarioErp || 'erp-aula',
    });
    return { alumnoCreado: true, alumno: creado.toObject() };
  }

  const patch = {};
  if (!da.correo && mail) patch.correo = mail;
  if (!da.celular && alumno?.celular) patch.celular = String(alumno.celular).trim();
  if (!da.direccion && alumno?.direccion) patch.direccion = String(alumno.direccion).trim();
  if (Object.keys(patch).length) {
    await DatosAlumno.updateOne({ _id: da._id }, { $set: patch });
    da = { ...da, ...patch };
  }

  return { alumnoCreado: false, alumno: da };
}

/**
 * Crea o actualiza ficha alumno (virtual si es nueva) y cuenta del portal con contraseña elegida por staff.
 */
async function crearUsuarioPortalAdmin({ email, password, alumno, usuarioErp }) {
  const mail = String(email || '').trim().toLowerCase();
  if (!mail) {
    const err = new Error('El correo del portal es obligatorio');
    err.status = 400;
    throw err;
  }

  const pass = String(password || '').trim();
  if (!pass || pass.length < 6) {
    const err = new Error('La contraseña debe tener al menos 6 caracteres');
    err.status = 400;
    throw err;
  }

  const { alumnoCreado, alumno: da } = await asegurarAlumnoVirtual({ alumno, email: mail, usuarioErp });
  const usuarioPortal = await crearUsuarioPortalAlumno({
    numDoc: da.numDoc,
    email: mail,
    password: pass,
  });

  const etiqueta = nombreCompleto(da) || mail;
  let message = usuarioPortal.creado
    ? `Cuenta del portal creada para ${etiqueta}.`
    : `Acceso del portal actualizado para ${etiqueta}.`;
  if (alumnoCreado) {
    message = `Ficha de alumno virtual creada y ${message.charAt(0).toLowerCase()}${message.slice(1)}`;
  }

  return {
    ok: true,
    message,
    alumnoCreado,
    nombreCompleto: etiqueta,
    numDoc: da.numDoc,
    usuarioPortal,
  };
}

async function listarUsuariosPortalAdmin({ q = '', limit = 200 } = {}) {
  const cap = Math.min(500, Math.max(1, Number(limit) || 200));
  const portalUsers = await UsuarioPortal.find().sort({ createdAt: -1 }).limit(cap).lean();

  const numDocs = [...new Set(portalUsers.map((u) => u.numDoc).filter((n) => n != null))];
  const alumnos = numDocs.length
    ? await DatosAlumno.find({ $or: numDocs.map((n) => numDocQuery(n)) }).lean()
    : [];
  const alumnoMap = new Map(alumnos.map((a) => [Number(a.numDoc), a]));

  let rows = portalUsers.map((u) => {
    const a = alumnoMap.get(Number(u.numDoc)) || null;
    return {
      id: String(u._id),
      email: u.email,
      numDoc: u.numDoc,
      activo: u.activo !== false,
      createdAt: u.createdAt,
      ultimoAcceso: u.ultimoAcceso || null,
      nombreCompleto: nombreCompleto(a),
      celular: a?.celular || '',
      tipoDoc: a?.tipoDoc || '',
    };
  });

  if (q) rows = rows.filter((r) => coincideBusqueda(r, q));

  return {
    total: rows.length,
    usuarios: rows,
  };
}

async function eliminarUsuarioPortal(id) {
  const idStr = String(id || '').trim();
  if (!idStr) {
    const err = new Error('ID de usuario requerido');
    err.status = 400;
    throw err;
  }
  const doc = await UsuarioPortal.findByIdAndDelete(idStr);
  if (!doc) {
    const err = new Error('Usuario del portal no encontrado');
    err.status = 404;
    throw err;
  }
  return {
    ok: true,
    message: `Cuenta del portal ${doc.email} eliminada. La ficha del alumno en el ERP no se modificó.`,
    email: doc.email,
    numDoc: doc.numDoc,
  };
}

module.exports = {
  listarUsuariosPortalAdmin,
  eliminarUsuarioPortal,
  crearUsuarioPortalAdmin,
};
