/** Consulta por numeroDocumento (y legacy numDoc numérico). */
function numeroDocumentoQuery(doc) {
  const s = String(doc ?? '').trim();
  if (!s) return null;
  const n = Number(s.replace(/\D/g, ''));
  const or = [{ numeroDocumento: s }];
  if (Number.isFinite(n) && n > 0) {
    or.push({ numDoc: n }, { numeroDocumento: String(n) });
  }
  return { $or: or };
}

function normalizarEmpleadoLegacy(raw) {
  if (!raw) return {};
  const e = { ...raw };
  if (!e.numeroDocumento && e.numDoc != null) e.numeroDocumento = String(e.numDoc);
  if (!e.primerNombre && e.nombre1) e.primerNombre = e.nombre1;
  if (!e.segundoNombre && e.nombre2) e.segundoNombre = e.nombre2;
  if (!e.primerApellido && e.apellido1) e.primerApellido = e.apellido1;
  if (!e.segundoApellido && e.apellido2) e.segundoApellido = e.apellido2;
  if (!e.tipoDocumento && e.tipoDoc) e.tipoDocumento = e.tipoDoc;
  if (!e.correoPersonal && e.correo) e.correoPersonal = e.correo;
  return e;
}

function nombreCompletoEmpleado(e) {
  if (!e) return '';
  const emp = normalizarEmpleadoLegacy(e);
  const n = [emp.primerNombre, emp.segundoNombre].filter(Boolean).join(' ').trim();
  const a = [emp.primerApellido, emp.segundoApellido].filter(Boolean).join(' ').trim();
  return `${n} ${a}`.trim();
}

module.exports = { numeroDocumentoQuery, normalizarEmpleadoLegacy, nombreCompletoEmpleado };
