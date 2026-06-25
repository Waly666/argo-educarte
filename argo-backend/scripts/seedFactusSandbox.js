/**
 * Carga configuración Factus sandbox en MongoDB desde variables de entorno.
 * Uso: copiar deploy/factus-sandbox.env.example → argo-backend/.env y luego:
 *   pnpm run seed:factus-sandbox
 */
require('dotenv').config();
const { connectDB } = require('../src/config/db');
const { actualizarConfigFacturacion } = require('../src/services/configFacturacion');

(async () => {
  try {
    await connectDB();

    const dto = {
      proveedor: process.env.FACTUS_PROVEEDOR || 'factus',
      ambiente: process.env.FACTUS_AMBIENTE || 'sandbox',
      baseUrl: process.env.FACTUS_BASE_URL || 'https://api-sandbox.factus.com.co',
      clientId: process.env.FACTUS_CLIENT_ID || '',
      clientSecret: process.env.FACTUS_CLIENT_SECRET || '',
      username: process.env.FACTUS_USERNAME || '',
      password: process.env.FACTUS_PASSWORD || '',
      numberingRangeId:
        process.env.FACTUS_NUMBERING_RANGE_ID != null && process.env.FACTUS_NUMBERING_RANGE_ID !== ''
          ? Number(process.env.FACTUS_NUMBERING_RANGE_ID) || null
          : null,
      activo: true,
      sendEmail: false,
      valorIncluyeIva: true,
      modoEmision: 'manual',
      emisorNit: process.env.FACTUS_EMISOR_NIT || '900123456',
      emisorDv: process.env.FACTUS_EMISOR_DV || '1',
      emisorRazonSocial: process.env.FACTUS_EMISOR_RAZON || 'CEA Prueba ARGO Sandbox',
      emisorResponsabilidadFiscal: 'R-99-PN',
      emisorRegimen: 'No responsable de IVA',
      emisorMunicipioCodigo: process.env.FACTUS_EMISOR_MUNICIPIO || '11001',
      ivaPorDefecto: 19,
    };

    if (!dto.clientId || !dto.clientSecret || !dto.username || !dto.password) {
      console.error(
        '[seedFactusSandbox] Faltan credenciales. Copie deploy/factus-sandbox.env.example a argo-backend/.env',
      );
      process.exit(1);
    }

    const cfg = await actualizarConfigFacturacion(dto);
    console.log('[seedFactusSandbox] Configuración guardada.');
    console.log('  proveedor:', cfg.proveedor);
    console.log('  ambiente:', cfg.ambiente);
    console.log('  baseUrl:', cfg.baseUrl);
    console.log('  username:', cfg.username);
    console.log('  numberingRangeId:', cfg.numberingRangeId ?? '(pendiente — cargar en UI)');
    console.log('  activo:', cfg.activo);
    process.exit(0);
  } catch (e) {
    console.error('[seedFactusSandbox] Error:', e.message || e);
    process.exit(1);
  }
})();
