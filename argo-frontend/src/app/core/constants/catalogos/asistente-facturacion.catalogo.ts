import type { AsistenteContexto } from '../asistente.types';

/** Ayuda contextual — facturación electrónica. */
export const ASISTENTE_FACTURACION: Record<string, AsistenteContexto> = {
  'facturacion.hub': {
    id: 'facturacion.hub',
    modulo: 'facturacion',
    saludo: 'Estás en el centro de facturación electrónica.',
    tips: [
      {
        id: 'hub-1',
        titulo: '¿Para qué sirve esta pantalla?',
        cuerpo:
          'Aquí consultas las facturas ya emitidas: número, adquirente, estado DIAN, CUFE y total. La emisión se hace desde Pagos del alumno, no desde aquí.',
      },
      {
        id: 'hub-2',
        titulo: 'Modo desarrollo vs Factus',
        cuerpo:
          'Sin resolución DIAN, deja el proveedor en Desarrollo (stub): registra facturas localmente sin enviar a la DIAN. Cuando tengas Factus activo, cambia en Configuración → Facturación electrónica.',
      },
      {
        id: 'hub-3',
        titulo: 'Notas crédito',
        cuerpo:
          'Para anular o devolver una factura usa el botón «Nota crédito». Es solo el documento fiscal; la devolución del dinero al alumno se hace aparte con un egreso en caja.',
      },
      {
        id: 'hub-4',
        titulo: 'Columna Estado',
        cuerpo:
          'Validada = aceptada (o modo desarrollo local). Anulada = tiene nota crédito total. Rechazada = Factus/DIAN devolvió error — revise configuración.',
      },
      {
        id: 'hub-5',
        titulo: 'Ver / PDF',
        cuerpo:
          'Abre representación impresa con QR DIAN, ítems, IVA y CUFE. En desarrollo es documento local; con Factus puede abrir PDF oficial.',
      },
      {
        id: 'hub-6',
        titulo: 'CUFE y búsqueda',
        cuerpo:
          'CUFE identifica la factura ante DIAN. Puede buscar por número, referencia o fragmento de CUFE en filtros si están disponibles.',
      },
      {
        id: 'hub-7',
        titulo: 'Modo desarrollo',
        cuerpo:
          'Facturas DEV-* no tienen validez fiscal. Sirven para probar flujo, PDF y capacitación del personal antes de activar Factus.',
      },
    ],
  },
  'facturacion.config': {
    id: 'facturacion.config',
    modulo: 'facturacion',
    saludo: 'Configuración de facturación electrónica.',
    tips: [
      {
        id: 'cfg-1',
        titulo: 'Proveedor y ambiente',
        cuerpo:
          'Desarrollo = pruebas sin DIAN. Factus = API real (sandbox o producción). «Integración activa» debe estar marcada solo cuando tengas credenciales y rango de numeración DIAN.',
      },
      {
        id: 'cfg-2',
        titulo: 'Datos del emisor',
        cuerpo:
          'NIT, DV, razón social y municipio deben coincidir con su RUT. Son los datos de su CEA como facturador ante la DIAN.',
      },
      {
        id: 'cfg-3',
        titulo: 'IVA incluido en liquidación',
        cuerpo:
          'Con «Valor liquidación incluye IVA» activo, ARGO desglosa el IVA del total (no lo suma encima). Así la factura no genera deuda extra al alumno.',
      },
      {
        id: 'cfg-4',
        titulo: 'Régimen del emisor',
        cuerpo:
          'Debe reflejar su RUT: «No responsable de IVA» o «Responsable de IVA». Coherente con condición IVA de servicios en catálogo Servicios.',
      },
      {
        id: 'cfg-5',
        titulo: 'Responsabilidad fiscal emisor',
        cuerpo:
          'Código DIAN (ej. R-99-PN, O-47). Aparece en representación impresa de la factura.',
      },
      {
        id: 'cfg-6',
        titulo: '% IVA por defecto',
        cuerpo:
          'Usado en servicios gravados sin IVA explícito en catálogo. Típico 19% en Colombia.',
      },
      {
        id: 'cfg-7',
        titulo: 'Credenciales Factus',
        cuerpo:
          'Client ID, secret, usuario y contraseña del API. Rango de numeración = resolución DIAN activa en Factus. Use «Probar conexión» antes de producción.',
      },
      {
        id: 'cfg-8',
        titulo: 'Integración activa',
        cuerpo:
          'Desmarcada = siempre modo local aunque proveedor sea Factus. Marque solo cuando credenciales y numeración estén listas.',
      },
    ],
  },
  'facturacion.clientes': {
    id: 'facturacion.clientes',
    modulo: 'facturacion',
    saludo:
      'Guía del adquirente (Factura electrónica DIAN). Estos datos alimentan el bloque customer del XML/PDF enviado a la DIAN vía Factus. Deben coincidir con el RUT, Cámara de Comercio o documento fiscal del tercero que paga el servicio.',
    tips: [
      {
        id: 'cli-tipo-id',
        titulo: 'Tipo identificación',
        cuerpo:
          'Código DIAN del documento. Empresas: 31 NIT. Persona natural colombiana: 13 CC. Extranjeros: 22 CE, 41 pasaporte, etc.',
      },
      {
        id: 'cli-identificacion',
        titulo: 'Identificación',
        cuerpo:
          'Número sin puntos ni guiones. Para NIT: solo la parte numérica (ej. 900123456), no incluya el DV aquí.',
      },
      {
        id: 'cli-dv',
        titulo: 'DV (dígito de verificación)',
        cuerpo:
          'Solo para NIT (tipo 31). Es el último dígito después del guion (ej. NIT 900123456-7 → identificación 900123456, DV 7). Lo encuentra en el RUT o consulta DIAN. Para CC y otros documentos déjelo vacío.',
      },
      {
        id: 'cli-org-legal',
        titulo: 'Organización legal',
        cuerpo:
          'Persona jurídica (1): empresas, fundaciones, entidades con NIT. Persona natural (2): personas con CC, CE, pasaporte, etc.',
      },
      {
        id: 'cli-resp-fiscal',
        titulo: 'Responsabilidad fiscal',
        cuerpo:
          'Código según RUT del cliente. Uso frecuente: R-99-PN no responsable / no aplica; O-13 gran contribuyente; O-23 agente de retención de IVA; O-47 régimen simple. Debe ser coherente con los checkboxes de abajo.',
      },
      {
        id: 'cli-tributo',
        titulo: 'Tributo (customer)',
        cuerpo:
          'Indica si el adquirente es responsable de IVA. 01 IVA si figura como responsable en el RUT. ZZ si no aplica (persona natural sin obligación, o no responsable de IVA).',
      },
      {
        id: 'cli-razon',
        titulo: 'Razón social / Nombres',
        cuerpo:
          'Jurídica: nombre legal exacto como en RUT/Cámara de Comercio. Natural: nombres y apellidos completos como en la cédula.',
      },
      {
        id: 'cli-nombre-comercial',
        titulo: 'Nombre comercial',
        cuerpo:
          'Opcional. Nombre con el que opera la empresa si difiere de la razón social (campo trade_name Factus).',
      },
      {
        id: 'cli-correo',
        titulo: 'Correo',
        cuerpo:
          'Correo de recepción de factura electrónica. Recomendado si Factus envía el PDF/XML al cliente.',
      },
      {
        id: 'cli-contacto',
        titulo: 'Teléfono y dirección',
        cuerpo:
          'Datos de contacto y ubicación fiscal del adquirente. La dirección debe ser la registrada tributariamente.',
      },
      {
        id: 'cli-municipio',
        titulo: 'Cód. municipio',
        cuerpo:
          'Código DANE de 5 dígitos del municipio (ej. Bogotá 11001, Medellín 05001). Obligatorio para validación DIAN en muchos casos.',
      },
      {
        id: 'cli-gran-contrib',
        titulo: 'Gran contribuyente',
        cuerpo:
          'Marque si el cliente está inscrito como gran contribuyente (responsabilidad O-13 en el RUT). No implica que usted retenga; solo identifica al adquirente.',
      },
      {
        id: 'cli-autorretenedor',
        titulo: 'Autorretenedor',
        cuerpo:
          'Marque si el cliente está inscrito como autorretenedor (O-15). Retiene ReteFuente sobre el pago; ARGO mostrará el valor informativo en la factura del contrato.',
      },
      {
        id: 'cli-agente-rete',
        titulo: 'Agente retenedor de IVA',
        cuerpo:
          'Marque si el cliente es agente retenedor de IVA (O-23). En la factura ARGO mostrará ReteIVA informativa: el cliente retiene a usted, no al revés.',
      },
      {
        id: 'cli-pct-rete',
        titulo: '% ReteIVA',
        cuerpo:
          'Porcentaje que ese cliente aplica como ReteIVA sobre el IVA de la factura (habitualmente 15% para gran contribuyente). Solo informativo en el documento.',
      },
      {
        id: 'cli-ref',
        titulo: 'Referencia normativa',
        cuerpo:
          'Anexo técnico factura electrónica DIAN · catálogos Factus API v2 · Resolución 000012 de 2021 y modificaciones.',
      },
    ],
  },
  'facturacion.emitir-modal': {
    id: 'facturacion.emitir-modal',
    modulo: 'facturacion',
    saludo: 'Emisión de factura electrónica desde pagos del alumno.',
    tips: [
      {
        id: 'emi-1',
        titulo: '¿Cuándo aparece este modal?',
        cuerpo:
          'Desde pestaña Pagos del alumno, botón «Facturar». Solo si hay liquidaciones elegibles y configuración FE activa o en desarrollo.',
      },
      {
        id: 'emi-2',
        titulo: 'Selección de ítems',
        cuerpo:
          'Solo liquidaciones con abono registrado, servicio con Facturar=SI y sin factura activa previa. Marque/desmarque líneas según lo que el alumno pagó.',
      },
      {
        id: 'emi-3',
        titulo: 'Adquirente — alumno',
        cuerpo:
          'Factura a nombre del alumno usando tipo doc y número de su ficha. Verifique municipio y correo si Factus los exige.',
      },
      {
        id: 'emi-4',
        titulo: 'Adquirente — tercero',
        cuerpo:
          'Empresa o persona que paga (ej. convenio). Debe existir en Configuración → Clientes FE con NIT/CC y responsabilidad fiscal.',
      },
      {
        id: 'emi-5',
        titulo: 'Calcular resumen',
        cuerpo:
          'Obligatorio antes de emitir. Muestra base gravada, IVA desglosado (si liquidación incluye IVA), ReteIVA informativa y total a facturar.',
      },
      {
        id: 'emi-6',
        titulo: 'IVA incluido vs excluido',
        cuerpo:
          'Con «Valor liquidación incluye IVA» en config, el total del abono ya trae IVA; ARGO lo separa para el XML. No suma IVA encima.',
      },
      {
        id: 'emi-7',
        titulo: 'Después de emitir',
        cuerpo:
          'Factura queda en hub FE. Use Ver/PDF para imprimir. El pago en caja no se duplica: la factura es documento fiscal, no nuevo ingreso.',
      },
      {
        id: 'emi-8',
        titulo: 'Errores Factus',
        cuerpo:
          'Si rechaza, revise NIT adquirente, numeración agotada o servicio sin condición IVA. En desarrollo (stub) casi siempre acepta para pruebas.',
      },
    ],
  },
  'facturacion.nota-modal': {
    id: 'facturacion.nota-modal',
    modulo: 'facturacion',
    saludo: 'Nota crédito — anulación o devolución fiscal.',
    tips: [
      {
        id: 'nc-1',
        titulo: '¿Qué es una nota crédito?',
        cuerpo:
          'Documento DIAN que reduce o anula el valor de una factura ya emitida. Es obligatoria para «deshacer» fiscalmente una factura; no basta borrarla.',
      },
      {
        id: 'nc-2',
        titulo: 'Anulación total',
        cuerpo:
          'Revoca toda la factura. Estado pasa a anulada. Las liquidaciones vinculadas quedan libres para facturarse de nuevo si el alumno sigue pagado.',
      },
      {
        id: 'nc-3',
        titulo: 'Devolución parcial',
        cuerpo:
          'Seleccione solo ítems a revertir (ej. un servicio devuelto). La factura original sigue vigente por el resto de líneas.',
      },
      {
        id: 'nc-4',
        titulo: 'Motivo DIAN',
        cuerpo:
          'Indique causal reconocida (devolución, anulación, descuento posterior). Aparece en XML y representación impresa.',
      },
      {
        id: 'nc-5',
        titulo: 'Dinero vs documento',
        cuerpo:
          'La nota crédito NO devuelve dinero al alumno. Si hubo reembolso en efectivo o transferencia, regístrelo aparte como egreso en caja.',
      },
      {
        id: 'nc-6',
        titulo: 'CUDE y PDF',
        cuerpo:
          'Tras emitir, la nota tiene CUDE propio. Use Ver/PDF en hub de facturación igual que una factura.',
      },
      {
        id: 'nc-7',
        titulo: 'Modo desarrollo',
        cuerpo:
          'En stub local genera CUDE de prueba. No tiene validez ante DIAN hasta usar Factus en producción.',
      },
    ],
  },
};
