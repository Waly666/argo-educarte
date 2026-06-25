/**
 * Repara índice idLiquidacion en certificados:
 * - Quita idLiquidacion: null (históricos deben omitir el campo)
 * - Reemplaza índice sparse único por índice parcial (varios sin liquidación)
 *
 * Uso: node scripts/repararIndiceCertificadoLiquidacion.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const Certificado = require('../src/models/Certificado');

async function main() {
  await connectDB();
  const col = Certificado.collection;

  const sinLiq = await col.updateMany({ idLiquidacion: null }, { $unset: { idLiquidacion: '' } });
  console.log(`Certificados sin liquidación (campo eliminado si era null): ${sinLiq.modifiedCount}`);

  const indices = await col.indexes();
  for (const idx of indices) {
    if (idx.key?.idLiquidacion === 1 && idx.name !== 'idLiquidacion_1_partial') {
      console.log(`Eliminando índice antiguo: ${idx.name}`);
      await col.dropIndex(idx.name);
    }
  }

  await col.createIndex(
    { idLiquidacion: 1 },
    {
      unique: true,
      name: 'idLiquidacion_1_partial',
      partialFilterExpression: { idLiquidacion: { $type: 'objectId' } },
    },
  );
  console.log('Índice parcial idLiquidacion_1_partial creado.');

  const total = await col.countDocuments({ idLiquidacion: { $exists: false } });
  console.log(`Certificados históricos (sin idLiquidacion): ${total}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
