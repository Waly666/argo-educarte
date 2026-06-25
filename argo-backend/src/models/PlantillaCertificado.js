const mongoose = require('mongoose');

const PlantillaCertificadoSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    /** curso | tecnico | competencias | diplomado | licencia | mercancias_peligrosas */
    tipoCertificado: {
      type: String,
      enum: [
        'curso',
        'tecnico',
        'competencias',
        'diplomado',
        'licencia',
        'mercancias_peligrosas',
        'jornada_capacitacion',
      ],
      default: 'curso',
      index: true,
    },
    orientacion: { type: String, enum: ['vertical', 'horizontal'], default: 'vertical' },
    urlFondo: { type: String, trim: true, default: '' },
    activa: { type: Boolean, default: true },
  },
  { collection: 'plantillasCertificado', timestamps: true },
);

module.exports = mongoose.model('PlantillaCertificado', PlantillaCertificadoSchema);
