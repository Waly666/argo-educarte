/**
 * Catálogo de informes académicos parametrizables.
 * Cada informe declara filtros y columnas para la UI y validación en backend.
 */

const INFORMES_ACADEMICOS = [
  {
    id: 'programas-servicios',
    etiqueta: 'Programas y servicios',
    descripcion: 'Listado del catálogo académico con tarifas y servicios asociados a cada programa.',
    icono: '▤',
    filtros: [
      { clave: 'q', tipo: 'texto', etiqueta: 'Búsqueda', placeholder: 'Nombre o código de programa…' },
      { clave: 'idPrograma', tipo: 'programa', etiqueta: 'Programa', placeholder: 'Todos los programas' },
      {
        clave: 'idTipCap',
        tipo: 'tipoCap',
        etiqueta: 'Tipo de capacitación',
        placeholder: 'Catálogo al crear programa (ej. Técnico laboral…)',
      },
      { clave: 'activos', tipo: 'booleano', etiqueta: 'Solo programas activos', default: true },
    ],
    columnas: [
      { clave: 'codigoProg', etiqueta: 'Código', tipo: 'texto' },
      { clave: 'nombreProg', etiqueta: 'Programa', tipo: 'texto' },
      { clave: 'tipoCap', etiqueta: 'Tipo capacitación', tipo: 'texto' },
      { clave: 'tipoCertificado', etiqueta: 'Tipo certificado', tipo: 'texto' },
      { clave: 'estadoProg', etiqueta: 'Estado', tipo: 'texto' },
      { clave: 'descrServicio', etiqueta: 'Servicio', tipo: 'texto' },
      { clave: 'tipoServ', etiqueta: 'Tipo serv.', tipo: 'texto' },
      { clave: 'tarifa1', etiqueta: 'Tarifa 1', tipo: 'moneda' },
      { clave: 'tarifa2', etiqueta: 'Tarifa 2', tipo: 'moneda' },
      { clave: 'tarifa3', etiqueta: 'Tarifa 3', tipo: 'moneda' },
      { clave: 'tarifaVirtual', etiqueta: 'Tarifa virtual', tipo: 'moneda' },
    ],
  },
  {
    id: 'alumnos',
    etiqueta: 'Alumnos',
    descripcion:
      'Listado de alumnos con filtros por jornada escolar, tipo, programa matriculado, servicio y fechas de matrícula.',
    icono: '◉',
    filtros: [
      { clave: 'q', tipo: 'texto', etiqueta: 'Búsqueda', placeholder: 'Documento, nombre, celular…' },
      { clave: 'jornada', tipo: 'jornada', etiqueta: 'Jornada escolar', placeholder: 'Todas' },
      { clave: 'tipoAlumno', tipo: 'tipoAlumno', etiqueta: 'Tipo de alumno', placeholder: 'Todos' },
      { clave: 'idPrograma', tipo: 'programa', etiqueta: 'Programa matriculado', placeholder: 'Todos' },
      {
        clave: 'idServicio',
        tipo: 'servicio',
        etiqueta: 'Servicio contratado',
        placeholder: 'Todos',
        servicioVinculo: 'general',
      },
      { clave: 'pagada', tipo: 'pagada', etiqueta: 'Estado de pago (matrícula)', placeholder: 'Todos' },
      { clave: 'desde', tipo: 'fecha', etiqueta: 'Matrícula desde' },
      { clave: 'hasta', tipo: 'fecha', etiqueta: 'Matrícula hasta' },
    ],
    columnas: [
      { clave: 'numDoc', etiqueta: 'Documento', tipo: 'texto' },
      { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto' },
      { clave: 'jornada', etiqueta: 'Jornada', tipo: 'texto' },
      { clave: 'tipoAlumno', etiqueta: 'Tipo', tipo: 'texto' },
      { clave: 'programas', etiqueta: 'Programas', tipo: 'texto' },
      { clave: 'fechaReg', etiqueta: 'Registro', tipo: 'fecha' },
      { clave: 'celular', etiqueta: 'Celular', tipo: 'texto' },
      { clave: 'correo', etiqueta: 'Correo', tipo: 'texto' },
    ],
  },
  {
    id: 'matriculas',
    etiqueta: 'Matrículas',
    descripcion: 'Matrículas por programa con valor, estado de pago y saldo pendiente.',
    icono: '▦',
    filtros: [
      { clave: 'q', tipo: 'texto', etiqueta: 'Búsqueda alumno', placeholder: 'Documento o nombre…' },
      { clave: 'idPrograma', tipo: 'programa', etiqueta: 'Programa', placeholder: 'Todos' },
      { clave: 'pagada', tipo: 'pagada', etiqueta: 'Estado de pago', placeholder: 'Todos' },
      { clave: 'desde', tipo: 'fecha', etiqueta: 'Matrícula desde' },
      { clave: 'hasta', tipo: 'fecha', etiqueta: 'Matrícula hasta' },
    ],
    columnas: [
      { clave: 'numDoc', etiqueta: 'Documento', tipo: 'texto' },
      { clave: 'nombre', etiqueta: 'Alumno', tipo: 'texto' },
      { clave: 'programa', etiqueta: 'Programa', tipo: 'texto' },
      { clave: 'fechaMat', etiqueta: 'Fecha mat.', tipo: 'fecha' },
      { clave: 'valorMat', etiqueta: 'Valor', tipo: 'moneda' },
      { clave: 'pagada', etiqueta: 'Pago', tipo: 'texto' },
      { clave: 'saldo', etiqueta: 'Saldo', tipo: 'moneda' },
      { clave: 'jornada', etiqueta: 'Jornada', tipo: 'texto' },
    ],
  },
  {
    id: 'certificados',
    etiqueta: 'Certificados emitidos',
    descripcion: 'Certificados académicos (excluye jornadas de capacitación en carpa).',
    icono: '▣',
    filtros: [
      { clave: 'q', tipo: 'texto', etiqueta: 'Búsqueda', placeholder: 'Documento, nombre o código…' },
      { clave: 'idPrograma', tipo: 'programa', etiqueta: 'Programa', placeholder: 'Todos' },
      { clave: 'tipoFormatoCert', tipo: 'tipoCert', etiqueta: 'Tipo de certificado', placeholder: 'Todos' },
      { clave: 'desde', tipo: 'fecha', etiqueta: 'Emisión desde' },
      { clave: 'hasta', tipo: 'fecha', etiqueta: 'Emisión hasta' },
    ],
    columnas: [
      { clave: 'numDoc', etiqueta: 'Documento', tipo: 'texto' },
      { clave: 'nombre', etiqueta: 'Alumno', tipo: 'texto' },
      { clave: 'programa', etiqueta: 'Programa', tipo: 'texto' },
      { clave: 'tipoFormatoCert', etiqueta: 'Tipo', tipo: 'texto' },
      { clave: 'codCertificado', etiqueta: 'Código', tipo: 'texto' },
      { clave: 'fechaEmision', etiqueta: 'Emisión', tipo: 'fecha' },
      { clave: 'fechaVencimiento', etiqueta: 'Vencimiento', tipo: 'fecha' },
      { clave: 'estado', etiqueta: 'Estado', tipo: 'texto' },
    ],
  },
  {
    id: 'cartera',
    etiqueta: 'Cartera académica',
    descripcion: 'Liquidaciones con saldo pendiente por alumno, programa y servicio.',
    icono: '$',
    filtros: [
      { clave: 'q', tipo: 'texto', etiqueta: 'Búsqueda', placeholder: 'Documento o nombre…' },
      { clave: 'idPrograma', tipo: 'programa', etiqueta: 'Programa', placeholder: 'Todos' },
      {
        clave: 'idServicio',
        tipo: 'servicio',
        etiqueta: 'Servicio',
        placeholder: 'Todos',
        servicioVinculo: 'programa',
      },
      { clave: 'desde', tipo: 'fecha', etiqueta: 'Creación desde' },
      { clave: 'hasta', tipo: 'fecha', etiqueta: 'Creación hasta' },
    ],
    columnas: [
      { clave: 'numDoc', etiqueta: 'Documento', tipo: 'texto' },
      { clave: 'nombre', etiqueta: 'Alumno', tipo: 'texto' },
      { clave: 'programa', etiqueta: 'Programa', tipo: 'texto' },
      { clave: 'servicio', etiqueta: 'Servicio', tipo: 'texto' },
      { clave: 'valor', etiqueta: 'Valor', tipo: 'moneda' },
      { clave: 'abonado', etiqueta: 'Abonado', tipo: 'moneda' },
      { clave: 'saldo', etiqueta: 'Saldo', tipo: 'moneda' },
      { clave: 'estado', etiqueta: 'Estado', tipo: 'texto' },
      { clave: 'fechaCreacion', etiqueta: 'Fecha', tipo: 'fecha' },
    ],
  },
];

const POR_ID = Object.fromEntries(INFORMES_ACADEMICOS.map((i) => [i.id, i]));

function obtenerInforme(id) {
  return POR_ID[id] || null;
}

function listarInformes() {
  return INFORMES_ACADEMICOS.map(({ id, etiqueta, descripcion, icono, filtros, columnas }) => ({
    id,
    etiqueta,
    descripcion,
    icono,
    filtros,
    columnas,
  }));
}

module.exports = { INFORMES_ACADEMICOS, listarInformes, obtenerInforme };
