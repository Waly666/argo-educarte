const mongoose = require('mongoose');

/**
 * Catálogo de Clientes para facturación electrónica.
 * El adquirente de una factura puede ser el alumno (no usa este catálogo)
 * o un Cliente (empresa o persona) registrado aquí.
 */
const ClienteSchema = new mongoose.Schema(
  {
    /** Código tipo identificación DIAN (13=CC, 31=NIT, 22=CE, 12=TI, 41=PP). */
    identificationDocumentCode: { type: String, trim: true, default: '31' },
    identificacion: { type: String, required: true, trim: true, index: true },
    /** Dígito de verificación (solo NIT). */
    dv: { type: String, trim: true, default: '' },
    /** 1=Persona jurídica, 2=Persona natural. */
    legalOrganizationCode: { type: String, trim: true, default: '1' },
    razonSocial: { type: String, trim: true, default: '' },
    nombreComercial: { type: String, trim: true, default: '' },
    /** Nombres (persona natural). */
    nombres: { type: String, trim: true, default: '' },
    /** Código tributo DIAN (ZZ=No aplica, 01=IVA, etc.). */
    tributeCode: { type: String, trim: true, default: 'ZZ' },
    /** Código responsabilidad fiscal DIAN (O-13, O-15, R-99-PN, etc.). */
    responsabilidadFiscal: { type: String, trim: true, default: 'R-99-PN' },
    direccion: { type: String, trim: true, default: '' },
    correo: { type: String, trim: true, default: '' },
    telefono: { type: String, trim: true, default: '' },
    municipioCodigo: { type: String, trim: true, default: '' },
    municipioNombre: { type: String, trim: true, default: '' },

    /**
     * Clasificación fiscal capacitación: juridica_empresa | juridica_oficial | juridica_ong | persona_natural.
     * Define el perfil IVA/retenciones (Config → Contratos capacitación fiscal) al facturar contratos.
     */
    tipoContratoCap: { type: String, trim: true, default: '' },

    /** Banderas tributarias. */
    granContribuyente: { type: Boolean, default: false },
    /** Autorretenedor (O-15): retiene ReteFuente sobre el pago al proveedor. */
    autoretenedor: { type: Boolean, default: false },
    /** El cliente actúa como agente retenedor de IVA (ReteIVA informativa en factura). */
    agenteRetenedorIva: { type: Boolean, default: false },
    porcentajeReteIva: { type: Number, default: 0 },
    /** % ReteFuente que aplica el cliente autorretenedor (informativo en factura). */
    porcentajeReteFuente: { type: Number, default: 0 },

    activo: { type: Boolean, default: true, index: true },
    userAddReg: { type: String, trim: true },
    userChangeRecord: { type: String, trim: true },
  },
  { collection: 'clientesFacturacion', timestamps: true, strict: false },
);

ClienteSchema.index({ razonSocial: 'text', nombres: 'text' });

module.exports = mongoose.model('Cliente', ClienteSchema);
