/**
 * Plantilla Factus API V2 sandbox (credenciales de prueba del proveedor).
 * Cuando un CEA compre ARGO, reemplazará estos valores por los suyos en esta pantalla.
 */
export const FACTUS_SANDBOX_PLANTILLA = {
  proveedor: 'factus' as const,
  ambiente: 'sandbox' as const,
  baseUrl: 'https://api-sandbox.factus.com.co',
  clientId: 'a1e14313-89e0-4b97-93ad-cfc3a36ba2ed',
  clientSecret: 'mxdyoqe3pLZsoCzWUX9cutCMzvyO614qlspJFPoj',
  username: 'sandboxv2@factus.com.co',
  password: 'sandbox2026%',
  activo: true,
  sendEmail: false,
  valorIncluyeIva: true,
  modoEmision: 'manual',
  emisorNit: '900123456',
  emisorDv: '1',
  emisorRazonSocial: 'CEA Prueba ARGO Sandbox',
  emisorResponsabilidadFiscal: 'R-99-PN',
  emisorRegimen: 'No responsable de IVA',
  emisorMunicipioCodigo: '11001',
  ivaPorDefecto: 19,
  prefijoDesarrollo: 'DEV',
  /** Rango sandbox «Factura de Venta» SETP (se confirma al cargar rangos). */
  numberingRangeId: 389,
};
