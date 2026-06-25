const { regexSinTildes } = require('./regexSinTildes');
const { parseNumDoc } = require('./numDoc');

const CAMPOS_NOMBRE_ALUMNO = ['apellido1', 'apellido2', 'nombre1', 'nombre2'];

function normalizarTextoBusqueda(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tokensBusqueda(q) {
  return String(q || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function concatNombreAlumno(doc) {
  return CAMPOS_NOMBRE_ALUMNO.map((k) => String(doc?.[k] || '').trim())
    .filter(Boolean)
    .join(' ');
}

function orTokenEnCamposNombre(token) {
  const re = regexSinTildes(token);
  return { $or: CAMPOS_NOMBRE_ALUMNO.map((campo) => ({ [campo]: re })) };
}

/** Filtro MongoDB: nombre completo, tokens sueltos (apellido2, nombre2…) y documento. */
function filtroBusquedaAlumno(q) {
  const trimmed = String(q || '').trim();
  if (!trimmed) return null;

  const or = [];
  const nd = parseNumDoc(trimmed);
  if (nd != null) or.push({ numDoc: nd });

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 3) {
    or.push({
      $expr: {
        $regexMatch: { input: { $toString: '$numDoc' }, regex: digits },
      },
    });
  }

  const tokens = tokensBusqueda(trimmed);
  if (tokens.length >= 2) {
    or.push({ $and: tokens.map((t) => orTokenEnCamposNombre(t)) });
  }

  const reFull = regexSinTildes(trimmed);
  for (const campo of CAMPOS_NOMBRE_ALUMNO) or.push({ [campo]: reFull });
  or.push({ correo: reFull }, { celular: reFull }, { direccion: reFull }, { munOrigen: reFull }, { codMunicipio: reFull });

  const safeFull = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  or.push({
    $expr: {
      $regexMatch: {
        input: {
          $trim: {
            input: {
              $concat: [
                { $ifNull: ['$apellido1', ''] },
                ' ',
                { $ifNull: ['$apellido2', ''] },
                ' ',
                { $ifNull: ['$nombre1', ''] },
                ' ',
                { $ifNull: ['$nombre2', ''] },
              ],
            },
          },
        },
        regex: safeFull,
        options: 'i',
      },
    },
  });

  return { $or: or };
}

function coincideBusquedaDocumento(numDoc, q) {
  const digits = String(q || '').replace(/\D/g, '');
  if (digits.length < 3) return false;
  return String(numDoc ?? '').includes(digits);
}

/** Coincidencia en memoria (listas filtradas en JS). */
function coincideBusquedaAlumno(doc, q) {
  const trimmed = String(q || '').trim();
  if (!trimmed) return true;

  const nd = parseNumDoc(trimmed);
  if (nd != null && doc?.numDoc != null && Number(doc.numDoc) === nd) return true;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 3 && String(doc?.numDoc ?? '').includes(digits)) return true;

  return coincideBusquedaNombre(doc, trimmed);
}

/** Coincidencia por campos de nombre del alumno o texto ya concatenado. */
function coincideBusquedaNombre(doc, q) {
  const trimmed = String(q || '').trim();
  if (!trimmed) return true;

  const normNombre = normalizarTextoBusqueda(concatNombreAlumno(doc));
  const normQ = normalizarTextoBusqueda(trimmed);
  if (normNombre.includes(normQ)) return true;

  const tokens = tokensBusqueda(trimmed).map(normalizarTextoBusqueda);
  if (tokens.length >= 2) {
    const partes = CAMPOS_NOMBRE_ALUMNO.map((k) => normalizarTextoBusqueda(doc?.[k]));
    return tokens.every((tok) => partes.some((p) => p.includes(tok)));
  }

  return CAMPOS_NOMBRE_ALUMNO.some((k) => normalizarTextoBusqueda(doc?.[k]).includes(normQ));
}

/** Texto libre (nombre completo ya armado) con la misma lógica de tokens. */
function coincideBusquedaTexto(texto, q) {
  const trimmed = String(q || '').trim();
  if (!trimmed) return true;
  const normTexto = normalizarTextoBusqueda(texto);
  const normQ = normalizarTextoBusqueda(trimmed);
  if (normTexto.includes(normQ)) return true;
  const tokens = tokensBusqueda(trimmed).map(normalizarTextoBusqueda);
  if (tokens.length >= 2) {
    const palabras = normTexto.split(/\s+/).filter(Boolean);
    return tokens.every((tok) => palabras.some((p) => p.includes(tok)));
  }
  return normTexto.includes(normQ);
}

/** Devuelve numDoc de alumnos que coinciden con la búsqueda. */
async function buscarNumDocsAlumno(DatosAlumnoModel, q, limit = 300) {
  const trimmed = String(q || '').trim();
  if (!trimmed) return [];
  const nd = parseNumDoc(trimmed);
  if (nd != null) return [nd];
  const filter = filtroBusquedaAlumno(trimmed);
  if (!filter) return [];
  const rows = await DatosAlumnoModel.find(filter).select('numDoc').limit(limit).lean();
  return rows.map((a) => a.numDoc).filter((n) => n != null);
}

module.exports = {
  CAMPOS_NOMBRE_ALUMNO,
  tokensBusqueda,
  concatNombreAlumno,
  filtroBusquedaAlumno,
  coincideBusquedaAlumno,
  coincideBusquedaNombre,
  coincideBusquedaTexto,
  coincideBusquedaDocumento,
  buscarNumDocsAlumno,
  normalizarTextoBusqueda,
};
